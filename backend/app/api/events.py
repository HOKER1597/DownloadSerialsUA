from __future__ import annotations

from fastapi import WebSocket


class EventHub:
    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()

    async def publish(self, payload: dict) -> None:
        for client in list(self.clients):
            try:
                await client.send_json(payload)
            except Exception:
                self.clients.discard(client)
