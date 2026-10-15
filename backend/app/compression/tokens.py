"""Exact token counting with tiktoken (graceful chars/4 fallback if unavailable)."""
from __future__ import annotations

import logging
import math
from functools import lru_cache
from typing import Optional

from ..config import get_settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=4)
def _get_encoding(name: str):
    try:
        import tiktoken

        return tiktoken.get_encoding(name)
    except Exception as exc:  # pragma: no cover - depends on environment
        logger.warning("tiktoken encoding '%s' unavailable (%s); using approximation.", name, exc)
        return None


def count_tokens(text: str, encoding_name: Optional[str] = None) -> int:
    """Return the exact number of tokens in ``text`` for the configured encoding."""
    if not text:
        return 0
    enc = _get_encoding(encoding_name or get_settings().tokenizer_encoding)
    if enc is None:
        return max(1, math.ceil(len(text) / 4))
    return len(enc.encode(text, disallowed_special=()))


def encoding_label() -> str:
    name = get_settings().tokenizer_encoding
    return name if _get_encoding(name) is not None else "approx (chars/4)"

