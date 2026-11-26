from __future__ import annotations

import asyncio
import os

import httpx
from playwright.async_api import async_playwright
from urllib.parse import urljoin

from app.catalog.url_security import validate_url

BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


class SourceHttp:
    def __init__(self) -> None:
        self.client = httpx.AsyncClient(
            timeout=25, follow_redirects=False, headers={"User-Agent": BROWSER_USER_AGENT}
        )
        self._browser_lock = asyncio.Lock()
        self._playwright = None
        self._browser = None
        self._browser_context = None

    async def close(self) -> None:
        await self.client.aclose()
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()

    async def _browser_text(self, url: str, referer: str | None) -> str:
        async with self._browser_lock:
            if not self._browser_context:
                self._playwright = await async_playwright().start()
                try:
                    channel = "chromium" if os.environ.get("PLAYWRIGHT_BROWSERS_PATH") else "msedge"
                    self._browser = await self._playwright.chromium.launch(
                        channel=channel, headless=True
                    )
                    self._browser_context = await self._browser.new_context()
                except Exception:
                    await self._playwright.stop()
                    self._playwright = None
                    raise
        response = await self._browser_context.request.get(
            url, headers={"Referer": referer} if referer else None, timeout=25000
        )
        validate_url(response.url, kind="media")
        if not response.ok:
            raise RuntimeError(f"Плеєр повернув HTTP {response.status}.")
        return await response.text()

    async def get_text(self, url: str, *, kind: str, referer: str | None = None) -> str:
        current = validate_url(url, kind=kind)
        for _ in range(6):
            response = await self.client.get(
                current, headers={"Referer": referer} if referer else None
            )
            if response.status_code in (301, 302, 303, 307, 308):
                current = validate_url(urljoin(current, response.headers["location"]), kind=kind)
                continue
            if response.status_code == 403 and kind == "media":
                return await self._browser_text(current, referer)
            response.raise_for_status()
            return response.text
        raise ValueError("Забагато переадресацій від відеосервісу.")
