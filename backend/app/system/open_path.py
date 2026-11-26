from __future__ import annotations

from pathlib import Path

from app.downloads.models import DownloadJob


def resolve_job_path(job: DownloadJob, kind: str, episode_id: str | None) -> Path:
    if kind not in ("folder", "file"):
        raise ValueError("Невідома дія відкриття.")

    root = Path(job.output_dir).expanduser().resolve()
    episode = next((item for item in job.episodes if item.episode_id == episode_id), None)
    if kind == "file":
        if not episode or episode.status != "complete" or not episode.output_file:
            raise ValueError("Готовий файл не знайдено.")
        target = Path(episode.output_file).resolve()
        if target.suffix.lower() != ".mp4" or not target.is_file():
            raise FileNotFoundError("Файлу вже немає на диску.")
    else:
        stored = episode.output_file or episode.partial_file if episode else None
        target = Path(stored).resolve().parent if stored else root / job.title
        if not target.is_dir():
            target = root
        if not target.is_dir():
            raise FileNotFoundError("Папки вже немає на диску.")

    if not target.is_relative_to(root):
        raise ValueError("Шлях виходить за межі папки завантаження.")
    return target
