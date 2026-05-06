import json
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass
from typing import Any

import httpx
import psutil
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings


@dataclass
class GpuStats:
    name: str | None
    vendor: str | None
    utilization_percent: float | None
    vram_used_mb: float | None
    vram_total_mb: float | None


class SystemMonitor:
    def __init__(self) -> None:
        self.ollama_base_url = get_settings().ollama_base_url.rstrip("/")
        self._last_cpu_prime = False

    async def collect(self, db: Session) -> dict[str, Any]:
        ram = self._ram()
        gpu = self._gpu()
        active_model = await self.active_model()
        ollama_ok = await self.ollama_ok()
        return {
            "cpu_percent": self._cpu_percent(),
            "ram_percent": ram.percent,
            "ram_used_mb": round(ram.used / 1024 / 1024, 1),
            "ram_total_mb": round(ram.total / 1024 / 1024, 1),
            "gpu": asdict(gpu) if gpu else None,
            "active_model": active_model,
            "backend_ok": True,
            "ollama_ok": ollama_ok,
            "database_ok": self.database_ok(db),
        }

    def _cpu_percent(self) -> float:
        if not self._last_cpu_prime:
            psutil.cpu_percent(interval=None)
            self._last_cpu_prime = True
        return float(psutil.cpu_percent(interval=None))

    def _ram(self) -> psutil._common.svmem:
        return psutil.virtual_memory()

    def _gpu(self) -> GpuStats | None:
        return self._nvidia_gpu() or self._amd_gpu()

    def _nvidia_gpu(self) -> GpuStats | None:
        if not shutil.which("nvidia-smi"):
            return None
        try:
            probe = (
                "import json, pynvml; "
                "pynvml.nvmlInit(); "
                "count=pynvml.nvmlDeviceGetCount(); "
                "h=pynvml.nvmlDeviceGetHandleByIndex(0) if count else None; "
                "m=pynvml.nvmlDeviceGetMemoryInfo(h) if h else None; "
                "u=pynvml.nvmlDeviceGetUtilizationRates(h) if h else None; "
                "n=pynvml.nvmlDeviceGetName(h) if h else None; "
                "pynvml.nvmlShutdown(); "
                "print(json.dumps({'name': n.decode() if isinstance(n, bytes) else n, 'util': u.gpu if u else None, 'used': m.used if m else None, 'total': m.total if m else None}))"
            )
            result = subprocess.run(
                [sys.executable, "-c", probe],
                check=False,
                capture_output=True,
                text=True,
                timeout=0.7,
            )
            data = json.loads(result.stdout or "{}")
            if not data.get("name"):
                return None
            return GpuStats(
                name=str(data["name"]),
                vendor="NVIDIA",
                utilization_percent=float(data["util"]) if data.get("util") is not None else None,
                vram_used_mb=round(float(data["used"]) / 1024 / 1024, 1) if data.get("used") else None,
                vram_total_mb=round(float(data["total"]) / 1024 / 1024, 1) if data.get("total") else None,
            )
        except Exception:
            return None

    def _amd_gpu(self) -> GpuStats | None:
        if not shutil.which("rocm-smi"):
            return self._generic_gpu_hint()
        try:
            result = subprocess.run(
                ["rocm-smi", "--showuse", "--showmeminfo", "vram", "--json"],
                check=False,
                capture_output=True,
                text=True,
                timeout=0.7,
            )
            data = json.loads(result.stdout or "{}")
            card = next((value for value in data.values() if isinstance(value, dict)), {})
            utilization = self._first_number(card, ("GPU use (%)", "GPU use %", "GPU use"))
            used = self._first_number(card, ("VRAM Total Used Memory (B)", "VRAM Total Used Memory"))
            total = self._first_number(card, ("VRAM Total Memory (B)", "VRAM Total Memory"))
            return GpuStats(
                name="AMD GPU",
                vendor="AMD",
                utilization_percent=utilization,
                vram_used_mb=round(used / 1024 / 1024, 1) if used else None,
                vram_total_mb=round(total / 1024 / 1024, 1) if total else None,
            )
        except Exception:
            return self._generic_gpu_hint()

    def _generic_gpu_hint(self) -> GpuStats | None:
        return None

    def _first_number(self, data: dict[str, Any], keys: tuple[str, ...]) -> float | None:
        for key in keys:
            value = data.get(key)
            if value is None:
                continue
            try:
                return float(str(value).split()[0])
            except ValueError:
                continue
        return None

    async def ollama_ok(self) -> bool:
        try:
            timeout = httpx.Timeout(0.8, connect=0.2)
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(f"{self.ollama_base_url}/api/tags")
                response.raise_for_status()
            return True
        except httpx.HTTPError:
            return False

    async def active_model(self) -> str | None:
        try:
            timeout = httpx.Timeout(0.8, connect=0.2)
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(f"{self.ollama_base_url}/api/ps")
                response.raise_for_status()
            models = response.json().get("models", [])
            if not models:
                return None
            return models[0].get("name") or models[0].get("model")
        except httpx.HTTPError:
            return None

    def database_ok(self, db: Session) -> bool:
        try:
            db.execute(text("SELECT 1"))
            return True
        except Exception:
            return False


system_monitor = SystemMonitor()
