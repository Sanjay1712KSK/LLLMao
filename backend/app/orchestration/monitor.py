from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Literal

from app.orchestration.hardware import HardwareProfiler
from app.services.system_monitor import system_monitor

logger = logging.getLogger("lllmao.orchestration.monitor")


@dataclass(slots=True)
class PressureState:
    vram_pressure: float
    ram_pressure: float
    thermal_throttling: bool
    kv_cache_pressure: float
    status: Literal["normal", "high", "critical"]


class VRAMPressureWatcher:
    def __init__(self) -> None:
        self.profiler = HardwareProfiler()
        self._last_state: PressureState | None = None
        self._last_check = 0.0

    async def get_pressure(self) -> PressureState:
        now = time.time()
        if self._last_state and now - self._last_check < 2.0:
            return self._last_state

        profile = await self.profiler.get_profile()
        stats = await system_monitor.collect(None)
        gpu = stats.get("gpu")
        
        vram_pressure = 0.0
        if gpu and gpu.get("vram_used_mb") and gpu.get("vram_total_mb"):
            vram_pressure = gpu["vram_used_mb"] / gpu["vram_total_mb"]
            
        ram_pressure = stats.get("ram_percent", 0.0) / 100.0
        
        # Placeholder for real thermal/KV tracking (which requires deeper Ollama integration)
        thermal_throttling = False 
        if profile.thermal_budget == "constrained" and gpu and gpu.get("utilization_percent", 0) > 90:
            thermal_throttling = True
            
        kv_cache_pressure = min(1.0, vram_pressure * 0.4) # Approximation
        
        status: Literal["normal", "high", "critical"] = "normal"
        if vram_pressure > 0.9 or ram_pressure > 0.9 or thermal_throttling:
            status = "critical"
        elif vram_pressure > 0.75 or ram_pressure > 0.8:
            status = "high"

        state = PressureState(
            vram_pressure=vram_pressure,
            ram_pressure=ram_pressure,
            thermal_throttling=thermal_throttling,
            kv_cache_pressure=kv_cache_pressure,
            status=status,
        )
        self._last_state = state
        self._last_check = now
        return state
