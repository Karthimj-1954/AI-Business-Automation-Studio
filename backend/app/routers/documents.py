from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from sqlalchemy.orm import Session
from uuid import UUID
import uuid
import logging
from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.models import Document
from app.services.storage_service import storage_service
from app.services.parser_service import parser_service
from typing import List, Optional

router = APIRouter(prefix="/documents", tags=["Documents & OCR"])
logger = logging.getLogger("app.documents")

ALLOWED_EXTENSIONS = {"pdf", "docx", "pptx", "txt", "csv", "png", "jpg", "jpeg"}
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB

async def process_document_task(doc_id: UUID, file_bytes: bytes, file_name: str, db_session: Session):
    """
    Background worker task to extract text, run OCR, and ingest vector embeddings.
    """
    try:
        # Run OCR / parsing service
        parsed_text = parser_service.parse_file(file_bytes, file_name)
        
        # Load document from db
        doc = db_session.query(Document).filter(Document.id == doc_id).first()
        if doc:
            current_meta = dict(doc.meta or {})
            current_meta["parsed_text"] = parsed_text
            current_meta["word_count"] = len(parsed_text.split())
            doc.meta = current_meta
            db_session.commit()
            
            # Run chunking & embeddings vector ingestion
            from app.services.rag_service import rag_service
            await rag_service.ingest_document(doc_id, parsed_text, db_session)
            
            doc.status = "completed"
            db_session.commit()
            logger.info(f"Successfully processed document text & RAG embeddings for ID: {doc_id}")
    except Exception as e:
        logger.error(f"Failed to process document {doc_id}: {e}")
        db_session.rollback()
        # Mark document as failed
        doc = db_session.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.status = "failed"
            current_meta = dict(doc.meta or {})
            current_meta["error"] = str(e)
            doc.meta = current_meta
            db_session.commit()

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    workspace_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a document, send it to Supabase Storage, and trigger async parsing/OCR tasks.
    """
    # 1. Validate File type
    filename = file.filename or "unnamed_file"
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format. Allowed formats: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # 2. Read file contents and validate file size
    file_bytes = await file.read()
    file_size = len(file_bytes)
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, 
            detail=f"File exceeds maximum allowed size of 15 MB."
        )

    user_id = UUID(current_user["id"])
    parsed_workspace_id = UUID(workspace_id) if workspace_id else None

    # 3. Create unique path destination inside storage bucket: user_id/unique_uuid.ext
    unique_id = uuid.uuid4()
    destination_path = f"{current_user['id']}/{unique_id}.{ext}"
    mime_type = file.content_type or "application/octet-stream"

    # 4. Upload raw file to Supabase storage bucket
    try:
        storage_path = await storage_service.upload_file(file_bytes, destination_path, mime_type)
    except Exception as e:
        logger.error(f"Supabase upload exception: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Could not save file to storage service: {str(e)}"
        )

    # 5. Save document registry database entry
    try:
        new_doc = Document(
            id=unique_id,
            workspace_id=parsed_workspace_id,
            user_id=user_id,
            name=filename,
            file_path=storage_path,
            file_type=ext.upper(),
            file_size=file_size,
            status="processing",
            meta={}
        )
        db.add(new_doc)
        db.commit()
        db.refresh(new_doc)
    except Exception as e:
        logger.error(f"Database write exception for document: {e}")
        # Rollback storage upload if DB fails to maintain consistency
        background_tasks.add_task(storage_service.delete_file, storage_path)
        raise HTTPException(
            status_code=500,
            detail="Failed to record document metadata in database."
        )

    # 6. Trigger async processing (OCR, formatting extraction) in background task
    background_tasks.add_task(
        process_document_task, 
        new_doc.id, 
        file_bytes, 
        filename, 
        db
    )

    # Return standard clean representation
    return {
        "id": str(new_doc.id),
        "name": new_doc.name,
        "file_type": new_doc.file_type,
        "file_size": new_doc.file_size,
        "status": new_doc.status,
        "created_at": new_doc.created_at
    }

@router.get("/")
async def list_documents(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all documents uploaded by the current authenticated user.
    """
    user_id = UUID(current_user["id"])
    docs = db.query(Document).filter(Document.user_id == user_id).order_by(Document.created_at.desc()).all()
    return [
        {
            "id": str(d.id),
            "name": d.name,
            "file_type": d.file_type,
            "file_size": d.file_size,
            "status": d.status,
            "created_at": d.created_at
        } for d in docs
    ]

@router.get("/{id}")
async def get_document(
    id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed metrics of a specific document, including its cached parsed text.
    """
    user_id = UUID(current_user["id"])
    doc = db.query(Document).filter(Document.id == id, Document.user_id == user_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    return {
        "id": str(doc.id),
        "name": doc.name,
        "file_type": doc.file_type,
        "file_size": doc.file_size,
        "status": doc.status,
        "parsed_text": doc.meta.get("parsed_text", ""),
        "meta": {k: v for k, v in doc.meta.items() if k != "parsed_text"},
        "created_at": doc.created_at
    }

@router.delete("/{id}", status_code=status.HTTP_200_OK)
async def delete_document(
    id: UUID,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove a document entry and trigger background file purging from Supabase Storage.
    """
    user_id = UUID(current_user["id"])
    doc = db.query(Document).filter(Document.id == id, Document.user_id == user_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Queue storage file purging task
    background_tasks.add_task(storage_service.delete_file, doc.file_path)
    
    # Remove from local database
    db.delete(doc)
    db.commit()
    
    return {"message": "Document successfully deleted"}

from pydantic import BaseModel

class QueryRequest(BaseModel):
    query: str
    document_ids: Optional[List[UUID]] = None
    limit: Optional[int] = 5

@router.post("/query")
async def query_documents(
    payload: QueryRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Query uploaded documents using semantic vector similarity search.
    """
    from app.services.rag_service import rag_service
    user_id = UUID(current_user["id"])
    
    try:
        results = await rag_service.semantic_search(
            query=payload.query,
            user_id=user_id,
            db=db,
            document_ids=payload.document_ids,
            limit=payload.limit or 5
        )
        return results
    except Exception as e:
        logger.error(f"Semantic search failure: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Semantic query execution failed: {str(e)}"
        )
