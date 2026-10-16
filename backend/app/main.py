"""ContextFlow FastAPI application."""
from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from . import __version__
from .auth import get_current_user
from .compression.pipeline import compress
from .compression.semantic import embedder
from .compression.tokens import count_tokens, encoding_label
from .config import get_settings
from .extract import extract_text
from .llm import available_providers, run_llm
from .schemas import (
    CompressRequest,
    CompressResponse,
    ExtractResponse,
    LLMTestRequest,
    LLMTestResponse,
    TokenCountRequest,
    TokenCountResponse,
)

settings = get_settings()
logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("contextflow")


def _warmup() -> None:
    try:
        count_tokens("warmup")
        embedder.load()
    except Exception as exc:  # pragma: no cover
        logger.warning("Warm-up failed: %s", exc)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.warmup_on_startup:
        threading.Thread(target=_warmup, daemon=True).start()
    yield


app = FastAPI(
    title="ContextFlow API",
    version=__version__,
    description="AI context & prompt compression: cleanup -> semantic pruning -> lexical compression.",
    lifespan=lifespan,
)
app.add_middleware(GZipMiddleware, minimum_size=1024)
_wildcard_cors = "*" in settings.allowed_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _wildcard_cors else settings.allowed_origins,
    allow_credentials=not _wildcard_cors,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "version": __version__,
        "embedding_backend": embedder.status,
        "encoding": encoding_label(),
        "providers": available_providers(),
        "auth_required": settings.auth_required,
    }


@app.post("/api/tokens", response_model=TokenCountResponse)
def tokens(req: TokenCountRequest, _user: Optional[dict] = Depends(get_current_user)):
    if len(req.text) > settings.max_input_chars:
        raise HTTPException(413, "Text too large")
    return {"tokens": count_tokens(req.text), "chars": len(req.text), "encoding": encoding_label()}


@app.post("/api/extract", response_model=ExtractResponse)
async def extract(file: UploadFile = File(...), _user: Optional[dict] = Depends(get_current_user)):
    limit = settings.max_upload_mb * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, f"File exceeds {settings.max_upload_mb} MB limit")
    if not data:
        raise HTTPException(422, "Uploaded file is empty")

    text, pages = await run_in_threadpool(extract_text, file.filename or "", file.content_type, data)
    if len(text) > settings.max_input_chars:
        text = text[: settings.max_input_chars]
    tokens_ = await run_in_threadpool(count_tokens, text)
    return {"filename": file.filename or "upload", "text": text, "pages": pages, "chars": len(text), "tokens": tokens_}


@app.post("/api/compress", response_model=CompressResponse)
def compress_endpoint(req: CompressRequest, _user: Optional[dict] = Depends(get_current_user)):
    if len(req.text) > settings.max_input_chars:
        raise HTTPException(413, f"Input exceeds {settings.max_input_chars:,} characters")
    return compress(
        text=req.text,
        query=req.query,
        target_ratio=req.target_ratio,
        chunk_tokens=req.chunk_tokens,
        enable_semantic=req.enable_semantic,
        enable_lexical=req.enable_lexical,
        min_similarity=req.min_similarity,
    )


@app.post("/api/llm/test", response_model=LLMTestResponse)
async def llm_test(req: LLMTestRequest, _user: Optional[dict] = Depends(get_current_user)):
    return await run_llm(req.provider, req.prompt, req.query, req.model)

