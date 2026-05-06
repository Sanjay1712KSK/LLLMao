from __future__ import annotations

import csv
import json
import re
from pathlib import Path

from app.rag.types import ParsedBlock


class UnsupportedDocumentError(ValueError):
    pass


class DocumentParser:
    supported_extensions = {".pdf", ".txt", ".md", ".markdown", ".docx", ".csv", ".json"}

    def parse(self, path: Path) -> list[ParsedBlock]:
        suffix = path.suffix.lower()
        if suffix not in self.supported_extensions:
            raise UnsupportedDocumentError(f"Unsupported document type: {suffix}")
        if suffix == ".pdf":
            return self._parse_pdf(path)
        if suffix == ".docx":
            return self._parse_docx(path)
        if suffix in {".md", ".markdown"}:
            return self._parse_markdown(path.read_text(encoding="utf-8", errors="ignore"))
        if suffix == ".csv":
            return self._parse_csv(path)
        if suffix == ".json":
            return self._parse_json(path)
        return self._parse_text(path.read_text(encoding="utf-8", errors="ignore"))

    def _parse_pdf(self, path: Path) -> list[ParsedBlock]:
        try:
            from pypdf import PdfReader
        except ImportError as exc:
            raise UnsupportedDocumentError("PDF support requires pypdf. Install backend requirements.") from exc

        blocks: list[ParsedBlock] = []
        reader = PdfReader(str(path))
        for page_number, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            for block in self._parse_text(text):
                block.metadata["page"] = page_number
                blocks.append(block)
        return blocks

    def _parse_docx(self, path: Path) -> list[ParsedBlock]:
        try:
            from docx import Document
        except ImportError as exc:
            raise UnsupportedDocumentError("DOCX support requires python-docx. Install backend requirements.") from exc

        document = Document(str(path))
        blocks: list[ParsedBlock] = []
        section_title: str | None = None
        for paragraph in document.paragraphs:
            text = paragraph.text.strip()
            if not text:
                continue
            style_name = (paragraph.style.name if paragraph.style else "").lower()
            if "heading" in style_name:
                section_title = text
                blocks.append(ParsedBlock(text=text, section_title=section_title, block_type="heading"))
            else:
                blocks.append(ParsedBlock(text=text, section_title=section_title))
        return blocks

    def _parse_markdown(self, text: str) -> list[ParsedBlock]:
        blocks: list[ParsedBlock] = []
        section_title: str | None = None
        in_code = False
        code_lines: list[str] = []
        paragraph: list[str] = []

        def flush_paragraph() -> None:
            nonlocal paragraph
            if paragraph:
                blocks.append(ParsedBlock(text="\n".join(paragraph).strip(), section_title=section_title))
                paragraph = []

        for line in text.splitlines():
            if line.strip().startswith("```"):
                if in_code:
                    code_lines.append(line)
                    blocks.append(ParsedBlock(text="\n".join(code_lines), section_title=section_title, block_type="code"))
                    code_lines = []
                    in_code = False
                else:
                    flush_paragraph()
                    in_code = True
                    code_lines = [line]
                continue
            if in_code:
                code_lines.append(line)
                continue
            heading = re.match(r"^(#{1,6})\s+(.+)$", line.strip())
            if heading:
                flush_paragraph()
                section_title = heading.group(2).strip()
                blocks.append(ParsedBlock(text=line.strip(), section_title=section_title, block_type="heading"))
            elif not line.strip():
                flush_paragraph()
            else:
                paragraph.append(line)
        flush_paragraph()
        if code_lines:
            blocks.append(ParsedBlock(text="\n".join(code_lines), section_title=section_title, block_type="code"))
        return blocks

    def _parse_text(self, text: str) -> list[ParsedBlock]:
        blocks: list[ParsedBlock] = []
        section_title: str | None = None
        for raw in re.split(r"\n\s*\n", text):
            paragraph = raw.strip()
            if not paragraph:
                continue
            looks_like_heading = len(paragraph) < 120 and not paragraph.endswith((".", "!", "?", ",", ";", ":"))
            if looks_like_heading:
                section_title = paragraph
                blocks.append(ParsedBlock(text=paragraph, section_title=section_title, block_type="heading"))
            else:
                blocks.append(ParsedBlock(text=paragraph, section_title=section_title))
        return blocks

    def _parse_csv(self, path: Path) -> list[ParsedBlock]:
        blocks: list[ParsedBlock] = [ParsedBlock(text=f"# {path.name}", section_title=path.name, block_type="heading")]
        with path.open(newline="", encoding="utf-8", errors="ignore") as handle:
            reader = csv.DictReader(handle)
            for index, row in enumerate(reader, start=1):
                content = "\n".join(f"{key}: {value}" for key, value in row.items())
                blocks.append(ParsedBlock(text=content, section_title=path.name, block_type="table", metadata={"row": index}))
        return blocks

    def _parse_json(self, path: Path) -> list[ParsedBlock]:
        data = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
        blocks = [ParsedBlock(text=f"# {path.name}", section_title=path.name, block_type="heading")]
        if isinstance(data, list):
            for index, item in enumerate(data):
                blocks.append(ParsedBlock(text=json.dumps(item, indent=2, ensure_ascii=False), section_title=path.name, metadata={"item": index}))
        elif isinstance(data, dict):
            for key, value in data.items():
                blocks.append(
                    ParsedBlock(
                        text=f"{key}\n{json.dumps(value, indent=2, ensure_ascii=False)}",
                        section_title=str(key),
                        block_type="section",
                    )
                )
        else:
            blocks.append(ParsedBlock(text=json.dumps(data, indent=2, ensure_ascii=False), section_title=path.name))
        return blocks
