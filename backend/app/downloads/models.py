from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field
from app.catalog.models import now_iso


class EpisodeProgress(BaseModel):
    episode_id: str
    number: int
    season: int | None = None
    voice: str
    status: Literal["queued", "downloading", "complete", "failed", "cancelled", "deleted"] = (
        "queued"
    )
    percent: float = 0
    bytes_written: int = 0
    estimated_bytes: int = 0
    speed_bytes: float = 0
    phase: Literal["queued", "downloading", "assembling", "verifying", "complete"] = "queued"
    speed: str = ""
    output_file: str | None = None
    partial_file: str | None = None
    error: str | None = None


class DownloadJob(BaseModel):
    id: str
    catalog_id: str
    title: str
    quality: str
    resolution: str = ""
    output_dir: str
    parallel_limit: int
    status: Literal[
        "queued",
        "downloading",
        "complete",
        "partial",
        "failed",
        "cancelled",
        "interrupted",
        "deleted",
        "mixed",
    ] = "queued"
    episodes: list[EpisodeProgress]
    estimated_bytes: int
    created_at: str = Field(default_factory=now_iso)
