from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any

logger = logging.getLogger("lllmao.orchestration.executor")


class TaskExecutor:
    """
    Execution Plane: Handles async workers, preemption, batching, and execution.
    """
    def __init__(self) -> None:
        self.active_tasks: dict[str, asyncio.Task] = {}
        self.cancellation_tokens: set[str] = set()

    async def execute(self, task_id: str, coro: Awaitable[Any]) -> Any:
        self.cancellation_tokens.discard(task_id)
        task = asyncio.create_task(coro)
        self.active_tasks[task_id] = task
        try:
            return await task
        except asyncio.CancelledError:
            logger.info("executor_task_preempted", extra={"task_id": task_id})
            raise
        finally:
            self.active_tasks.pop(task_id, None)
            self.cancellation_tokens.discard(task_id)

    def preempt(self, task_id: str) -> None:
        """
        Signals preemption for a task. The task should check is_cancelled(task_id).
        """
        if task_id in self.active_tasks:
            self.cancellation_tokens.add(task_id)
            self.active_tasks[task_id].cancel()

    def is_cancelled(self, task_id: str) -> bool:
        return task_id in self.cancellation_tokens

    async def run_with_backpressure(
        self,
        items: list[Any],
        worker_fn: Callable[[Any], Awaitable[Any]],
        concurrency: int,
        task_id: str,
    ) -> list[Any]:
        """
        Executes items with backpressure and preemption checks.
        """
        semaphore = asyncio.Semaphore(max(1, concurrency))
        results = []

        async def _bounded_worker(item: Any) -> Any:
            if self.is_cancelled(task_id):
                raise asyncio.CancelledError()
            async with semaphore:
                return await worker_fn(item)

        tasks = [asyncio.create_task(_bounded_worker(item)) for item in items]
        
        try:
            for future in asyncio.as_completed(tasks):
                if self.is_cancelled(task_id):
                    for t in tasks:
                        t.cancel()
                    raise asyncio.CancelledError()
                results.append(await future)
        except asyncio.CancelledError:
            for t in tasks:
                t.cancel()
            raise

        return results

executor = TaskExecutor()
