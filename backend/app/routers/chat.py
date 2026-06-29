from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from uuid import UUID
import logging
from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.models import ChatSession, ChatMessage
from app.services.chat_service import chat_service
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/chat", tags=["AI Chat & RAG"])
logger = logging.getLogger("app.chat_router")

class SessionCreate(BaseModel):
    title: Optional[str] = "New Conversation"

class ChatRequest(BaseModel):
    session_id: UUID
    query: str
    document_ids: Optional[List[UUID]] = None

@router.post("/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initialize a new AI chat conversation session.
    """
    user_id = UUID(current_user["id"])
    try:
        new_session = ChatSession(
            user_id=user_id,
            title=payload.title or "New Conversation"
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        return {
            "id": str(new_session.id),
            "title": new_session.title,
            "created_at": new_session.created_at
        }
    except Exception as e:
        logger.error(f"Failed to create session: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Database write failure")

@router.get("/sessions")
async def list_sessions(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve all conversation sessions of the authenticated user.
    """
    user_id = UUID(current_user["id"])
    sessions = db.query(ChatSession).filter(ChatSession.user_id == user_id).order_by(ChatSession.updated_at.desc()).all()
    return [
        {
            "id": str(s.id),
            "title": s.title,
            "created_at": s.created_at,
            "updated_at": s.updated_at
        } for s in sessions
    ]

@router.get("/sessions/{session_id}")
async def get_session_messages(
    session_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch history logs of message turns inside a specific session.
    """
    user_id = UUID(current_user["id"])
    # Confirm session ownership
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc()).all()
    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "citations": m.citations,
            "created_at": m.created_at
        } for m in messages
    ]

@router.post("/send")
async def send_message(
    payload: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send query, retrieve context vectors, and return tokens as real-time Server-Sent Events.
    """
    user_id = UUID(current_user["id"])
    
    # 1. Verify session exists and belongs to user
    session = db.query(ChatSession).filter(ChatSession.id == payload.session_id, ChatSession.user_id == user_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    # 2. Automatically generate/update session title if it is the first query in session
    first_msg = db.query(ChatMessage).filter(ChatMessage.session_id == payload.session_id).first()
    if not first_msg:
        # Title is first 5 words of user query
        words = payload.query.split()
        title_gen = " ".join(words[:5]) + ("..." if len(words) > 5 else "")
        session.title = title_gen
        db.commit()

    # 3. Retrieve conversation history logs from SQL database
    past_messages = db.query(ChatMessage).filter(ChatMessage.session_id == payload.session_id).order_by(ChatMessage.created_at.asc()).all()
    history = [{"role": m.role, "content": m.content} for m in past_messages]

    # 4. Stream response using AsyncGenerator
    generator = chat_service.get_chat_stream(
        query=payload.query,
        session_id=payload.session_id,
        user_id=user_id,
        db=db,
        document_ids=payload.document_ids,
        history=history
    )

    return StreamingResponse(generator, media_type="text/event-stream")
