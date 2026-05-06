from __future__ import annotations

import ast
import json
import re
from pathlib import Path

from app.rag.chunking import estimate_tokens
from app.workspace.types import CodeChunk


LANGUAGE_EXTENSIONS = {
    ".py": "python",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".hpp": "cpp",
    ".hh": "cpp",
    ".h": "cpp",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".md": "markdown",
    ".markdown": "markdown",
    ".xml": "xml",
    ".launch": "xml",
}


def language_for_path(path: Path) -> str | None:
    if path.name == "CMakeLists.txt":
        return "cmake"
    return LANGUAGE_EXTENSIONS.get(path.suffix.lower())


def scan_ros2_package(root: Path) -> dict[str, str | bool | list[str]]:
    package_xml = root / "package.xml"
    if not package_xml.exists():
        return {"is_ros2_package": False, "package_name": root.name, "dependencies": []}
    text = package_xml.read_text(encoding="utf-8", errors="ignore")
    name_match = re.search(r"<name>([^<]+)</name>", text)
    dependencies = re.findall(r"<(?:depend|exec_depend|build_depend)>([^<]+)</", text)
    return {
        "is_ros2_package": True,
        "package_name": name_match.group(1).strip() if name_match else root.name,
        "dependencies": sorted(set(item.strip() for item in dependencies)),
    }


