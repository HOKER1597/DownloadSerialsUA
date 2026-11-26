from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Variant(BaseModel):
    label: str
    width: int
    height: int
    bandwidth: int
    duration_seconds: float
    estimated_bytes: int
    playlist_url: str
    referer: str


class Episode(BaseModel):
    id: str
    number: int
    season: int | None = None
    voice: str = "Невідоме озвучення"
    source_url: str
    variants: list[Variant] = Field(default_factory=list)


class Catalog(BaseModel):
    id: str
    source_url: str
    site: Literal["UAKINO", "UAFLIX"]
    title: str
    season: int | None = None
    episodes: list[Episode]
    created_at: str = Field(default_factory=now_iso)


class ScanState(BaseModel):
    id: str
    status: Literal["scanning", "complete", "failed"] = "scanning"
    message: str = "Читаємо сторінку…"
    done: int = 0
    total: int = 0
    catalog: Catalog | None = None
    error: str | None = None
