from __future__ import annotations

import json
from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CodeSymbol, Workspace


class Ros2Service:
    def package_overview(self, db: Session, workspace_id: str) -> dict:
        workspace = db.get(Workspace, workspace_id)
        if workspace is None:
            return {"packages": [], "topics": [], "nodes": []}
        symbols = db.scalars(select(CodeSymbol).where(CodeSymbol.workspace_id == workspace_id).limit(2000)).all()
        topics: Counter[str] = Counter()
        nodes: Counter[str] = Counter()
        launch_files = []
        for symbol in symbols:
            ros2 = json.loads(symbol.ros2_metadata or "{}")
            for topic in ros2.get("topics", []) + ros2.get("publishers", []) + ros2.get("subscribers", []):
                topics[str(topic)] += 1
            for node in ros2.get("nodes", []):
                nodes[str(node)] += 1
            if symbol.file_path.endswith("launch.py") or symbol.chunk_type == "launch":
                launch_files.append(symbol.file_path)
        return {
            "workspace": workspace.name,
            "topics": topics.most_common(30),
            "nodes": nodes.most_common(30),
            "launch_files": sorted(set(launch_files))[:50],
        }
