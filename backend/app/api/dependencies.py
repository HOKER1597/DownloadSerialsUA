from __future__ import annotations

import secrets

from fastapi import Header, HTTPException, Request


def require_token(request: Request, x_app_token: str | None = Header(default=None)) -> None:
    if not secrets.compare_digest(x_app_token or "", request.app.state.token):
        raise HTTPException(401, "Відкрийте застосунок через його локальну адресу запуску.")
