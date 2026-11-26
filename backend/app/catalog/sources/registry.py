from __future__ import annotations

import asyncio
import re
from collections.abc import Awaitable, Callable
from urllib.parse import urlsplit
from uuid import uuid4

from app.catalog.models import Catalog, Episode
from app.catalog.url_security import normalize_source_url
from app.catalog.sources import uaflix, uakino
from app.catalog.sources.http import SourceHttp


ProgressCallback = Callable[[int, int], Awaitable[None]]


async def scan(raw_url: str, progress: ProgressCallback | None = None) -> Catalog:
    source = normalize_source_url(raw_url)
    http = SourceHttp()
    try:
        if source.site == "UAKINO":
            raw_title, items = await uakino.discover(source.canonical_url)
            title, season = uakino.title_and_season(raw_title)
            requested = re.search(
                r"-(\d+)-sezon(?:\.html)?/?$", urlsplit(source.canonical_url).path, re.I
            )
            if requested and season != int(requested.group(1)):
                found = f"{season} сезон" if season is not None else "інший матеріал"
                raise RuntimeError(
                    f"Посилання містить {requested.group(1)} сезон, але сайт відкрив {found}. "
                    "Відкрийте сторінку потрібного сезону на UAKINO й скопіюйте її повну адресу."
                )
            episodes = [uakino.episode_from_item(item, season) for item in items]
        else:
            title, season, episodes = await uaflix.discover(http, source.canonical_url)
        if not episodes:
            raise RuntimeError("Серії на сторінці не знайдено.")
        semaphore = asyncio.Semaphore(6)
        completed = 0

        async def inspect(episode: Episode) -> None:
            nonlocal completed
            async with semaphore:
                try:
                    episode.variants = await resolve_episode(
                        http, source.site, episode, source.canonical_url
                    )
                except Exception:
                    episode.variants = []
                completed += 1
                if progress:
                    await progress(completed, len(episodes))

        await asyncio.gather(*(inspect(episode) for episode in episodes))
        if not any(episode.variants for episode in episodes):
            raise RuntimeError(
                "Жоден відеопотік не відкрився. Спробуйте пізніше або перевірте сторінку сайту."
            )
        return Catalog(
            id=uuid4().hex,
            source_url=source.canonical_url,
            site=source.site,
            title=title,
            season=season,
            episodes=episodes,
        )
    finally:
        await http.close()


async def resolve_episode(http: SourceHttp, site: str, episode: Episode, page_url: str):
    if site == "UAKINO":
        return await uakino.resolve(http, episode.source_url, page_url)
    return await uaflix.resolve(http, episode.source_url)
