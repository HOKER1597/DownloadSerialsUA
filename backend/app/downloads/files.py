from __future__ import annotations

import re
from pathlib import Path

from app.downloads.models import DownloadJob, EpisodeProgress


INVALID_NAME = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def safe_name(raw: str) -> str:
    result = INVALID_NAME.sub("_", raw).strip(" .")
    return result[:110] or "Відео"


def write_playlist(job: DownloadJob) -> None:
    by_season: dict[Path, list[EpisodeProgress]] = {}
    for episode in job.episodes:
        if episode.output_file:
            by_season.setdefault(Path(episode.output_file).parent, []).append(episode)
    for folder, episodes in by_season.items():
        if len(episodes) < 2:
            continue
        lines = ["#EXTM3U"]
        lines.extend(
            Path(episode.output_file).name
            for episode in sorted(episodes, key=lambda item: item.number)
            if episode.output_file
        )
        (folder / "Сезон.m3u8").write_text("\n".join(lines) + "\n", encoding="utf-8")
