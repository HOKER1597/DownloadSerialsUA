from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.api.dependencies import require_token
from app.system.folders import choose_folder, default_downloads_folder

router = APIRouter(prefix="/api/folder", dependencies=[Depends(require_token)])


class FolderRequest(BaseModel):
    path: str = ""


@router.get("")
async def get_folder(request: Request):
    return {"path": request.app.state.store.get_setting("output_dir") or default_downloads_folder()}


@router.put("")
async def save_folder(body: FolderRequest, request: Request):
    path = body.path.strip()
    request.app.state.store.set_setting("output_dir", path)
    return {"path": path}


@router.post("/select")
async def select_folder(body: FolderRequest, request: Request):
    path = await choose_folder(body.path)
    if path:
        request.app.state.store.set_setting("output_dir", path)
    return {"path": path}
