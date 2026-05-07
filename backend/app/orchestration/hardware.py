from __future__ import annotations

from dataclasses import dataclass

from app.services.system_monitor import system_monitor


@dataclass(slots=True)
class CapabilityProfile:
    vram_gb: float
    gpu_class: str
    form_factor: str
    bandwidth_class: str
    thermal_budget: str

    def compute_concurrency(self) -> int:
        base = 2
        if self.gpu_class == "high":
            base += 4
        elif self.gpu_class == "midrange":
            base += 2
            
        if self.form_factor == "laptop":
            base = max(2, base - 1)
            
        return base

    def compute_batch_size(self) -> int:
        if self.vram_gb >= 16:
            return 32
        if self.vram_gb >= 8:
            return 16
        return 8


class HardwareProfiler:
    async def get_profile(self) -> CapabilityProfile:
        db_fake = None  # System monitor doesn't actually need db for gpu stats
        stats = await system_monitor.collect(db_fake)
        gpu = stats.get("gpu")
        
        if not gpu or gpu.get("vram_total_mb") is None:
            return CapabilityProfile(
                vram_gb=0.0,
                gpu_class="cpu-only",
                form_factor="desktop",
                bandwidth_class="unknown",
                thermal_budget="unlimited",
            )
            
        vram_gb = gpu["vram_total_mb"] / 1024
        
        gpu_class = "low"
        if vram_gb >= 16:
            gpu_class = "high"
        elif vram_gb >= 8:
            gpu_class = "midrange"
            
        name = (gpu.get("name") or "").lower()
        form_factor = "laptop" if "laptop" in name or "mobile" in name else "desktop"
        thermal_budget = "constrained" if form_factor == "laptop" else "unlimited"
        bandwidth_class = "high" if "rtx 40" in name or "rtx 30" in name else "medium"
        
        return CapabilityProfile(
            vram_gb=vram_gb,
            gpu_class=gpu_class,
            form_factor=form_factor,
            bandwidth_class=bandwidth_class,
            thermal_budget=thermal_budget,
        )
