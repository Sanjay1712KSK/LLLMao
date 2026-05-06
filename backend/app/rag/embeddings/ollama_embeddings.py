from __future__ import annotations

import httpx

from app.config import get_settings
from app.services.ollama_service import OllamaUnavailableError


class OllamaEmbeddingService:
    def __init__(self, model: str = "nomic-embed-text") -> None:
        settings = get_settings()
        self.base_url = settings.ollama_base_url.rstrip("/")
        self.model = model

    async def embed(self, text: str) -> list[float]:
        payload = {"model": self.model, "prompt": text}
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(f"{self.base_url}/api/embeddings", json=payload)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise OllamaUnavailableError(f"Ollama embedding failed with local model '{self.model}': {exc}") from exc
        data = response.json()
        embedding = data.get("embedding")
        if not isinstance(embedding, list):
            raise OllamaUnavailableError(f"Ollama did not return an embedding for local model '{self.model}'.")
        return [float(value) for value in embedding]

    async def embed_many(self, texts: list[str]) -> list[list[float]]:
        embeddings: list[list[float]] = []
        for text in texts:
            embeddings.append(await self.embed(text))
        return embeddings
