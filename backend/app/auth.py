"""Optional Firebase ID-token verification.

The frontend sends ``Authorization: Bearer <Firebase ID token>`` on every request.
When ``AUTH_REQUIRED=true`` the backend verifies the token against Google's public
certificates (no service-account key needed — only the Firebase project ID).
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import Header, HTTPException, status

from .config import get_settings

logger = logging.getLogger(__name__)
_request = None


def _google_request():
    global _request
    if _request is None:
        from google.auth.transport import requests as google_requests

        _request = google_requests.Request()
    return _request


def get_current_user(authorization: Optional[str] = Header(default=None)) -> Optional[dict]:
    settings = get_settings()

    if not authorization or not authorization.lower().startswith("bearer "):
        if settings.auth_required:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
        return None

    token = authorization.split(" ", 1)[1].strip()
    try:
        from google.oauth2 import id_token

        claims = id_token.verify_firebase_token(
            token,
            _google_request(),
            audience=settings.firebase_project_id or None,
            clock_skew_in_seconds=10,
        )
        return claims
    except Exception as exc:
        if settings.auth_required:
            logger.info("Rejected token: %s", exc)
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from exc
        return None

