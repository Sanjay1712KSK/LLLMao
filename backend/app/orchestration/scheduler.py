from __future__ import annotations

import logging
from typing import Literal

from app.orchestration.hardware import CapabilityProfile, HardwareProfiler
from app.orchestration.monitor import VRAMPressureWatcher

logger = logging.getLogger("lllmao.orchestration.scheduler")


class RuntimeScheduler:
    """
    Control Plane: Responsible for policy, priority, pressure decisions, 
    admission control, and degraded modes.
    """
    def __init__(self) -> None:
        self.watcher = VRAMPressureWatcher()
        self.profiler = HardwareProfiler()
        self.policy: Literal["normal", "gaming", "rendering", "simulation", "battery", "coding", "inference-heavy", "voice"] = "normal"
        self.coexistence_level: Literal["normal", "coexistence-light", "coexistence-heavy", "inference-only"] = "normal"

    def set_policy(self, policy: str) -> None:
        self.policy = policy
        
    def set_coexistence_level(self, level: str) -> None:
        self.coexistence_level = level

    async def admit_task(self, domain: str, priority: str) -> bool:
        """
        Predictive Admission Control based on resource domains.
        """
        pressure = await self.watcher.get_pressure()
        
        if self.coexistence_level == "inference-only" and domain != "GPU_COMPUTE" and priority != "realtime":
            return False

        if pressure.status == "critical":
            if priority in {"low", "medium"}:
                logger.warning("scheduler_admission_rejected", extra={"domain": domain, "priority": priority})
                return False

        if pressure.thermal_throttling and priority == "low":
            return False

        return True

    async def get_runtime_limits(self) -> dict[str, int | bool]:
        profile = await self.profiler.get_profile()
        pressure = await self.watcher.get_pressure()
        
        concurrency = profile.compute_concurrency()
        batch_size = profile.compute_batch_size()
        degraded = False

        if self.coexistence_level in {"coexistence-heavy", "inference-only"} or pressure.status == "critical":
            concurrency = 1
            batch_size = max(1, batch_size // 4)
            degraded = True
        elif self.coexistence_level == "coexistence-light" or pressure.status == "high":
            concurrency = max(1, concurrency // 2)
            batch_size = max(2, batch_size // 2)
            degraded = True

        if pressure.thermal_throttling:
            concurrency = 1
            batch_size = 1
            degraded = True

        return {
            "concurrency": concurrency,
            "batch_size": batch_size,
            "degraded_mode": degraded,
            "suspend_indexing": self.coexistence_level == "inference-only" or pressure.status == "critical"
        }

scheduler = RuntimeScheduler()
