# Production Dockerfile for ContextFlow Backend (Render / Railway / Hugging Face Spaces / Cloud Run)
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.cache/huggingface \
    NLTK_DATA=/app/.cache/nltk_data \
    TIKTOKEN_CACHE_DIR=/app/.cache/tiktoken

WORKDIR /app

# Install CPU-only PyTorch first to keep the image small (~700MB instead of ~3GB CUDA)
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install -r requirements.txt

COPY . .

# Pre-download NLTK stopwords, tiktoken encoding, and MiniLM embedding model into the image
RUN mkdir -p /app/.cache && python scripts/download_models.py && chmod -R 777 /app/.cache

EXPOSE 7860 8000

# Honour $PORT provided by Render/Railway/Cloud Run, defaulting to 7860 (Hugging Face Spaces)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
