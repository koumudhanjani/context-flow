"""Stage 3 — Lexical compression.

Strips low-information filler while protecting entities, numbers, technical terms,
negations and query keywords. Three escalating levels are available:

* ``light``      – verbose phrases -> concise forms, hedge/intensifier words removed
* ``medium``     – + articles and weak connectives
* ``aggressive`` – + full English stop-word list (NLTK if available)

Code-looking lines and fenced code blocks are never modified.
"""
from __future__ import annotations

import logging
import re
from functools import lru_cache
from typing import FrozenSet, Iterable, List, Set, Tuple

logger = logging.getLogger(__name__)

LEVELS = ("light", "medium", "aggressive")

_PHRASES: List[Tuple[str, str]] = [
    (r"\bin order to\b", "to"),
    (r"\bdue to the fact that\b", "because"),
    (r"\bowing to the fact that\b", "because"),
    (r"\bin spite of the fact that\b", "although"),
    (r"\bdespite the fact that\b", "although"),
    (r"\bat this point in time\b", "now"),
    (r"\bat the present time\b", "now"),
    (r"\bfor the purpose of\b", "for"),
    (r"\bin the event that\b", "if"),
    (r"\bwith regard to\b", "about"),
    (r"\bwith respect to\b", "about"),
    (r"\bin relation to\b", "about"),
    (r"\bin terms of\b", "in"),
    (r"\ba large number of\b", "many"),
    (r"\ba number of\b", "several"),
    (r"\bthe majority of\b", "most"),
    (r"\bhas the ability to\b", "can"),
    (r"\bhave the ability to\b", "can"),
    (r"\b(is|are) able to\b", "can"),
    (r"\bprior to\b", "before"),
    (r"\bsubsequent to\b", "after"),
    (r"\bin close proximity to\b", "near"),
    (r"\bit is important to note that\s*", ""),
    (r"\bit should be noted that\s*", ""),
    (r"\bit is worth noting that\s*", ""),
    (r"\bplease note that\s*", ""),
    (r"\bas a matter of fact,?\s*", ""),
    (r"\bneedless to say,?\s*", ""),
    (r"\bat the end of the day,?\s*", ""),
    (r"\bfirst and foremost,?\s*", "first, "),
    (r"\bin conclusion,?\s*", ""),
    (r"\bto be honest,?\s*", ""),
    (r"\bas you can see,?\s*", ""),
]
_PHRASE_PATTERNS = [(re.compile(p, re.IGNORECASE), r) for p, r in _PHRASES]

_LIGHT: FrozenSet[str] = frozenset(
    """basically actually really very quite just simply literally totally definitely
    certainly obviously clearly essentially somewhat rather perhaps indeed truly
    extremely highly fairly pretty merely generally typically usually honestly
    absolutely completely entirely utterly""".split()
)
_MEDIUM_EXTRA: FrozenSet[str] = frozenset(
    "a an the that also then so well such various certain own furthermore moreover additionally thus hence therefore".split()
)

# Fallback copy of NLTK's English stop-word list (used if the corpus is not downloaded).
_BUILTIN_STOPWORDS: FrozenSet[str] = frozenset(
    """i me my myself we our ours ourselves you your yours yourself yourselves he him his
    himself she her hers herself it its itself they them their theirs themselves what which
    who whom this that these those am is are was were be been being have has had having do
    does did doing a an the and but if or because as until while of at by for with about
    against between into through during before after above below to from up down in out on
    off over under again further then once here there when where why how all any both each
    few more most other some such no nor not only own same so than too very s t can will just
    don should now d ll m o re ve y ain aren couldn didn doesn hadn hasn haven isn ma mightn
    mustn needn shan shouldn wasn weren won wouldn""".split()
)

# Words that carry logical meaning and must never be dropped.
_PROTECTED: FrozenSet[str] = frozenset(
    """not no nor never none nothing without except unless only but if than versus vs per
    before after above below more most less least all any each every few must should can
    cannot could would will may might between against from to who what when where why how
    which whom whose until while because""".split()
)

