"""Centralised, environment-driven configuration for the ContextFlow API."""
from __future__ import annotations

import os
from functools import lru_cache
from typing import List

from dotenv import load_dotenv

load_dotenv()


def _bool(value: str | None, default: bool = False) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _list(value: str | None, default: str) -> List[str]:
    raw = value if value else default
    return [item.strip() for item in raw.split(",") if item.strip()]


class Settings:
    """Plain settings object (kept dependency-free on purpose)."""

    def __init__(self) -> None:
        # --- Server -----------------------------------------------------------
        self.environment: str = os.getenv("ENVIRONMENT", "development")
        self.log_level: str = os.getenv("LOG_LEVEL", "INFO").upper()
        self.allowed_origins: List[str] = _list(
            os.getenv("ALLOWED_ORIGINS"), "http://localhost:5173,http://127.0.0.1:5173"
        )
        self.warmup_on_startup: bool = _bool(os.getenv("WARMUP_ON_STARTUP"), True)

        # --- Auth (Firebase ID-token verification) ----------------------------
        self.auth_required: bool = _bool(os.getenv("AUTH_REQUIRED"), False)
        self.firebase_project_id: str = os.getenv("FIREBASE_PROJECT_ID", "")

        # --- LLM providers ----------------------------------------------------
        self.gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
        self.gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        self.groq_api_key: str = os.getenv("GROQ_API_KEY", "")
        self.groq_model: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        self.llm_timeout_seconds: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "60"))
        self.llm_max_output_tokens: int = int(os.getenv("LLM_MAX_OUTPUT_TOKENS", "1024"))

        # --- NLP / compression ------------------------------------------------
        self.embedding_model: str = os.getenv(
            "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
        )
        self.tokenizer_encoding: str = os.getenv("TOKENIZER_ENCODING", "o200k_base")

        # --- Limits -----------------------------------------------------------
        self.max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "20"))
        self.max_input_chars: int = int(os.getenv("MAX_INPUT_CHARS", "2000000"))
        self.max_pdf_pages: int = int(os.getenv("MAX_PDF_PAGES", "500"))


@lru_cache()
def get_settings() -> Settings:
    return Settings()

