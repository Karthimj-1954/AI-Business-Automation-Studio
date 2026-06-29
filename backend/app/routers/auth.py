from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.models import Profile, Workspace
from app.schemas.auth import ProfileResponse, ProfileUpdate, WorkspaceResponse, WorkspaceCreate
from typing import List

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.get("/profile", response_model=ProfileResponse)
async def get_profile(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the authenticated user's profile. Syncs profile if it doesn't exist in SQL database yet.
    """
    user_id = UUID(current_user["id"])
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    
    if not profile:
        # Fallback sync if auth trigger didn't run yet or user was created manually
        profile = Profile(
            id=user_id,
            email=current_user["email"],
            full_name=current_user["user_metadata"].get("full_name") or current_user["user_metadata"].get("name", ""),
            avatar_url=current_user["user_metadata"].get("avatar_url", ""),
            role=current_user.get("role", "user")
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        
    return profile

@router.put("/profile", response_model=ProfileResponse)
async def update_profile(
    update_data: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update the authenticated user's profile name and avatar.
    """
    user_id = UUID(current_user["id"])
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    if update_data.full_name is not None:
        profile.full_name = update_data.full_name
    if update_data.avatar_url is not None:
        profile.avatar_url = update_data.avatar_url
        
    db.commit()
    db.refresh(profile)
    return profile

@router.get("/workspaces", response_model=List[WorkspaceResponse])
async def get_workspaces(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List workspaces owned by the authenticated user.
    """
    user_id = UUID(current_user["id"])
    workspaces = db.query(Workspace).filter(Workspace.owner_id == user_id).all()
    return workspaces

@router.post("/workspaces", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    workspace_data: WorkspaceCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new workspace.
    """
    user_id = UUID(current_user["id"])
    new_workspace = Workspace(
        name=workspace_data.name,
        owner_id=user_id,
        settings=workspace_data.settings or {}
    )
    db.add(new_workspace)
    db.commit()
    db.refresh(new_workspace)
    return new_workspace
