from __future__ import annotations

from app.catalog.models import Variant


def select_variant(variants: list[Variant], quality: str) -> Variant | None:
    if quality == "max":
        return max(
            variants, key=lambda item: (item.height, item.width, item.bandwidth), default=None
        )
    if quality.startswith("w") and quality[1:].isdigit():
        width = int(quality[1:])
        return max(
            (item for item in variants if item.width == width),
            key=lambda item: (item.height, item.bandwidth),
            default=None,
        )
    return next((item for item in variants if item.label == quality), None)
