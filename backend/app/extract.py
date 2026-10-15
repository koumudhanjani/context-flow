"""Text extraction from uploaded .pdf / .txt / .md files."""
from __future__ import annotations

import io
import logging
from typing import Optional, Tuple

from fastapi import HTTPException

from .config import get_settings

logger = logging.getLogger(__name__)

TEXT_EXTENSIONS = (".txt", ".md", ".markdown", ".csv", ".log", ".json")


def _decode(data: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-16", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def _extract_pdf(data: bytes) -> Tuple[str, int]:
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        reader = PdfReader(io.BytesIO(data))
    except PdfReadError as exc:
        raise HTTPException(status_code=422, detail=f"Could not read PDF: {exc}") from exc

    if reader.is_encrypted:
        try:
            reader.decrypt("")
        except Exception as exc:
            raise HTTPException(status_code=422, detail="PDF is password-protected.") from exc

    max_pages = get_settings().max_pdf_pages
    pages = []
    for i, page in enumerate(reader.pages):
        if i >= max_pages:
            logger.info("PDF truncated at %d pages", max_pages)
            break
        try:
            pages.append(page.extract_text() or "")
        except Exception as exc:  # malformed page - skip, don't fail the whole doc
            logger.warning("Failed to extract page %d: %s", i, exc)
    text = "\n\n".join(pages).strip()
    if not text:
        raise HTTPException(
            status_code=422,
            detail="No extractable text found (the PDF may be scanned images; OCR is not supported).",
        )
    return text, len(reader.pages)


def extract_text(filename: str, content_type: Optional[str], data: bytes) -> Tuple[str, Optional[int]]:
    name = (filename or "").lower()
    if name.endswith(".pdf") or content_type == "application/pdf":
        return _extract_pdf(data)
    if name.endswith(TEXT_EXTENSIONS) or (content_type or "").startswith("text/"):
        return _decode(data), None
    raise HTTPException(status_code=415, detail="Unsupported file type. Upload a .pdf, .txt or .md file.")

