from __future__ import annotations

import asyncio
from pathlib import Path

from app.catalog.models import Catalog, Episode
from app.catalog.sources.http import SourceHttp
from app.catalog.sources.registry import resolve_episode
from app.downloads.files import safe_name, write_playlist
from app.downloads.media import MediaOperations, media_duration, valid_video
from app.downloads.models import DownloadJob, EpisodeProgress
from app.downloads.quality import select_variant


class JobRunner(MediaOperations):
    async def _publish(self, job: DownloadJob) -> None:
        self.store.save_job(job)
        await self.notify({"type": "job", "job": job.model_dump(mode="json")})

    async def _run(self, job_id: str) -> None:
        job = self.store.get_job(job_id)
        if not job:
            return
        scan = self.store.get_scan(job.catalog_id)
        if not scan or not scan.catalog:
            return
        catalog = scan.catalog
        episode_map = {episode.id: episode for episode in catalog.episodes}
        job.status = "downloading"
        await self._publish(job)
        semaphore = asyncio.Semaphore(job.parallel_limit)

        async def run_one(progress: EpisodeProgress) -> None:
            async with semaphore:
                if job.id in self.cancelled:
                    progress.status = "cancelled"
                    return
                episode = episode_map[progress.episode_id]
                await self._download_one(job, progress, episode, catalog)

        await asyncio.gather(
            *(run_one(progress) for progress in job.episodes if progress.status == "queued")
        )
        statuses = {progress.status for progress in job.episodes}
        if job.id in self.cancelled:
            job.status = "cancelled"
        elif statuses == {"complete"}:
            job.status = "complete"
        elif statuses == {"deleted"}:
            job.status = "deleted"
        elif statuses <= {"complete", "deleted"}:
            job.status = "mixed"
        elif "complete" in statuses:
            job.status = "partial"
        else:
            job.status = "failed"
        if job.status == "complete" and len(job.episodes) > 1:
            write_playlist(job)
        await self._publish(job)
        self.tasks.pop(job.id, None)

    async def _download_one(
        self, job: DownloadJob, progress: EpisodeProgress, episode: Episode, catalog: Catalog
    ) -> None:
        selected_variant = select_variant(episode.variants, job.quality)
        if not selected_variant:
            raise RuntimeError("Обрана якість більше не доступна.")
        season = f"Сезон {episode.season}" if episode.season else "Фільм"
        destination = Path(job.output_dir) / safe_name(catalog.title) / season
        destination.mkdir(parents=True, exist_ok=True)
        label = f"S{episode.season:02d}E{episode.number:02d}" if episode.season else "Фільм"
        filename = (
            safe_name(f"{catalog.title} {label} ({episode.voice}, {selected_variant.label})")
            + ".mp4"
        )
        final = destination / filename
        prefix = destination / (filename.removesuffix(".mp4") + ".part")
        chunks = sorted(destination.glob(prefix.name + ".*.ts"))
        valid_chunks: list[Path] = []
        resume_seconds = 0.0
        for existing_chunk in chunks:
            chunk_duration = await media_duration(existing_chunk)
            if chunk_duration > 0:
                valid_chunks.append(existing_chunk)
                resume_seconds += chunk_duration
            else:
                existing_chunk.unlink(missing_ok=True)
        chunks = valid_chunks
        progress.partial_file = str(chunks[-1]) if chunks else None
        estimated_duration = selected_variant.duration_seconds
        if await valid_video(final, estimated_duration):
            progress.status = "complete"
            progress.percent = 100
            progress.bytes_written = final.stat().st_size
            progress.output_file = str(final)
            progress.phase = "complete"
            await self._publish(job)
            return
        progress.status = "downloading"
        progress.phase = "downloading"
        progress.bytes_written = sum(chunk.stat().st_size for chunk in chunks)
        await self._publish(job)
        error = "Невідома помилка"
        for attempt in range(1, 4):
            if job.id in self.cancelled:
                break
            chunk = destination / f"{prefix.name}.{len(chunks):05d}.ts"
            http = SourceHttp()
            try:
                if chunks and resume_seconds >= estimated_duration * 0.95:
                    await self._finalize_chunks(
                        job, progress, chunks, prefix, final, estimated_duration
                    )
                    return
                variants = await resolve_episode(http, catalog.site, episode, catalog.source_url)
                variant = select_variant(variants, job.quality)
                if not variant:
                    raise RuntimeError("Обрана якість більше не доступна.")
                chunk = destination / f"{prefix.name}.{len(chunks):05d}.ts"
                progress.partial_file = str(chunk)
                progress.phase = "downloading"
                await self._publish(job)
                await self._ffmpeg(
                    job,
                    progress,
                    variant.playlist_url,
                    variant.referer,
                    chunk,
                    variant.duration_seconds,
                    start_seconds=resume_seconds,
                    previous_bytes=sum(item.stat().st_size for item in chunks),
                    mpegts=True,
                )
                if job.id in self.cancelled:
                    if await media_duration(chunk) > 0:
                        chunks.append(chunk)
                        progress.partial_file = str(chunk)
                        await self._publish(job)
                    break
                segment_duration = await media_duration(chunk)
                if segment_duration <= 0:
                    raise RuntimeError("Отримана частина відео пошкоджена.")
                chunks.append(chunk)
                resume_seconds += segment_duration
                if resume_seconds < variant.duration_seconds * 0.95:
                    raise RuntimeError(
                        "З’єднання перервано; збережена частина залишиться для продовження."
                    )
                await self._finalize_chunks(
                    job, progress, chunks, prefix, final, variant.duration_seconds
                )
                return
            except Exception as exception:
                error = str(exception)
                progress.speed_bytes = 0
                if chunk.is_file() and await media_duration(chunk) > 0 and chunk not in chunks:
                    chunks.append(chunk)
                    resume_seconds += await media_duration(chunk)
                    progress.partial_file = str(chunk)
                progress.error = f"Спроба {attempt}/3: {error}"
                await self._publish(job)
                if attempt < 3:
                    await asyncio.sleep(attempt * 2)
            finally:
                await http.close()
        progress.status = "cancelled" if job.id in self.cancelled else "failed"
        progress.speed_bytes = 0
        progress.error = None if progress.status == "cancelled" else error
        await self._publish(job)

    async def _finalize_chunks(
        self,
        job: DownloadJob,
        progress: EpisodeProgress,
        chunks: list[Path],
        prefix: Path,
        final: Path,
        duration: float,
    ) -> None:
        concat_file = prefix.parent / f"{prefix.name}.concat.txt"
        progress.phase = "assembling"
        progress.speed_bytes = 0
        await self._publish(job)
        async with self.assembly_semaphore:
            if job.id in self.cancelled:
                raise RuntimeError("Завдання скасовано.")
            concat_file.write_text(
                "".join(f"file {self._concat_quote(item.as_posix())}\n" for item in chunks),
                encoding="utf-8",
            )
            await self._assemble(job, progress, concat_file, final)
            if job.id in self.cancelled:
                raise RuntimeError("Завдання скасовано.")
            progress.phase = "verifying"
            await self._publish(job)
            if not await valid_video(final, duration):
                final.unlink(missing_ok=True)
                raise RuntimeError("Об’єднаний файл неповний або пошкоджений.")
            for item in chunks:
                item.unlink(missing_ok=True)
            concat_file.unlink(missing_ok=True)
            progress.status = "complete"
            progress.percent = 100
            progress.bytes_written = final.stat().st_size
            progress.output_file = str(final)
            progress.partial_file = None
            progress.phase = "complete"
            progress.error = None
            await self._publish(job)
