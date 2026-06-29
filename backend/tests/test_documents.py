import pytest
from fastapi.testclient import TestClient
import sys
import os

# Ensure the app folder is in the python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.config import settings

client = TestClient(app)

def test_upload_requires_auth():
    # Make upload request without Authorization headers
    files = {"file": ("test.txt", b"dummy content", "text/plain")}
    response = client.post("/api/documents/upload", files=files)
    assert response.status_code == 401

def test_upload_invalid_file_extension():
    # Make request with mock authorization token
    headers = {"Authorization": "Bearer dummy_jwt_token"}
    files = {"file": ("test.exe", b"binary executable", "application/octet-stream")}
    
    # Mock verify_supabase_jwt middleware bypass to simulate authenticated user
    from app.middleware import auth_middleware
    original_verify = auth_middleware.verify_supabase_jwt
    auth_middleware.verify_supabase_jwt = lambda token: {"sub": "00000000-0000-0000-0000-000000000000", "email": "test@example.com"}
    
    try:
        response = client.post("/api/documents/upload", files=files, headers=headers)
        assert response.status_code == 400
        assert "Unsupported file format" in response.json()["detail"]
    finally:
        # Restore middleware
        auth_middleware.verify_supabase_jwt = original_verify

def test_upload_oversized_file():
    headers = {"Authorization": "Bearer dummy_jwt_token"}
    # Generate oversized content: 16 MB
    oversized_content = b"a" * (16 * 1024 * 1024 + 100)
    files = {"file": ("large_test.txt", oversized_content, "text/plain")}
    
    from app.middleware import auth_middleware
    original_verify = auth_middleware.verify_supabase_jwt
    auth_middleware.verify_supabase_jwt = lambda token: {"sub": "00000000-0000-0000-0000-000000000000", "email": "test@example.com"}
    
    try:
        response = client.post("/api/documents/upload", files=files, headers=headers)
        assert response.status_code == 400
        assert "exceeds maximum allowed size" in response.json()["detail"]
    finally:
        auth_middleware.verify_supabase_jwt = original_verify

def test_list_requires_auth():
    response = client.get("/api/documents/")
    assert response.status_code == 401

def test_delete_requires_auth():
    response = client.delete("/api/documents/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 401
