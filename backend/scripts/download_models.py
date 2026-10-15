"""Pre-download all model artefacts so the API works offline and starts fast.

Usage (from /backend with the venv active):
    python scripts/download_models.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import get_settings  # noqa: E402


def main() -> None:
    s = get_settings()

    print("1/3  NLTK stop-words ...")
    import nltk

    nltk.download("stopwords", quiet=True)

    print(f"2/3  tiktoken encoding '{s.tokenizer_encoding}' ...")
    import tiktoken

    tiktoken.get_encoding(s.tokenizer_encoding).encode("hello world")

    print(f"3/3  Embedding model '{s.embedding_model}' ...")
    from sentence_transformers import SentenceTransformer

    SentenceTransformer(s.embedding_model).encode(["hello world"])

    print("All models ready.")


if __name__ == "__main__":
    main()

