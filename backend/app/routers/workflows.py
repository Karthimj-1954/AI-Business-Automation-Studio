from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
import logging
from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.models import Workflow, WorkflowExecution
from app.services.workflow_service import workflow_service
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/workflows", tags=["Workflow Automation Builder"])
logger = logging.getLogger("app.workflows_router")

class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    steps: List[dict]

class RunRequest(BaseModel):
    input_data: Optional[dict] = None

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_workflow(
    payload: WorkflowCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Configure a new sequence of automated AI tasks (Trigger -> Summary -> Email).
    """
    user_id = UUID(current_user["id"])
    try:
        new_workflow = Workflow(
            user_id=user_id,
            name=payload.name,
            description=payload.description,
            steps=payload.steps
        )
        db.add(new_workflow)
        db.commit()
        db.refresh(new_workflow)
        return new_workflow
    except Exception as e:
        logger.error(f"Failed to create workflow: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Database write failure")

@router.get("")
async def list_workflows(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all configured workflows belonging to the user.
    """
    user_id = UUID(current_user["id"])
    workflows = db.query(Workflow).filter(Workflow.user_id == user_id).order_by(Workflow.created_at.desc()).all()
    return workflows

@router.post("/{workflow_id}/run")
async def run_workflow(
    workflow_id: UUID,
    payload: RunRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Trigger immediate sequential execution of a configured workflow.
    """
    user_id = UUID(current_user["id"])
    
    # 1. Assert workflow existence
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id, Workflow.user_id == user_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
        
    try:
        execution = await workflow_service.run_execution(
            workflow_id=workflow_id,
            user_id=user_id,
            input_data=payload.input_data or {},
            db=db
        )
        return {
            "execution_id": str(execution.id),
            "status": execution.status,
            "output_data": execution.output_data,
            "error_message": execution.error_message,
            "started_at": execution.started_at,
            "completed_at": execution.completed_at
        }
    except Exception as e:
        logger.error(f"Workflow trigger failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{workflow_id}/executions")
async def list_workflow_executions(
    workflow_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch past run execution history logs for a specific workflow.
    """
    user_id = UUID(current_user["id"])
    
    # Assert ownership
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id, Workflow.user_id == user_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
        
    executions = db.query(WorkflowExecution).filter(
        WorkflowExecution.workflow_id == workflow_id
    ).order_by(WorkflowExecution.started_at.desc()).limit(15).all()
    
    return [
        {
            "id": str(ex.id),
            "status": ex.status,
            "output_data": ex.output_data,
            "error_message": ex.error_message,
            "started_at": ex.started_at,
            "completed_at": ex.completed_at
        } for ex in executions
    ]

@router.put("/{workflow_id}")
async def update_workflow(
    workflow_id: UUID,
    payload: WorkflowCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update step sequences configurations inside a specific workflow.
    """
    user_id = UUID(current_user["id"])
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id, Workflow.user_id == user_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
        
    try:
        workflow.name = payload.name
        workflow.description = payload.description
        workflow.steps = payload.steps
        db.commit()
        db.refresh(workflow)
        return workflow
    except Exception as e:
        logger.error(f"Failed to update workflow {workflow_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

