"""Orchestrates the 3-stage compression pipeline with an adaptive token budget."""
from __future__ import annotations

import math
import time
from typing import Dict, List, Optional

from .cleanup import clean_text
from .lexical import LEVELS, lexical_compress
from .semantic import embedder, semantic_prune
from .tokens import count_tokens, encoding_label

MAX_CHUNKS_RETURNED = 400


def _ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 1)


def compress(
    text: str,
    query: str = "",
    target_ratio: float = 0.5,
    chunk_tokens: int = 128,
    enable_semantic: bool = True,
    enable_lexical: bool = True,
    min_similarity: Optional[float] = None,
) -> Dict:
    """Compress ``text`` so that roughly ``target_ratio`` of its tokens are removed.

    ``target_ratio`` is the fraction of tokens to *remove* (0.5 => keep ~50%).
    """
    t_total = time.perf_counter()
    stages: List[Dict] = []

    original_tokens = count_tokens(text)
    target_tokens = max(1, math.ceil(original_tokens * (1.0 - target_ratio)))

    # ---- Stage 1: cleanup ------------------------------------------------------
    t0 = time.perf_counter()
    cleaned, clean_stats = clean_text(text)
    cleaned_tokens = count_tokens(cleaned)
    stages.append(
        {
            "key": "cleanup",
            "name": "Cleanup",
            "tokens_in": original_tokens,
            "tokens_out": cleaned_tokens,
            "ms": _ms(t0),
            "details": clean_stats,
        }
    )
    current, current_tokens = cleaned, cleaned_tokens

    # Estimate how much Stage 3 will remove so Stage 2 isn't more destructive than needed.
    lexical_keep_ratio = 1.0
    if enable_lexical and current_tokens:
        sample = current[:20000]
        sample_tokens = count_tokens(sample) or 1
        lexical_keep_ratio = max(0.5, count_tokens(lexical_compress(sample, "medium", query)) / sample_tokens)

    # ---- Stage 2: semantic pruning --------------------------------------------
    chunks: List[Dict] = []
    embedding_backend = "disabled"
    if enable_semantic and current_tokens:
        t0 = time.perf_counter()
        budget = max(1, int(target_tokens / lexical_keep_ratio))
        pruned = semantic_prune(current, query, budget, chunk_tokens, min_similarity)
        chunks = pruned["chunks"]
        embedding_backend = pruned["backend"]
        new_tokens = count_tokens(pruned["text"])
        stages.append(
            {
                "key": "semantic",
                "name": "Semantic Pruning",
                "tokens_in": current_tokens,
                "tokens_out": new_tokens,
                "ms": _ms(t0),
                "details": {
                    "chunks_total": len(chunks),
                    "chunks_kept": sum(1 for c in chunks if c["kept"]),
                    "token_budget": budget,
                    "backend": embedding_backend,
                    "query_aware": bool(query.strip()),
                },
            }
        )
        current, current_tokens = pruned["text"], new_tokens

    # ---- Stage 3: lexical compression -----------------------------------------
    lexical_level = "disabled"
    if enable_lexical and current_tokens:
        t0 = time.perf_counter()
        candidate, candidate_tokens = current, current_tokens
        tried: Dict[str, int] = {}
        for level in LEVELS:
            candidate = lexical_compress(current, level, query)
            candidate_tokens = count_tokens(candidate)
            tried[level] = candidate_tokens
            lexical_level = level
            if candidate_tokens <= target_tokens:
                break
        stages.append(
            {
                "key": "lexical",
                "name": "Lexical Compression",
                "tokens_in": current_tokens,
                "tokens_out": candidate_tokens,
                "ms": _ms(t0),
                "details": {"level": lexical_level, "tokens_by_level": tried},
            }
        )
        current, current_tokens = candidate, candidate_tokens

    saved = max(0, original_tokens - current_tokens)
    return {
        "compressed_text": current,
        "metrics": {
            "original_tokens": original_tokens,
            "compressed_tokens": current_tokens,
            "target_tokens": target_tokens,
            "saved_tokens": saved,
            "saved_pct": round(100.0 * saved / original_tokens, 2) if original_tokens else 0.0,
            "compression_ratio": round(original_tokens / current_tokens, 2) if current_tokens else 0.0,
            "target_met": current_tokens <= target_tokens,
            "original_chars": len(text),
            "compressed_chars": len(current),
        },
        "stages": stages,
        "chunks": chunks[:MAX_CHUNKS_RETURNED],
        "embedding_backend": embedding_backend if enable_semantic else embedder.status,
        "lexical_level": lexical_level,
        "encoding": encoding_label(),
        "elapsed_ms": _ms(t_total),
    }

