import asyncio

import httpx
import pytest

from app.catalog.models import Variant
from app.catalog.sources import registry, uaflix, uakino
from app.catalog.sources.http import SourceHttp


def variant() -> Variant:
    return Variant(
        label="960p",
        width=1920,
        height=960,
        bandwidth=1_000_000,
        duration_seconds=30,
        estimated_bytes=3_750_000,
        playlist_url="https://ashdi.vip/video/index.m3u8",
        referer="https://ashdi.vip/video",
    )


def test_uakino_scan_reports_progress_and_returns_resolved_episode(monkeypatch):
    class FakeHttp:
        async def close(self):
            pass

    async def discover(url):
        return "Детектив 4 сезон", [
            {"url": "https://ashdi.vip/vod/1", "number": "1", "voice": "Українська"}
        ]

    async def resolve(http, player_url, page_url):
        return [variant()]

    monkeypatch.setattr(registry, "SourceHttp", FakeHttp)
    monkeypatch.setattr(uakino, "discover", discover)
    monkeypatch.setattr(uakino, "resolve", resolve)
    progress = []

    async def run():
        async def report(done, total):
            progress.append((done, total))

        return await registry.scan(
            "https://uakino.best/seriesss/detective/123-4-sezon.html", report
        )

    catalog = asyncio.run(run())
    assert catalog.title == "Детектив"
    assert catalog.season == 4
    assert catalog.episodes[0].variants[0].width == 1920
    assert progress == [(1, 1)]


def test_uakino_scan_rejects_redirect_to_another_season(monkeypatch):
    class FakeHttp:
        async def close(self):
            pass

    async def discover(url):
        return "Детектив 3 сезон", [
            {"url": "https://ashdi.vip/vod/1", "number": "1", "voice": "Українська"}
        ]

    monkeypatch.setattr(registry, "SourceHttp", FakeHttp)
    monkeypatch.setattr(uakino, "discover", discover)
    with pytest.raises(RuntimeError, match="містить 4 сезон"):
        asyncio.run(registry.scan("https://uakino.best/seriesss/detective/123-4-sezon.html"))


def test_source_http_uses_browser_for_media_403(monkeypatch):
    source = SourceHttp()
    source.client = httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(403))
    )

    async def browser_text(url, referer):
        assert url == "https://ashdi.vip/video"
        return "#EXTM3U"

    monkeypatch.setattr(source, "_browser_text", browser_text)

    async def run():
        try:
            return await source.get_text("https://ashdi.vip/video", kind="media")
        finally:
            await source.close()

    assert asyncio.run(run()) == "#EXTM3U"


def test_source_http_rejects_redirect_to_unapproved_host():
    source = SourceHttp()
    source.client = httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(302, headers={"location": "https://example.com/secret"})
        )
    )

    async def run():
        try:
            with pytest.raises(ValueError, match="не підтримується"):
                await source.get_text("https://ashdi.vip/video", kind="media")
        finally:
            await source.close()

    asyncio.run(run())


def test_uaflix_series_page_discovers_only_requested_season():
    class FakeHttp:
        async def get_text(self, url, *, kind, referer=None):
            return (
                "<h1>Детектив 4 сезон дивитись онлайн</h1>"
                '<a href="/serials/detektyv/season-04-episode-01/">1</a>'
                '<a href="/serials/detektyv/season-04-episode-02/">2</a>'
                '<a href="/serials/detektyv/season-03-episode-01/">старий</a>'
            )

    title, season, episodes = asyncio.run(
        uaflix.discover(FakeHttp(), "https://uafix.net/serials/detektyv/season-04-episode-01/")
    )
    assert title == "Детектив"
    assert season == 4
    assert [episode.number for episode in episodes] == [1, 2]


def test_uaflix_resolves_player_and_playlist(monkeypatch):
    calls = []

    class FakeHttp:
        async def get_text(self, url, *, kind, referer=None):
            calls.append((url, kind, referer))
            if kind == "page":
                return '<iframe src="https://zetvideo.net/vod/123"></iframe>'
            return "file: 'https://zetvideo.net/hls/master.m3u8'"

    async def inspect(http, url, referer):
        calls.append((url, "playlist", referer))
        return [variant()]

    monkeypatch.setattr(uaflix, "inspect_master", inspect)
    result = asyncio.run(uaflix.resolve(FakeHttp(), "https://uafix.net/films/test/"))
    assert result[0].label == "960p"
    assert calls[-1] == (
        "https://zetvideo.net/hls/master.m3u8",
        "playlist",
        "https://zetvideo.net/vod/123",
    )


def test_uakino_browser_retry_and_player_resolution(monkeypatch):
    calls = []

    def read_browser(url, *, headless):
        calls.append(headless)
        return "Детектив 4 сезон", [] if headless else [
            {"url": "https://ashdi.vip/vod/1", "number": "1", "voice": "Українська"}
        ]

    monkeypatch.setattr(uakino, "_read_browser", read_browser)
    title, items = asyncio.run(uakino.discover("https://uakino.best/show.html"))
    assert title == "Детектив 4 сезон"
    assert len(items) == 1
    assert calls == [True, False]

    class FakeHttp:
        async def get_text(self, url, *, kind, referer=None):
            return "file: 'https://ashdi.vip/hls/master.m3u8'"

    async def inspect(http, url, referer):
        assert url == "https://ashdi.vip/hls/master.m3u8"
        return [variant()]

    monkeypatch.setattr(uakino, "inspect_master", inspect)
    assert (
        asyncio.run(
            uakino.resolve(FakeHttp(), "https://ashdi.vip/vod/1", "https://uakino.best/show.html")
        )[0].height
        == 960
    )
