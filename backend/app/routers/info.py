from fastapi import APIRouter
from app.config import settings
import time

router = APIRouter(prefix="/info", tags=["System Info"])

@router.get("/health")
async def health_check():
    """
    Standard API check to verify application readiness.
    """
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "project": settings.PROJECT_NAME,
        "environment": settings.ENV
    }
