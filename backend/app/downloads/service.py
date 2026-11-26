from __future__ import annotations

import asyncio
import shutil
from pathlib import Path
from uuid import uuid4

from app.catalog.models import Catalog
from app.downloads.models import DownloadJob, EpisodeProgress
from app.downloads.quality import select_variant
from app.downloads.runner import JobRunner
from app.storage.sqlite import Store


class JobManager(JobRunner):
    def __init__(self, store: Store, notify) -> None:
        self.store = store
        self.notify = notify
        self.tasks: dict[str, asyncio.Task] = {}
        self.processes: dict[tuple[str, str], asyncio.subprocess.Process] = {}
        self.cancelled: set[str] = set()
        self.assembly_semaphore = asyncio.Semaphore(35)

    def create(
        self,
        scan_id: str,
        catalog: Catalog,
        episode_ids: list[str],
        quality: str,
        output_dir: str,
        parallel_limit: int,
    ) -> DownloadJob:
        selected = [episode for episode in catalog.episodes if episode.id in set(episode_ids)]
        if not selected or len(selected) != len(set(episode_ids)):
            raise ValueError("Виберіть серії зі знайденого списку.")
        selected_variants = [select_variant(episode.variants, quality) for episode in selected]
        if any(variant is None for variant in selected_variants):
            raise ValueError("Обрана якість доступна не для всіх вибраних серій.")
        if parallel_limit < 1 or parallel_limit > min(35, len(selected)):
            raise ValueError("Недопустима кількість паралельних завантажень.")
        requested = {
            (episode.season, episode.voice.casefold(), episode.number) for episode in selected
        }
        for active in self.store.all_jobs():
            if (
                active.status not in ("queued", "downloading")
                or active.title.casefold() != catalog.title.casefold()
            ):
                continue
            active_episodes = {
                (episode.season, episode.voice.casefold(), episode.number)
                for episode in active.episodes
                if episode.status in ("queued", "downloading")
            }
            if requested & active_episodes:
                raise ValueError(
                    "Ці серії вже завантажуються. Дочекайтеся завершення або скасуйте поточне завдання."
                )
        root = Path(output_dir).expanduser()
        if not root.is_dir():
            raise ValueError("Вибрана папка не існує або недоступна.")
        if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
            raise ValueError(
                "Не знайдено FFmpeg або ffprobe. Встановіть FFmpeg і запустіть застосунок знову."
            )
        estimated = sum(variant.estimated_bytes for variant in selected_variants if variant)
        dimensions = {
            (variant.width, variant.height)
            for variant in selected_variants
            if variant and variant.width and variant.height
        }
        if len(dimensions) == 1:
            width, height = next(iter(dimensions))
            resolution_label = f"{width} × {height}"
        else:
            resolution_label = "Різна роздільність" if dimensions else quality
        if shutil.disk_usage(root).free < int(estimated * 1.15):
            raise ValueError("У вибраній папці недостатньо вільного місця.")
        progress = [
            EpisodeProgress(
                episode_id=episode.id,
                number=episode.number,
                season=episode.season,
                voice=episode.voice,
                estimated_bytes=variant.estimated_bytes,
            )
            for episode, variant in zip(selected, selected_variants)
            if variant
        ]
        job = DownloadJob(
            id=uuid4().hex,
            catalog_id=scan_id,
            title=catalog.title,
            quality=quality,
            resolution=resolution_label,
            output_dir=str(root),
            parallel_limit=parallel_limit,
            episodes=progress,
            estimated_bytes=estimated,
        )
        self.store.save_job(job)
        self.tasks[job.id] = asyncio.create_task(self._run(job.id))
        return job

    async def delete_job(self, job_id: str) -> None:
        job = self.store.get_job(job_id)
        if not job:
            raise ValueError("Запис історії не знайдено.")
        task = self.tasks.get(job_id)
        if task and not task.done():
            raise ValueError("Спочатку скасуйте й дочекайтеся завершення завдання.")
        root = Path(job.output_dir).expanduser().resolve()
        files: list[Path] = []
        for episode in job.episodes:
            for stored_path in (episode.output_file, episode.partial_file):
                if not stored_path:
                    continue
                target = Path(stored_path).resolve()
                if (
                    target.is_relative_to(root)
                    and target.suffix.lower() in (".mp4", ".ts")
                    and target.is_file()
                ):
                    files.append(target)
            if episode.partial_file:
                part_path = Path(episode.partial_file).resolve()
                if part_path.is_relative_to(root):
                    prefix = part_path.name.rsplit(".", 2)[0]
                    files.extend(
                        path
                        for path in part_path.parent.glob(prefix + ".*.ts")
                        if path.is_file() and path.resolve().is_relative_to(root)
                    )
                    concat_file = part_path.parent / f"{prefix}.concat.txt"
                    if concat_file.is_file() and concat_file.resolve().is_relative_to(root):
                        files.append(concat_file)
        for target in dict.fromkeys(files):
            try:
                target.unlink()
            except OSError as error:
                raise ValueError(f"Не вдалося видалити файл {target.name}: {error}") from error
            playlist = target.parent / "Сезон.m3u8"
            try:
                if playlist.resolve().is_relative_to(root) and playlist.is_file():
                    lines = playlist.read_text(encoding="utf-8").splitlines()
                    remaining = [line for line in lines if line != target.name]
                    if remaining != lines:
                        if any(line and not line.startswith("#") for line in remaining):
                            playlist.write_text("\n".join(remaining) + "\n", encoding="utf-8")
                        else:
                            playlist.unlink()
            except OSError:
                pass
        self.store.delete_job(job_id)

    async def cancel(self, job_id: str) -> DownloadJob:
        job = self.store.get_job(job_id)
        if not job:
            raise ValueError("Завдання не знайдено.")
        self.cancelled.add(job_id)
        for (current_id, _), process in list(self.processes.items()):
            if current_id == job_id and process.returncode is None:
                process.terminate()
        if job_id not in self.tasks:
            job.status = "cancelled"
            self.store.save_job(job)
        return job

    async def shutdown(self) -> None:
        self.cancelled.update(self.tasks)
        processes = list(self.processes.values())
        for process in processes:
            if process.returncode is None:
                process.terminate()
        for process in processes:
            try:
                await asyncio.wait_for(process.wait(), timeout=5)
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
        tasks = list(self.tasks.values())
        if tasks:
            try:
                await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=10)
            except asyncio.TimeoutError:
                for task in tasks:
                    task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)

    async def retry(self, job_id: str) -> DownloadJob:
        job = self.store.get_job(job_id)
        if not job:
            raise ValueError("Завдання не знайдено.")
        if job_id in self.tasks and not self.tasks[job_id].done():
            raise ValueError("Завдання ще виконується.")
        if not any(episode.status in ("failed", "cancelled") for episode in job.episodes):
            raise ValueError("У завданні немає серій для повторного завантаження.")
        scan = self.store.get_scan(job.catalog_id)
        if not scan or not scan.catalog:
            raise ValueError("Каталог не знайдено. Виконайте пошук ще раз.")
        if not job.resolution:
            selected = {episode.episode_id for episode in job.episodes}
            dimensions = {
                (variant.width, variant.height)
                for episode in scan.catalog.episodes
                if episode.id in selected
                for variant in [select_variant(episode.variants, job.quality)]
                if variant and variant.width and variant.height
            }
            if len(dimensions) == 1:
                width, height = next(iter(dimensions))
                job.resolution = f"{width} × {height}"
            elif dimensions:
                job.resolution = "Різна роздільність"
        for episode in job.episodes:
            if episode.status in ("failed", "cancelled"):
                episode.status = "queued"
                episode.error = None
                if not episode.partial_file or not Path(episode.partial_file).is_file():
                    episode.percent = 0
        self.cancelled.discard(job_id)
        job.status = "queued"
        self.store.save_job(job)
        self.tasks[job.id] = asyncio.create_task(self._run(job.id))
        return job

    async def delete_file(self, job_id: str, episode_id: str) -> DownloadJob:
        job = self.store.get_job(job_id)
        if not job:
            raise ValueError("Завдання не знайдено.")
        if job_id in self.tasks and not self.tasks[job_id].done():
            raise ValueError("Дочекайтеся завершення завдання перед видаленням файлу.")
        episode = next((item for item in job.episodes if item.episode_id == episode_id), None)
        if not episode or episode.status != "complete" or not episode.output_file:
            raise ValueError("Готовий файл цієї серії не знайдено в завданні.")
        root = Path(job.output_dir).resolve()
        target = Path(episode.output_file).resolve()
        if not target.is_relative_to(root) or target.suffix.lower() != ".mp4":
            raise ValueError("Шлях файлу виходить за межі папки завантаження.")
        if not target.is_file():
            raise ValueError("Файл уже відсутній на диску.")
        try:
            target.unlink()
        except OSError as error:
            raise ValueError(f"Не вдалося видалити файл: {error}") from error
        playlist = target.parent / "Сезон.m3u8"
        try:
            if playlist.resolve().is_relative_to(root) and playlist.is_file():
                lines = playlist.read_text(encoding="utf-8").splitlines()
                remaining = [line for line in lines if line != target.name]
                if remaining != lines:
                    if any(line and not line.startswith("#") for line in remaining):
                        playlist.write_text("\n".join(remaining) + "\n", encoding="utf-8")
                    else:
                        playlist.unlink()
        except OSError as error:
            episode.error = f"Файл видалено, але плейлист не вдалося оновити: {error}"
        episode.status = "deleted"
        episode.percent = 0
        episode.bytes_written = 0
        episode.output_file = None
        statuses = {item.status for item in job.episodes}
        if statuses == {"deleted"}:
            job.status = "deleted"
        elif statuses <= {"complete", "deleted"}:
            job.status = "mixed"
        await self._publish(job)
        return job
