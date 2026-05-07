from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.orchestration.hardware import HardwareProfiler
from app.orchestration.monitor import VRAMPressureWatcher
from app.orchestration.scheduler import scheduler

router = APIRouter(tags=["orchestration"])
profiler = HardwareProfiler()
watcher = VRAMPressureWatcher()


class OrchestrationStatusRead(BaseModel):
    policy: str
    coexistence_level: str
    vram_pressure: float
    ram_pressure: float
    thermal_throttling: bool
    status: str
    degraded_mode: bool
    suspend_indexing: bool
    concurrency: int


class SetPolicyRequest(BaseModel):
    policy: str
    
    
class SetCoexistenceRequest(BaseModel):
    level: str


@router.get("/orchestration/status", response_model=OrchestrationStatusRead)
async def get_orchestration_status() -> Any:
    pressure = await watcher.get_pressure()
    limits = await scheduler.get_runtime_limits()
    
    return {
        "policy": scheduler.policy,
        "coexistence_level": scheduler.coexistence_level,
        "vram_pressure": pressure.vram_pressure,
        "ram_pressure": pressure.ram_pressure,
        "thermal_throttling": pressure.thermal_throttling,
        "status": pressure.status,
        "degraded_mode": bool(limits.get("degraded_mode", False)),
        "suspend_indexing": bool(limits.get("suspend_indexing", False)),
        "concurrency": int(limits.get("concurrency", 1)),
    }


@router.post("/orchestration/policy")
async def set_policy(request: SetPolicyRequest) -> Any:
    scheduler.set_policy(request.policy)
    return await get_orchestration_status()


@router.post("/orchestration/coexistence")
async def set_coexistence(request: SetCoexistenceRequest) -> Any:
    scheduler.set_coexistence_level(request.level)
    return await get_orchestration_status()
