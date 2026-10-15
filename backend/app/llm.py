"""Thin async clients for Google Gemini and Groq (OpenAI-compatible) chat APIs."""
from __future__ import annotations

import time
from typing import Dict, List, Optional

import httpx
from fastapi import HTTPException

from .config import get_settings

SYSTEM_PROMPT = (
    "You are a precise assistant. Answer the user's question using only the provided context. "
    "The context may be compressed (some filler words removed); interpret it naturally."
)


def available_providers() -> List[Dict[str, str]]:
    s = get_settings()
    providers = []
    if s.gemini_api_key:
        providers.append({"id": "gemini", "label": "Google Gemini", "model": s.gemini_model})
    if s.groq_api_key:
        providers.append({"id": "groq", "label": "Groq", "model": s.groq_model})
    return providers


def _user_message(prompt: str, query: str) -> str:
    if query.strip():
        return f"Context:\n\"\"\"\n{prompt}\n\"\"\"\n\nQuestion: {query.strip()}"
    return prompt


def _raise_upstream(resp: httpx.Response, provider: str) -> None:
    try:
        payload = resp.json()
        message = payload.get("error", {}).get("message") or str(payload)
    except Exception:
        message = resp.text[:500]
    raise HTTPException(status_code=502, detail=f"{provider} API error ({resp.status_code}): {message}")


async def _gemini(prompt: str, query: str, model: str) -> Dict:
    s = get_settings()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": _user_message(prompt, query)}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": s.llm_max_output_tokens},
    }
    async with httpx.AsyncClient(timeout=s.llm_timeout_seconds) as client:
        resp = await client.post(url, json=body, headers={"x-goog-api-key": s.gemini_api_key})
    if resp.status_code != 200:
        _raise_upstream(resp, "Gemini")
    data = resp.json()
    candidates = data.get("candidates") or []
    parts = (candidates[0].get("content", {}).get("parts", []) if candidates else []) or []
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        reason = candidates[0].get("finishReason") if candidates else data.get("promptFeedback")
        text = f"[No text returned — finish reason: {reason}]"
    usage = data.get("usageMetadata", {})
    return {
        "output": text,
        "input_tokens": usage.get("promptTokenCount"),
        "output_tokens": usage.get("candidatesTokenCount"),
    }


async def _groq(prompt: str, query: str, model: str) -> Dict:
    s = get_settings()
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _user_message(prompt, query)},
        ],
        "temperature": 0.2,
        "max_tokens": s.llm_max_output_tokens,
    }
    async with httpx.AsyncClient(timeout=s.llm_timeout_seconds) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            json=body,
            headers={"Authorization": f"Bearer {s.groq_api_key}"},
        )
    if resp.status_code != 200:
        _raise_upstream(resp, "Groq")
    data = resp.json()
    usage = data.get("usage", {})
    return {
        "output": (data["choices"][0]["message"].get("content") or "").strip(),
        "input_tokens": usage.get("prompt_tokens"),
        "output_tokens": usage.get("completion_tokens"),
    }


async def run_llm(provider: str, prompt: str, query: str = "", model: Optional[str] = None) -> Dict:
    s = get_settings()
    if provider == "gemini":
        if not s.gemini_api_key:
            raise HTTPException(400, "GEMINI_API_KEY is not configured on the server.")
        model = model or s.gemini_model
        fn = _gemini
    elif provider == "groq":
        if not s.groq_api_key:
            raise HTTPException(400, "GROQ_API_KEY is not configured on the server.")
        model = model or s.groq_model
        fn = _groq
    else:
        raise HTTPException(400, f"Unknown provider '{provider}'")

    start = time.perf_counter()
    try:
        result = await fn(prompt, query, model)
    except httpx.TimeoutException as exc:
        raise HTTPException(504, f"{provider} request timed out") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"{provider} request failed: {exc}") from exc
    return {
        "provider": provider,
        "model": model,
        "latency_ms": round((time.perf_counter() - start) * 1000, 1),
        **result,
    }

