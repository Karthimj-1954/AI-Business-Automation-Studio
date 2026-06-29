from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from sqlalchemy.sql import func
import logging
from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.models import Profile, Document, ChatSession, Workflow, WorkflowExecution, UsageStatistic

router = APIRouter(prefix="/admin", tags=["Admin Portal & Analytics"])
logger = logging.getLogger("app.admin")

def require_admin(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Assert that the authenticated profile has active admin privileges.
    """
    user_id = UUID(current_user["id"])
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not profile or profile.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permission privileges required"
        )
    return profile

@router.get("/metrics")
async def get_system_metrics(
    admin_profile: Profile = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Retrieve key aggregated consumption analytics across the entire database.
    """
    try:
        # 1. User metrics
        total_users = db.query(Profile).count()
        
        # 2. Document storage metrics
        total_docs = db.query(Document).count()
        total_bytes = db.query(func.sum(Document.file_size)).scalar() or 0
        
        # 3. File type distribution
        doc_distribution = {}
        dist_query = db.query(Document.file_type, func.count(Document.id)).group_by(Document.file_type).all()
        for ftype, count in dist_query:
            doc_distribution[ftype] = count
            
        # 4. Chat interactions
        total_sessions = db.query(ChatSession).count()
        
        # 5. Workflows executions
        total_workflows = db.query(Workflow).count()
        total_executions = db.query(WorkflowExecution).count()
        successful_executions = db.query(WorkflowExecution).filter(WorkflowExecution.status == "completed").count()
        failed_executions = db.query(WorkflowExecution).filter(WorkflowExecution.status == "failed").count()
        
        # 6. Usage statistics aggregations
        usage_aggregations = {}
        usage_query = db.query(UsageStatistic.feature, func.sum(UsageStatistic.units_used)).group_by(UsageStatistic.feature).all()
        for feature, units in usage_query:
            usage_aggregations[feature] = units

        return {
            "users": {
                "total": total_users
            },
            "storage": {
                "total_documents": total_docs,
                "total_bytes_used": total_bytes,
                "distribution": doc_distribution
            },
            "chat": {
                "total_sessions": total_sessions
            },
            "workflows": {
                "total": total_workflows,
                "total_runs": total_executions,
                "completed_runs": successful_executions,
                "failed_runs": failed_executions
            },
            "api_features_usage": usage_aggregations
        }
    except Exception as e:
        logger.error(f"Failed to compile admin metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Analytics compilation failed"
        )

@router.get("/users")
async def list_users_directory(
    admin_profile: Profile = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Fetch raw listing of system profiles directories.
    """
    try:
        profiles = db.query(Profile).order_by(Profile.created_at.desc()).all()
        return [
            {
                "id": str(p.id),
                "email": p.email,
                "full_name": p.full_name,
                "avatar_url": p.avatar_url,
                "role": p.role,
                "created_at": p.created_at
            } for p in profiles
        ]
    except Exception as e:
        logger.error(f"Failed to fetch users directories: {e}")
        raise HTTPException(
            status_code=500,
            detail="Directories fetch failure"
        )
