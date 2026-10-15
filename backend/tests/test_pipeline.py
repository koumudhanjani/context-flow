"""Unit tests for the compression engine (run: pytest -q)."""
from app.compression.cleanup import clean_text
from app.compression.lexical import lexical_compress
from app.compression.pipeline import compress
from app.compression.semantic import chunk_text

DOC = """
Page 1

The   Apollo 11 mission   landed on the Moon on July 20, 1969. Neil Armstrong
and Buzz Aldrin spent about 21 hours on the lunar surface.

-----------

It is important to note that the Saturn V rocket was basically the most powerful
rocket ever flown at that time, producing 7.5 million pounds of thrust.

Bananas are a very popular fruit and they are really rich in potassium.
Many people actually eat bananas for breakfast every single day.

Page 2
"""


def test_cleanup_removes_noise_and_joins_lines():
    cleaned, stats = clean_text(DOC)
    assert "Page 1" not in cleaned
    assert "-----" not in cleaned
    assert "  " not in cleaned
    assert "Neil Armstrong and Buzz Aldrin" in cleaned
    assert stats["noise_lines_removed"] >= 3


def test_lexical_preserves_entities_numbers_and_negations():
    text = "The Saturn V rocket was basically not the 7.5 million pound GPT-4 model in order to fly."
    out = lexical_compress(text, "aggressive")
    for keep in ("Saturn", "V", "7.5", "GPT-4", "not"):
        assert keep in out
    assert "basically" not in out
    assert "in order to" not in out


def test_chunking_respects_budget():
    chunks = chunk_text(clean_text(DOC)[0], max_tokens=40)
    assert len(chunks) >= 2


def test_pipeline_is_query_aware_and_saves_tokens():
    result = compress(DOC * 3, query="How much thrust did the Saturn V produce?", target_ratio=0.6, chunk_tokens=40)
    m = result["metrics"]
    assert m["compressed_tokens"] < m["original_tokens"]
    assert m["saved_pct"] > 30
    assert "7.5" in result["compressed_text"]
    assert [s["key"] for s in result["stages"]] == ["cleanup", "semantic", "lexical"]

