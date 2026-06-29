from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from uuid import UUID
import uuid
import logging
from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.models import Document
from app.services.presentation_service import presentation_service
from app.services.transcribe_service import transcribe_service
from app.services.storage_service import storage_service
from pydantic import BaseModel

router = APIRouter(prefix="/media", tags=["Media, PPTX & Whisper"])
logger = logging.getLogger("app.media_router")

class PresentationRequest(BaseModel):
    topic: str
    outline: str

@router.post("/presentation")
async def generate_presentation(
    payload: PresentationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate and compile a dark-themed PowerPoint (.pptx) presentation slides deck.
    """
    try:
        # 1. Generate JSON slides outline
        slides_data = await presentation_service.generate_outline(payload.topic, payload.outline)
        # 2. Compile into pptx bytes stream buffer
        stream = presentation_service.compile_presentation(slides_data)
        
        headers = {
            "Content-Disposition": 'attachment; filename="presentation.pptx"'
        }
        return StreamingResponse(
            stream, 
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers=headers
        )
    except Exception as e:
        logger.error(f"Presentation generation failure: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Slides compilation failed: {str(e)}"
        )

@router.post("/transcribe", status_code=status.HTTP_201_CREATED)
async def transcribe_meeting(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload an audio recording, transcribe meeting minutes with Whisper,
    and save the output transcript as an indexed Workspace Document.
    """
    user_id = UUID(current_user["id"])
    
    # Restrict file formats
    ext = file.filename.split(".")[-1].lower()
    if ext not in {"mp3", "wav", "m4a", "ogg", "flac"}:
        raise HTTPException(
            status_code=400,
            detail="Unsupported audio format. Please upload MP3, WAV, or M4A."
        )

    try:
        # 1. Read audio bytes
        file_bytes = await file.read()
        
        # 2. Transcribe meeting logs
        transcript = await transcribe_service.transcribe_audio(file_bytes, file.filename)
        
        # 3. Create document record text
        transcript_bytes = transcript.encode("utf-8")
        clean_filename = f"transcript_{file.filename.split('.')[0]}_{uuid.uuid4().hex[:6]}.txt"
        storage_path = f"transcripts/{user_id}/{clean_filename}"

        # 4. Save file to Supabase Storage bucket
        try:
            await storage_service.upload_file(storage_path, transcript_bytes, "text/plain")
        except Exception as se:
            logger.error(f"Failed to save transcript to Supabase Storage: {se}")
            # Continue to save to DB anyway so local fallback runs

        # 5. Insert Workspace Document database entry
        doc_id = uuid.uuid4()
        new_doc = Document(
            id=doc_id,
            user_id=user_id,
            name=clean_filename,
            file_path=storage_path,
            file_type="TXT",
            file_size=len(transcript_bytes),
            status="completed",
            meta={
                "parsed_text": transcript,
                "word_count": len(transcript.split()),
                "source_audio": file.filename
            }
        )
        db.add(new_doc)
        db.commit()
        
        # 6. Spawn background RAG vector chunking ingestion
        try:
            from app.services.rag_service import rag_service
            await rag_service.ingest_document(doc_id, transcript, db)
        except Exception as re:
            logger.error(f"Failed to auto-vectorize meeting transcript: {re}")

        return {
            "document_id": str(doc_id),
            "name": clean_filename,
            "transcript": transcript
        }
    except Exception as e:
        logger.error(f"Audio transcription failure: {e}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Whisper transcription failed: {str(e)}"
        )
