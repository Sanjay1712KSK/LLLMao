import json
from collections.abc import AsyncGenerator

import httpx

from app.config import get_settings


class OllamaUnavailableError(RuntimeError):
    pass


class OllamaService:
    def __init__(self) -> None:
        self.base_url = get_settings().ollama_base_url.rstrip("/")

    async def health(self) -> tuple[bool, str]:
        try:
            async with httpx.AsyncClient(timeout=2.5) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
            return True, "Ollama is available"
        except httpx.HTTPError as exc:
            return False, f"Ollama is unavailable at {self.base_url}: {exc}"

    async def list_models(self) -> list[dict]:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise OllamaUnavailableError(f"Ollama is unavailable at {self.base_url}: {exc}") from exc

        data = response.json()
        models = []
        for item in data.get("models", []):
            details = item.get("details") or {}
            models.append(
                {
                    "name": item.get("name", ""),
                    "modified_at": item.get("modified_at"),
                    "size": item.get("size"),
                    "family": details.get("family"),
                    "parameter_size": details.get("parameter_size"),
                    "quantization_level": details.get("quantization_level"),
                }
            )
        return [model for model in models if model["name"]]

    async def stream_chat(self, model: str, messages: list[dict[str, str]]) -> AsyncGenerator[str, None]:
        payload = {"model": model, "messages": messages, "stream": True}
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", f"{self.base_url}/api/chat", json=payload) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        data = json.loads(line)
                        if "message" in data and "content" in data["message"]:
                            yield data["message"]["content"]
                        if data.get("done"):
                            break
        except httpx.HTTPError as exc:
            raise OllamaUnavailableError(f"Ollama chat stream failed: {exc}") from exc
