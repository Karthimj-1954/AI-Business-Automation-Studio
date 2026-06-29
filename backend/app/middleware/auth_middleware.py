import jwt
from fastapi import Request, HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.security.api_key import APIKeyHeader
from app.config import settings

security = HTTPBearer(auto_error=False)

def verify_supabase_jwt(token: str) -> dict:
    """
    Decodes and verifies a Supabase JWT token using the configured JWT_SECRET.
    Returns the decoded token payload if valid, otherwise raises HTTPException.
    """
    try:
        # Supabase JWTs are signed with HS256 using the JWT Secret
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False} # Supabase uses aud: "authenticated"
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    FastAPI dependency that extracts the current authenticated user from the Authorization header.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authorization credentials")
    
    token = credentials.credentials
    payload = verify_supabase_jwt(token)
    
    # Supabase JWT structures user identity inside 'sub'
    user_id = payload.get("sub")
    email = payload.get("email")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload: missing user identifier")
        
    return {
        "id": user_id,
        "email": email,
        "role": payload.get("role"),
        "user_metadata": payload.get("user_metadata", {})
    }
