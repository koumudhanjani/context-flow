"""Stage 1 — Cleanup.

Removes excessive whitespace, broken formatting (PDF hyphenation / hard line wraps),
page numbers, decorative rules, repeated headers/footers and duplicate paragraphs.
Fenced code blocks (```...```) are preserved verbatim.
"""
from __future__ import annotations

import re
import unicodedata
from collections import Counter
from typing import Dict, List, Tuple

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u200b-\u200f\u2028\u2029\u2060\ufeff]")
_HYPHEN_BREAK = re.compile(r"(\w)-\n\s*(\w)")
_PAGE_NUM = re.compile(r"^\s*(page\s*)?\d{1,4}(\s*(of|/)\s*\d{1,4})?\s*$", re.IGNORECASE)
_RULE_LINE = re.compile(r"^\s*([-=_*~#.\u00b7\u2022])\1{2,}\s*$")
_MULTI_SPACE = re.compile(r"[ \t\u00a0\u2000-\u200a\u3000]+")
_MULTI_NL = re.compile(r"\n{3,}")
_MANY_DOTS = re.compile(r"\.{4,}")
_REPEAT_PUNCT = re.compile(r"([!?,;:])\1+")
_CODE_FENCE = re.compile(r"(```[\s\S]*?```)")
_BULLET = re.compile(r"^\s*([-*\u2022\u25aa\u25cf>]|\d+[.)]|[a-zA-Z][.)])\s+")
_SENT_END = re.compile(r"[.!?:;\"')\]]$")

_QUOTE_MAP = str.maketrans(
    {
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2013": "-",
        "\u2014": " - ",
        "\u2212": "-",
    }
)


def _clean_segment(text: str, stats: Dict[str, int]) -> str:
    text = _HYPHEN_BREAK.sub(r"\1\2", text)
    text = _MANY_DOTS.sub("...", text)
    text = _REPEAT_PUNCT.sub(r"\1", text)

    lines = [_MULTI_SPACE.sub(" ", line).strip() for line in text.split("\n")]

    # Repeated short lines across a long document are almost always headers/footers.
    repeated = set()
    if len(lines) >= 40:
        counts = Counter(l for l in lines if l and len(l) <= 60 and not _BULLET.match(l))
        repeated = {l for l, c in counts.items() if c >= 3}

    kept: List[str] = []
    for line in lines:
        if line and (_PAGE_NUM.match(line) or _RULE_LINE.match(line) or line in repeated):
            stats["noise_lines_removed"] += 1
            continue
        kept.append(line)

    # Re-join hard-wrapped lines (common in PDF extraction).
    merged: List[str] = []
    for line in kept:
        if (
            merged
            and line
            and merged[-1]
            and not _SENT_END.search(merged[-1])
            and not _BULLET.match(line)
            and (line[0].islower() or line[0].isdigit())
        ):
            merged[-1] = f"{merged[-1]} {line}"
            stats["lines_joined"] += 1
        else:
            merged.append(line)

    # Drop consecutive duplicate paragraphs.
    paragraphs = re.split(r"\n\s*\n", "\n".join(merged))
    deduped: List[str] = []
    seen_recent: List[str] = []
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        key = para.lower()
        if key in seen_recent:
            stats["duplicate_paragraphs_removed"] += 1
            continue
        deduped.append(para)
        seen_recent = (seen_recent + [key])[-5:]

    return "\n\n".join(deduped)


def clean_text(text: str) -> Tuple[str, Dict[str, int]]:
    """Normalise and de-noise ``text``. Returns (clean_text, stats)."""
    stats = {
        "chars_before": len(text),
        "noise_lines_removed": 0,
        "lines_joined": 0,
        "duplicate_paragraphs_removed": 0,
    }
    t = unicodedata.normalize("NFKC", text)
    t = t.translate(_QUOTE_MAP)
    t = t.replace("\r\n", "\n").replace("\r", "\n").replace("\f", "\n\n")
    t = _CONTROL.sub("", t)

    parts = _CODE_FENCE.split(t)
    out = []
    for i, part in enumerate(parts):
        if i % 2 == 1:  # fenced code block -> keep verbatim
            out.append(part.strip("\n"))
        else:
            cleaned = _clean_segment(part, stats)
            if cleaned:
                out.append(cleaned)

    result = _MULTI_NL.sub("\n\n", "\n\n".join(out)).strip()
    stats["chars_after"] = len(result)
    return result, stats

