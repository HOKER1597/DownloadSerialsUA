from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from uuid import uuid4

from app.catalog.models import ScanState
from app.catalog.sources.registry import scan as scan_source
from app.storage.sqlite import Store

Publish = Callable[[dict], Awaitable[None]]


def start_scan(url: str, store: Store, publish: Publish) -> ScanState:
    item = ScanState(id=uuid4().hex)
    store.save_scan(item)

    async def run() -> None:
        try:

            async def progress(done: int, total: int) -> None:
                item.done, item.total = done, total
                item.message = f"Перевіряємо якість: {done}/{total}"
                store.save_scan(item)
                await publish({"type": "scan", "scan": item.model_dump(mode="json")})

            catalog = await scan_source(url, progress)
            item.catalog = catalog
            item.status = "complete"
            item.message = f"Знайдено {len(catalog.episodes)} серій"
        except Exception as error:
            item.status = "failed"
            item.error = str(error)
            item.message = "Пошук не вдався"
        store.save_scan(item)
        await publish({"type": "scan", "scan": item.model_dump(mode="json")})

    asyncio.create_task(run())
    return item
