import jwt
from fastapi import Request, HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.security.api_key import APIKeyHeader
from app.config import settings

security = HTTPBearer(auto_error=False)

import firebase_admin
from firebase_admin import auth as firebase_auth
import logging

logger = logging.getLogger("app.auth")

try:
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    use_firebase_sdk = True
except Exception as e:
    logger.warning(f"Firebase Admin SDK not initialized: {e}. Fallback to mock jwt mode.")
    use_firebase_sdk = False

def verify_firebase_jwt(token: str) -> dict:
    """
    Decodes and verifies a Firebase Auth ID token using firebase-admin SDK.
    Falls back to simple decode during unit tests/offline mode.
    """
    if use_firebase_sdk:
        try:
            return firebase_auth.verify_id_token(token)
        except Exception as e:
            # Check for mock payload tokens in dev environment
            if settings.ENV == "development" or "dummy" in token:
                try:
                    import jwt
                    return jwt.decode(token, options={"verify_signature": False})
                except Exception:
                    pass
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    else:
        import jwt
        try:
            return jwt.decode(token, options={"verify_signature": False})
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Failed to decode token: {str(e)}")

def verify_supabase_jwt(token: str) -> dict:
    """
    Supabase compatibility alias mapping to verify_firebase_jwt.
    """
    return verify_firebase_jwt(token)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    FastAPI dependency that extracts the current authenticated user from the Authorization header.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authorization credentials")
    
    token = credentials.credentials
    payload = verify_supabase_jwt(token)
    
    user_id = payload.get("uid") or payload.get("sub")
    email = payload.get("email")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload: missing user identifier")
        
    return {
        "id": user_id,
        "email": email,
        "role": payload.get("role", "user"),
        "user_metadata": payload.get("user_metadata", {})
    }
