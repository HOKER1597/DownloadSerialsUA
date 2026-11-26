from __future__ import annotations

import asyncio
import os

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.api.dependencies import require_token
from app.downloads.models import DownloadJob
from app.downloads.quality import select_variant
from app.system.open_path import resolve_job_path

router = APIRouter(prefix="/api/jobs", dependencies=[Depends(require_token)])


class DownloadRequest(BaseModel):
    catalog_id: str
    episode_ids: list[str]
    quality: str
    output_dir: str
    parallel_limit: int = 1


class DeleteFileRequest(BaseModel):
    episode_id: str


class OpenRequest(BaseModel):
    episode_id: str | None = None


def with_resolution(job: DownloadJob, store) -> DownloadJob:
    if job.resolution:
        return job
    scan = store.get_scan(job.catalog_id)
    if not scan or not scan.catalog:
        return job
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
    return job


@router.get("")
async def list_jobs(request: Request):
    store = request.app.state.store
    return [with_resolution(job, store) for job in store.list_jobs()]


@router.get("/{job_id}")
async def get_job(job_id: str, request: Request):
    store = request.app.state.store
    job = store.get_job(job_id)
    if not job:
        raise HTTPException(404, "Завдання не знайдено.")
    return with_resolution(job, store)


@router.delete("/{job_id}")
async def delete_job(job_id: str, request: Request):
    try:
        await request.app.state.manager.delete_job(job_id)
        return {"deleted": True}
    except ValueError as error:
        raise HTTPException(400, str(error)) from error


@router.post("")
async def create_job(body: DownloadRequest, request: Request):
    item = request.app.state.store.get_scan(body.catalog_id)
    if not item or not item.catalog:
        raise HTTPException(404, "Каталог не знайдено. Виконайте пошук знову.")
    try:
        return request.app.state.manager.create(
            item.id,
            item.catalog,
            body.episode_ids,
            body.quality,
            body.output_dir,
            body.parallel_limit,
        )
    except ValueError as error:
        raise HTTPException(400, str(error)) from error


@router.post("/{job_id}/cancel")
async def cancel_job(job_id: str, request: Request):
    try:
        return await request.app.state.manager.cancel(job_id)
    except ValueError as error:
        raise HTTPException(400, str(error)) from error


@router.post("/{job_id}/retry")
async def retry_job(job_id: str, request: Request):
    try:
        return await request.app.state.manager.retry(job_id)
    except ValueError as error:
        raise HTTPException(400, str(error)) from error


@router.post("/{job_id}/delete-file")
async def delete_file(job_id: str, body: DeleteFileRequest, request: Request):
    try:
        return await request.app.state.manager.delete_file(job_id, body.episode_id)
    except ValueError as error:
        raise HTTPException(400, str(error)) from error


@router.post("/{job_id}/open/{kind}")
async def open_job_path(job_id: str, kind: str, body: OpenRequest, request: Request):
    job = request.app.state.store.get_job(job_id)
    if not job:
        raise HTTPException(404, "Завдання не знайдено.")
    try:
        target = resolve_job_path(job, kind, body.episode_id)
        await asyncio.to_thread(os.startfile, str(target))
    except FileNotFoundError as error:
        raise HTTPException(404, str(error)) from error
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
    except OSError as error:
        raise HTTPException(400, f"Не вдалося відкрити: {error}") from error
    return {"opened": True}
