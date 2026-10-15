"""Stage 2 — Query-aware semantic pruning.

1. Split the cleaned text into token-bounded chunks (paragraph -> sentence -> word windows).
2. Embed chunks and the user query with sentence-transformers.
3. Score every chunk by cosine similarity to the query (or to the document centroid
   when no query is given, which approximates "salience").
4. Greedily keep the highest-scoring chunks until the token budget is spent, then
   restore original document order so the prompt still reads naturally.

If sentence-transformers/torch cannot be loaded, a pure-Python TF-IDF scorer is used.
"""
from __future__ import annotations

import logging
import math
import re
import threading
from collections import Counter
from typing import Dict, List, Optional, Sequence, Tuple

from ..config import get_settings
from .tokens import count_tokens

logger = logging.getLogger(__name__)

_PARA_SPLIT = re.compile(r"\n\s*\n")
_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[\"'(\[]?[A-Z0-9])")
_WORD = re.compile(r"[A-Za-z0-9_]+")


# --------------------------------------------------------------------------- chunking
def split_sentences(paragraph: str) -> List[str]:
    return [s.strip() for s in _SENT_SPLIT.split(paragraph.strip()) if s.strip()]


def _word_windows(text: str, max_tokens: int) -> List[str]:
    words = text.split()
    # ~0.75 words per token is a good heuristic for English.
    size = max(16, int(max_tokens * 0.75))
    return [" ".join(words[i : i + size]) for i in range(0, len(words), size)]


def chunk_text(text: str, max_tokens: int = 128) -> List[str]:
    """Split ``text`` into chunks of at most ~``max_tokens`` tokens on natural boundaries."""
    chunks: List[str] = []
    buf = ""
    buf_tokens = 0

    def flush() -> None:
        nonlocal buf, buf_tokens
        if buf.strip():
            chunks.append(buf.strip())
        buf, buf_tokens = "", 0

    def add(piece: str, sep: str, tokens: int) -> None:
        nonlocal buf, buf_tokens
        if buf and buf_tokens + tokens > max_tokens:
            flush()
        buf = f"{buf}{sep}{piece}" if buf else piece
        buf_tokens += tokens

    for para in _PARA_SPLIT.split(text):
        para = para.strip()
        if not para:
            continue
        p_tokens = count_tokens(para)
        if p_tokens <= max_tokens:
            add(para, "\n\n", p_tokens)
            continue
        flush()
        for sent in split_sentences(para):
            s_tokens = count_tokens(sent)
            if s_tokens > max_tokens * 2:
                for window in _word_windows(sent, max_tokens):
                    add(window, " ", count_tokens(window))
            else:
                add(sent, " ", s_tokens)
        flush()
    flush()
    return chunks


# --------------------------------------------------------------------------- embedder
class Embedder:
    """Lazily loads a sentence-transformers model exactly once (thread-safe)."""

    def __init__(self) -> None:
        self._model = None
        self._failed = False
        self._lock = threading.Lock()

    @property
    def status(self) -> str:
        if self._model is not None:
            return "sentence-transformers"
        if self._failed:
            return "tfidf-fallback"
        return "not-loaded"

    def load(self):
        if self._model is not None or self._failed:
            return self._model
        with self._lock:
            if self._model is None and not self._failed:
                name = get_settings().embedding_model
                try:
                    from sentence_transformers import SentenceTransformer

                    logger.info("Loading embedding model %s ...", name)
                    self._model = SentenceTransformer(name)
                    logger.info("Embedding model ready.")
                except Exception as exc:  # pragma: no cover - environment dependent
                    logger.warning("sentence-transformers unavailable (%s); using TF-IDF.", exc)
                    self._failed = True
        return self._model

    def score(self, chunks: Sequence[str], query: str) -> Tuple[List[float], str]:
        model = self.load()
        if model is None:
            return _tfidf_scores(chunks, query), "tfidf-fallback"

        import numpy as np

        emb = model.encode(
            list(chunks),
            batch_size=32,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )
        if query.strip():
            q = model.encode([query], normalize_embeddings=True, convert_to_numpy=True)[0]
        else:
            q = emb.mean(axis=0)
            norm = float(np.linalg.norm(q)) or 1.0
            q = q / norm
        return [float(s) for s in emb @ q], "sentence-transformers"


embedder = Embedder()


def _tfidf_scores(chunks: Sequence[str], query: str) -> List[float]:
    docs = [Counter(w.lower() for w in _WORD.findall(c)) for c in chunks]
    n = len(docs)
    df: Counter = Counter()
    for d in docs:
        df.update(d.keys())
    idf = {w: math.log((1 + n) / (1 + c)) + 1.0 for w, c in df.items()}

    def vec(counter: Counter) -> Dict[str, float]:
        v = {w: tf * idf.get(w, 1.0) for w, tf in counter.items()}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        return {w: x / norm for w, x in v.items()}

    vecs = [vec(d) for d in docs]
    if query.strip():
        qv = vec(Counter(w.lower() for w in _WORD.findall(query)))
    else:
        centroid: Counter = Counter()
        for v in vecs:
            centroid.update(v)
        qv = vec(centroid)
    return [sum(x * qv.get(w, 0.0) for w, x in v.items()) for v in vecs]


# --------------------------------------------------------------------------- selection
def semantic_prune(
    text: str,
    query: str,
    token_budget: int,
    chunk_tokens: int = 128,
    min_similarity: Optional[float] = None,
) -> Dict:
    """Keep the most query-relevant chunks within ``token_budget`` tokens."""
    chunks = chunk_text(text, chunk_tokens)
    if not chunks:
        return {"text": "", "chunks": [], "backend": embedder.status}

    token_counts = [count_tokens(c) for c in chunks]
    scores, backend = embedder.score(chunks, query)

    order = sorted(range(len(chunks)), key=lambda i: scores[i], reverse=True)
    kept = set()
    used = 0
    for i in order:
        if min_similarity is not None and kept and scores[i] < min_similarity:
            continue
        if not kept or used + token_counts[i] <= token_budget:
            kept.add(i)
            used += token_counts[i]

    kept_text = "\n\n".join(chunks[i] for i in range(len(chunks)) if i in kept)
    chunk_info = [
        {
            "index": i,
            "score": round(scores[i], 4),
            "tokens": token_counts[i],
            "kept": i in kept,
            "preview": chunks[i][:160],
        }
        for i in range(len(chunks))
    ]
    return {"text": kept_text, "chunks": chunk_info, "backend": backend}

