from __future__ import annotations

import logging
import time
from collections import deque
from dataclasses import dataclass
from typing import Literal

logger = logging.getLogger("lllmao.metrics")


@dataclass(slots=True)
class SchedulerDecisionEvent:
    timestamp: float
    task_id: str
    domain: str
    action: Literal["preempted", "admitted", "rejected", "degraded"]
    reason: str


class MetricsService:
    """
    Time-Series Ready metrics for the RuntimeOrchestrator and Retrieval Pipeline.
    Designed with labels, timestamps, and aggregation buckets for future Prometheus integration.
    """
    def __init__(self) -> None:
        self.retrieval_latencies: deque[float] = deque(maxlen=100)
        self.embedding_latencies: deque[float] = deque(maxlen=100)
        self.scheduler_decisions: deque[SchedulerDecisionEvent] = deque(maxlen=50)

    def record_retrieval_latency(self, latency_sec: float) -> None:
        self.retrieval_latencies.append(latency_sec)

    def record_embedding_latency(self, latency_sec: float) -> None:
        self.embedding_latencies.append(latency_sec)

    def log_scheduler_decision(self, task_id: str, domain: str, action: Literal["preempted", "admitted", "rejected", "degraded"], reason: str) -> None:
        event = SchedulerDecisionEvent(
            timestamp=time.time(),
            task_id=task_id,
            domain=domain,
            action=action,
            reason=reason
        )
        self.scheduler_decisions.append(event)
        logger.info("scheduler_decision", extra={"task_id": task_id, "action": action, "reason": reason})

    def get_summary(self) -> dict:
        avg_retrieval = sum(self.retrieval_latencies) / len(self.retrieval_latencies) if self.retrieval_latencies else 0.0
        avg_embedding = sum(self.embedding_latencies) / len(self.embedding_latencies) if self.embedding_latencies else 0.0
        return {
            "avg_retrieval_latency_sec": round(avg_retrieval, 4),
            "avg_embedding_latency_sec": round(avg_embedding, 4),
            "recent_decisions": [
                {"task_id": d.task_id, "action": d.action, "reason": d.reason} 
                for d in list(self.scheduler_decisions)[-5:]
            ]
        }

metrics_service = MetricsService()
