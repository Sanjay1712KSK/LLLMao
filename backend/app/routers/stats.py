from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import SystemStatsRead
from app.services.system_monitor import system_monitor

router = APIRouter(tags=["stats"])


@router.get("/stats", response_model=SystemStatsRead)
async def stats(db: Session = Depends(get_db)) -> SystemStatsRead:
    return SystemStatsRead.model_validate(await system_monitor.collect(db))
