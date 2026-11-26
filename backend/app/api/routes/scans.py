from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.api.dependencies import require_token
from app.catalog.service import start_scan

router = APIRouter(prefix="/api/scans", dependencies=[Depends(require_token)])


class ScanRequest(BaseModel):
    url: str


@router.post("")
async def create_scan(request: ScanRequest, context: Request):
    return start_scan(request.url, context.app.state.store, context.app.state.events.publish)


@router.get("/{scan_id}")
async def get_scan(scan_id: str, request: Request):
    item = request.app.state.store.get_scan(scan_id)
    if not item:
        raise HTTPException(404, "Пошук не знайдено.")
    return item
