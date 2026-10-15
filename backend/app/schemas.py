"""Request / response schemas."""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class CompressRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Raw document / prompt text")
    query: str = Field("", max_length=4000, description="User question used for query-aware pruning")
    target_ratio: float = Field(0.5, ge=0.0, le=0.95, description="Fraction of tokens to remove")
    chunk_tokens: int = Field(128, ge=32, le=1024)
    enable_semantic: bool = True
    enable_lexical: bool = True
    min_similarity: Optional[float] = Field(None, ge=-1.0, le=1.0)


class StageResult(BaseModel):
    key: str
    name: str
    tokens_in: int
    tokens_out: int
    ms: float
    details: Dict[str, Any] = {}


class ChunkInfo(BaseModel):
    index: int
    score: float
    tokens: int
    kept: bool
    preview: str


class CompressResponse(BaseModel):
    compressed_text: str
    metrics: Dict[str, Any]
    stages: List[StageResult]
    chunks: List[ChunkInfo]
    embedding_backend: str
    lexical_level: str
    encoding: str
    elapsed_ms: float


class TokenCountRequest(BaseModel):
    text: str = ""


class TokenCountResponse(BaseModel):
    tokens: int
    chars: int
    encoding: str


class ExtractResponse(BaseModel):
    filename: str
    text: str
    pages: Optional[int] = None
    chars: int
    tokens: int


class LLMTestRequest(BaseModel):
    provider: Literal["gemini", "groq"]
    prompt: str = Field(..., min_length=1)
    query: str = ""
    model: Optional[str] = None


class LLMTestResponse(BaseModel):
    provider: str
    model: str
    output: str
    latency_ms: float
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None

