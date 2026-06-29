from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
import logging
from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.models import Document
from app.services.generator_service import generator_service
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/generate", tags=["Business AI Generators"])
logger = logging.getLogger("app.generate_router")

class EmailRequest(BaseModel):
    recipient: str
    tone: str
    key_points: str
    context: Optional[str] = ""

class SummaryRequest(BaseModel):
    document_id: UUID
    target_length: Optional[str] = "medium"

class ReportRequest(BaseModel):
    topic: str
    outline: str
    length: Optional[str] = "medium"

@router.post("/email", status_code=status.HTTP_200_OK)
async def generate_email(
    payload: EmailRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate custom cold Outreach, Followups or Newsletters.
    """
    try:
        content = await generator_service.generate_email(
            recipient=payload.recipient,
            tone=payload.tone,
            key_points=payload.key_points,
            context=payload.context
        )
        return {"content": content}
    except Exception as e:
        logger.error(f"Email generation failure: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/summary", status_code=status.HTTP_200_OK)
async def generate_summary(
    payload: SummaryRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate summaries, highlights and key takeaways from parsed document files.
    """
    user_id = UUID(current_user["id"])
    
    # 1. Fetch document and assert ownership
    doc = db.query(Document).filter(Document.id == payload.document_id, Document.user_id == user_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    doc_text = doc.meta.get("parsed_text", "")
    if not doc_text or not doc_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Document parsed text is empty. Run upload processing first."
        )
        
    try:
        content = await generator_service.generate_summary(
            doc_name=doc.name,
            doc_text=doc_text,
            target_length=payload.target_length or "medium"
        )
        return {"content": content}
    except Exception as e:
        logger.error(f"Summary generation failure: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/report", status_code=status.HTTP_200_OK)
async def generate_report(
    payload: ReportRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Compile business SWOT analysis, proposals or outline reviews.
    """
    try:
        content = await generator_service.generate_report(
            topic=payload.topic,
            outline=payload.outline,
            length=payload.length or "medium"
        )
        return {"content": content}
    except Exception as e:
        logger.error(f"Report generation failure: {e}")
        raise HTTPException(status_code=500, detail=str(e))