_WORD = re.compile(r"[A-Za-z][A-Za-z']*")
_CODE_LINE = re.compile(
    r"[{};=<>]|^\s*(def|class|import|from|function|const|let|var|return|public|private|#include|SELECT|INSERT)\b|`"
)
_CODE_FENCE = re.compile(r"(```[\s\S]*?```)")
_SPACE_BEFORE_PUNCT = re.compile(r"\s+([,.;:!?)\]])")
_DUP_PUNCT = re.compile(r"([,;:])\s*(?=[,;:.])")
_MULTI_SPACE = re.compile(r"[ \t]{2,}")
_LEADING_PUNCT = re.compile(r"^[ \t]*[,;:][ \t]*", re.MULTILINE)


@lru_cache()
def _stopwords() -> FrozenSet[str]:
    try:
        from nltk.corpus import stopwords

        words = frozenset(stopwords.words("english"))
        logger.info("Loaded %d NLTK stop-words.", len(words))
        return words
    except Exception:
        return _BUILTIN_STOPWORDS


def removable_words(level: str) -> FrozenSet[str]:
    if level == "light":
        return _LIGHT
    if level == "medium":
        return _LIGHT | _MEDIUM_EXTRA
    return _LIGHT | _MEDIUM_EXTRA | _stopwords()


def _match_case(src: str, repl: str) -> str:
    return repl[:1].upper() + repl[1:] if repl and src[:1].isupper() else repl


def _is_sentence_start(text: str, pos: int) -> bool:
    i = pos - 1
    while i >= 0 and text[i] in " \t\"'([":
        i -= 1
    return i < 0 or text[i] in ".!?\n:"


def _compress_line(line: str, remove: FrozenSet[str], keep: Set[str]) -> str:
    def repl(m: "re.Match[str]") -> str:
        word = m.group(0)
        lower = word.lower()
        if lower not in remove or lower in _PROTECTED or lower in keep:
            return word
        if lower.endswith("n't"):
            return word
        start, end = m.start(), m.end()
        prev_c = line[start - 1] if start > 0 else ""
        next_c = line[end] if end < len(line) else ""
        after_next = line[end + 1] if end + 1 < len(line) else ""
        if (prev_c and prev_c in "-_/@.") or (next_c and next_c in "-_/@"):
            return word  # part of a compound / technical token
        if next_c == "." and after_next.isalnum():
            return word  # e.g. file.ext, module.attr
        if len(word) > 1 and word.isupper() and lower not in {"a", "i"}:
            return word  # acronym
        if word[0].isupper() and not _is_sentence_start(line, m.start()):
            return word  # likely a named entity
        return ""

    out = _WORD.sub(repl, line)
    out = _MULTI_SPACE.sub(" ", out)
    out = _SPACE_BEFORE_PUNCT.sub(r"\1", out)
    out = _DUP_PUNCT.sub("", out)
    out = _LEADING_PUNCT.sub("", out)
    return out.strip()


def lexical_compress(text: str, level: str = "medium", query: str = "") -> str:
    """Apply lexical compression at the given ``level``."""
    if level not in LEVELS:
        raise ValueError(f"Unknown level '{level}'")
    remove = removable_words(level)
    keep = {w.lower() for w in _WORD.findall(query or "")}

    parts = _CODE_FENCE.split(text)
    out: List[str] = []
    for i, part in enumerate(parts):
        if i % 2 == 1:
            out.append(part)
            continue
        for pattern, replacement in _PHRASE_PATTERNS:
            part = pattern.sub(lambda m, r=replacement: _match_case(m.group(0), r), part)
        lines = []
        for line in part.split("\n"):
            lines.append(line if _CODE_LINE.search(line) else _compress_line(line, remove, keep))
        out.append("\n".join(lines))
    return re.sub(r"\n{3,}", "\n\n", "".join(out)).strip()


def available_levels() -> Iterable[str]:
    return LEVELS
