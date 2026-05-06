from __future__ import annotations

from dataclasses import dataclass

from app.models import ImageAsset
from app.multimodal.context_management import ContextBudget
from app.rag.chunking import estimate_tokens


@dataclass(slots=True)
class MultimodalContext:
    messages: list[dict]
    sources: list[dict]
    summary: str
    token_estimate: int


class PromptOrchestrator:
    def __init__(self, token_budget: int = 3200) -> None:
        self.budget = ContextBudget(token_budget)

    def build(
        self,
        query: str,
        history: list[dict[str, str]],
        images: list[ImageAsset],
        workspace_chunks: list[dict],
        document_chunks: list[dict],
        image_payloads: list[str],
    ) -> MultimodalContext:
        ranked = self.budget.select([*workspace_chunks, *document_chunks])
        context_blocks = []
        for index, chunk in enumerate(ranked, start=1):
            label = chunk.get("label") or chunk.get("file_path") or chunk.get("filename") or "source"
            context_blocks.append(f"[Source {index}: {label}]\n{chunk.get('content', '')}")

        image_lines = [f"- {image.filename}: {image.width}x{image.height}, {image.mime_type}" for image in images]
        system = (
            "You are LLLMao, a local multimodal development assistant. "
            "Analyze uploaded images with the user's prompt and available project/document context. "
            "Useful workflows include ROS2 graph debugging, terminal screenshot analysis, Isaac Sim visual debugging, UI errors, and architecture diagrams. "
            "Use source references when code or documents influence the answer. If visual evidence is unclear, say what cannot be determined.\n\n"
            "Uploaded images:\n"
            + ("\n".join(image_lines) if image_lines else "No images attached.")
            + "\n\nContext:\n"
            + ("\n\n---\n\n".join(context_blocks) if context_blocks else "No retrieval context selected.")
        )
        user_message = {"role": "user", "content": query}
        if image_payloads:
            user_message["images"] = image_payloads
        messages = [{"role": "system", "content": system}, *history[-8:], user_message]
        token_estimate = estimate_tokens(system) + sum(estimate_tokens(message.get("content", "")) for message in history[-8:]) + estimate_tokens(query)
        return MultimodalContext(messages, ranked, f"{len(ranked)} context chunks, {len(images)} image(s)", token_estimate)
