import time
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict
from app.config import settings

# Simple in-memory storage for rate limiting (fallback)
# For production, Redis should be configured in settings.
rate_limit_records = defaultdict(list)

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Allow health checks without rate limiting
        if request.url.path in ["/health", "/api/health", "/"]:
            return await call_next(request)

        # Basic client identifier (IP address or auth token ID if present)
        client_ip = request.client.host if request.client else "unknown"
        
        # Check current timestamp
        current_time = time.time()
        
        # Keep track of timestamps within the last 60 seconds
        window_start = current_time - 60
        
        # Filter request timestamps
        timestamps = rate_limit_records[client_ip]
        timestamps = [t for t in timestamps if t > window_start]
        rate_limit_records[client_ip] = timestamps
        
        if len(timestamps) >= settings.RATE_LIMIT_PER_MINUTE:
            raise HTTPException(
                status_code=429, 
                detail="Too many requests. Please try again later."
            )
            
        rate_limit_records[client_ip].append(current_time)
        
        response = await call_next(request)
        return response
