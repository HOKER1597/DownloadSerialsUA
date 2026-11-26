from __future__ import annotations

import os
import secrets
import shutil
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.events import EventHub
from app.api.routes import events, folders, jobs, scans
from app.downloads.service import JobManager
from app.storage.sqlite import Store


def create_app(data_dir: Path | None = None, token: str | None = None) -> FastAPI:
    app = FastAPI(title="Кадр — завантаження серіалів")
    app.state.token = token or secrets.token_urlsafe(32)
    default_data = Path(
        os.environ.get(
            "KADR_DATA_DIR", Path(os.environ.get("LOCALAPPDATA", Path.home())) / "KadrDownloader"
        )
    )
    app.state.store = Store((data_dir or default_data) / "state.sqlite3")
    app.state.events = EventHub()
    app.state.manager = JobManager(app.state.store, app.state.events.publish)

    async def shutdown() -> None:
        await app.state.manager.shutdown()
        app.state.store.close()

    app.add_event_handler("shutdown", shutdown)

    @app.get("/api/health")
    async def health():
        return {"status": "ok", "ffmpeg": bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))}

    for router in (scans.router, jobs.router, folders.router, events.router):
        app.include_router(router)

    dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    if dist.exists():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.get("/{path:path}")
        async def frontend(path: str):
            candidate = (dist / path).resolve()
            if path and candidate.is_relative_to(dist.resolve()) and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(dist / "index.html")

    return app


app = create_app()
