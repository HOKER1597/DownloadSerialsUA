from __future__ import annotations

import secrets

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


@router.websocket("/api/events")
async def events(websocket: WebSocket) -> None:
    if not secrets.compare_digest(
        websocket.query_params.get("token", ""), websocket.app.state.token
    ):
        await websocket.close(code=1008)
        return
    await websocket.accept()
    clients = websocket.app.state.events.clients
    clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        clients.discard(websocket)
