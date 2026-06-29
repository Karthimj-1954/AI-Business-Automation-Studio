from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.middleware.rate_limit import RateLimitMiddleware
from app.routers import auth, info, documents, chat, generate, media, workflows, admin

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API services for AI Business Automation Studio",
    version="1.0.0",
    docs_url="/docs" if settings.ENV != "production" else None,
    redoc_url="/redoc" if settings.ENV != "production" else None
)

# CORS configuration
# In production, specify exact frontend origins.
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://vercel.app",
    "*"  # In development, or configured dynamically
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Apply Rate Limiting Middleware
app.add_middleware(RateLimitMiddleware)

# Include API Router registrations
app.include_router(auth.router, prefix="/api")
app.include_router(info.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(generate.router, prefix="/api")
app.include_router(media.router, prefix="/api")
app.include_router(workflows.router, prefix="/api")
app.include_router(admin.router, prefix="/api")

# Direct root endpoints for simple load balancer / platform health checks
@app.get("/")
async def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API backend.",
        "docs": "/docs" if settings.ENV != "production" else "disabled"
    }

@app.get("/health")
async def root_health():
    return {"status": "healthy"}