class CodeParser:
    def parse(
        self,
        path: Path,
        workspace_id: str,
        file_id: str,
        relative_path: str,
        language: str,
        last_modified,
        embedding_model: str,
    ) -> list[CodeChunk]:
        text = path.read_text(encoding="utf-8", errors="ignore")
        if language == "python":
            return self._parse_python(text, workspace_id, file_id, relative_path, last_modified, embedding_model)
        if language == "cpp":
            return self._parse_cpp(text, workspace_id, file_id, relative_path, last_modified, embedding_model)
        if language in {"json", "yaml", "xml", "cmake"}:
            return self._parse_config(text, workspace_id, file_id, relative_path, language, last_modified, embedding_model)
        if language == "markdown":
            return self._parse_markdown(text, workspace_id, file_id, relative_path, last_modified, embedding_model)
        return []

    def _parse_python(self, text, workspace_id, file_id, relative_path, last_modified, embedding_model) -> list[CodeChunk]:
        lines = text.splitlines()
        try:
            tree = ast.parse(text)
        except SyntaxError:
            return [self._chunk(workspace_id, file_id, relative_path, "python", "module", None, 1, len(lines), [], text, last_modified, embedding_model)]

        imports = self._python_imports(tree)
        chunks: list[CodeChunk] = []
        module_doc = ast.get_docstring(tree)
        if module_doc:
            chunks.append(self._chunk(workspace_id, file_id, relative_path, "python", "module", Path(relative_path).stem, 1, min(len(lines), 80), imports, "\n".join(lines[:80]), last_modified, embedding_model))

        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                decorators = [self._node_name(item) for item in node.decorator_list]
                chunks.append(
                    self._chunk(
                        workspace_id,
                        file_id,
                        relative_path,
                        "python",
                        "class",
                        node.name,
                        node.lineno,
                        getattr(node, "end_lineno", node.lineno),
                        imports,
                        self._source_slice(lines, node.lineno, getattr(node, "end_lineno", node.lineno)),
                        last_modified,
                        embedding_model,
                        {"decorators": decorators},
                    )
                )
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                decorators = [self._node_name(item) for item in node.decorator_list]
                content = self._source_slice(lines, node.lineno, getattr(node, "end_lineno", node.lineno))
                ros2 = self._ros2_metadata(content)
                chunks.append(
                    self._chunk(
                        workspace_id,
                        file_id,
                        relative_path,
                        "python",
                        "function",
                        node.name,
                        node.lineno,
                        getattr(node, "end_lineno", node.lineno),
                        imports,
                        content,
                        last_modified,
                        embedding_model,
                        {"decorators": decorators, **ros2},
                    )
                )
        if not chunks:
            chunks.append(self._chunk(workspace_id, file_id, relative_path, "python", "module", Path(relative_path).stem, 1, len(lines), imports, text, last_modified, embedding_model))
        return chunks

    def _parse_cpp(self, text, workspace_id, file_id, relative_path, last_modified, embedding_model) -> list[CodeChunk]:
        lines = text.splitlines()
        imports = re.findall(r"^\s*#include\s+[<\"]([^>\"]+)[>\"]", text, flags=re.MULTILINE)
        pattern = re.compile(
            r"(?P<header>(?:[\w:&<>\*\s~]+)\s+(?P<name>[A-Za-z_]\w*(?:::[A-Za-z_]\w*)?)\s*\([^;{}]*\)\s*(?:const)?\s*)\{",
            re.MULTILINE,
        )
        chunks: list[CodeChunk] = []
        for match in pattern.finditer(text):
            start_line = text[: match.start()].count("\n") + 1
            end_line = self._brace_end_line(text, match.end() - 1)
            content = self._source_slice(lines, start_line, end_line)
            chunks.append(
                self._chunk(
                    workspace_id,
                    file_id,
                    relative_path,
                    "cpp",
                    "function",
                    match.group("name"),
                    start_line,
                    end_line,
                    imports,
                    content,
                    last_modified,
                    embedding_model,
                    self._ros2_metadata(content),
                )
            )
        class_pattern = re.compile(r"^\s*(class|struct)\s+([A-Za-z_]\w*)", re.MULTILINE)
        for match in class_pattern.finditer(text):
            start_line = text[: match.start()].count("\n") + 1
            chunks.append(self._chunk(workspace_id, file_id, relative_path, "cpp", match.group(1), match.group(2), start_line, min(len(lines), start_line + 120), imports, self._source_slice(lines, start_line, min(len(lines), start_line + 120)), last_modified, embedding_model))
        if not chunks:
            chunks.append(self._chunk(workspace_id, file_id, relative_path, "cpp", "module", Path(relative_path).name, 1, len(lines), imports, text, last_modified, embedding_model, self._ros2_metadata(text)))
        return chunks

    def _parse_config(self, text, workspace_id, file_id, relative_path, language, last_modified, embedding_model) -> list[CodeChunk]:
        lines = text.splitlines()
        chunks: list[CodeChunk] = []
        if language == "json":
            try:
                data = json.loads(text)
                if isinstance(data, dict):
                    for key, value in data.items():
                        content = json.dumps({key: value}, indent=2, ensure_ascii=False)
                        chunks.append(self._chunk(workspace_id, file_id, relative_path, language, "config_section", str(key), 1, len(lines), [], content, last_modified, embedding_model))
            except json.JSONDecodeError:
                pass
        if language in {"yaml", "cmake", "xml"}:
            section_pattern = re.compile(r"^([A-Za-z0-9_./-][^:\n]{0,80}:|<[^/!][^>]+>|[a-zA-Z_]+\(.*)$", re.MULTILINE)
            starts = [text[: match.start()].count("\n") + 1 for match in section_pattern.finditer(text)]
            if starts:
                starts.append(len(lines) + 1)
                for index, start in enumerate(starts[:-1]):
                    end = max(start, starts[index + 1] - 1)
                    symbol = lines[start - 1].strip()[:120]
                    chunks.append(self._chunk(workspace_id, file_id, relative_path, language, "config_section", symbol, start, end, [], self._source_slice(lines, start, end), last_modified, embedding_model, self._ros2_metadata(self._source_slice(lines, start, end))))
        if not chunks:
            chunks.append(self._chunk(workspace_id, file_id, relative_path, language, "config", Path(relative_path).name, 1, len(lines), [], text, last_modified, embedding_model, self._ros2_metadata(text)))
        return chunks

    def _parse_markdown(self, text, workspace_id, file_id, relative_path, last_modified, embedding_model) -> list[CodeChunk]:
        lines = text.splitlines()
        headings = [(index + 1, line.strip("# ").strip()) for index, line in enumerate(lines) if line.startswith("#")]
        if not headings:
            return [self._chunk(workspace_id, file_id, relative_path, "markdown", "section", Path(relative_path).name, 1, len(lines), [], text, last_modified, embedding_model)]
        headings.append((len(lines) + 1, ""))
        chunks = []
        for index, (start, title) in enumerate(headings[:-1]):
            end = headings[index + 1][0] - 1
            chunks.append(self._chunk(workspace_id, file_id, relative_path, "markdown", "section", title, start, end, [], self._source_slice(lines, start, end), last_modified, embedding_model))
        return chunks

    def _chunk(self, workspace_id, file_id, relative_path, language, chunk_type, symbol_name, start_line, end_line, imports, content, last_modified, embedding_model, extra=None) -> CodeChunk:
        ros2 = self._ros2_metadata(content)
        if extra:
            for key, value in extra.items():
                if isinstance(value, list):
                    ros2[key] = value
        chunk_id = f"{file_id}:{start_line}:{end_line}:{chunk_type}:{symbol_name or 'module'}"
        return CodeChunk(chunk_id, workspace_id, file_id, relative_path, language, chunk_type, symbol_name, start_line, end_line, imports, ros2, content, estimate_tokens(content), last_modified, embedding_model)

    def _python_imports(self, tree: ast.AST) -> list[str]:
        imports = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imports.extend(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ""
                imports.extend(f"{module}.{alias.name}".strip(".") for alias in node.names)
        return sorted(set(imports))

    def _node_name(self, node: ast.AST) -> str:
        if isinstance(node, ast.Name):
            return node.id
        if isinstance(node, ast.Attribute):
            return f"{self._node_name(node.value)}.{node.attr}"
        return node.__class__.__name__

    def _source_slice(self, lines: list[str], start: int, end: int) -> str:
        return "\n".join(lines[max(start - 1, 0) : max(end, start)])

    def _brace_end_line(self, text: str, open_brace_index: int) -> int:
        depth = 0
        for index in range(open_brace_index, len(text)):
            if text[index] == "{":
                depth += 1
            elif text[index] == "}":
                depth -= 1
                if depth == 0:
                    return text[: index].count("\n") + 1
        return text.count("\n") + 1

    def _ros2_metadata(self, text: str) -> dict[str, list[str]]:
        return {
            "publishers": sorted(set(re.findall(r"create_publisher\([^,]+,\s*['\"]([^'\"]+)['\"]", text))),
            "subscribers": sorted(set(re.findall(r"create_subscription\([^,]+,\s*['\"]([^'\"]+)['\"]", text))),
            "services": sorted(set(re.findall(r"create_service\([^,]+,\s*['\"]([^'\"]+)['\"]", text))),
            "clients": sorted(set(re.findall(r"create_client\([^,]+,\s*['\"]([^'\"]+)['\"]", text))),
            "actions": sorted(set(re.findall(r"Action(?:Server|Client)\([^,]+,\s*['\"]([^'\"]+)['\"]", text))),
            "nodes": sorted(set(re.findall(r"(?:class\s+([A-Za-z_]\w*).*Node|super\(\).__init__\(['\"]([^'\"]+)['\"]\))", text))),
        }
