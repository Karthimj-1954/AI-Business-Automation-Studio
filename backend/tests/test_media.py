import pytest
from fastapi.testclient import TestClient
import sys
import os
import io
from uuid import uuid4

# Ensure the app folder is in the python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.database.connection import get_db
from app.middleware import auth_middleware

client = TestClient(app)

class MockQuery:
    def filter(self, *args, **kwargs): return self
    def first(self): return None

class MockDb:
    def query(self, *args, **kwargs): return MockQuery()
    def add(self, *args, **kwargs): pass
    def commit(self, *args, **kwargs): pass
    def refresh(self, *args, **kwargs): pass
    def rollback(self, *args, **kwargs): pass

def get_mock_db():
    db = MockDb()
    try:
        yield db
    finally:
        pass

def mock_verify_jwt(token: str):
    return {"sub": "00000000-0000-0000-0000-000000000000", "email": "test@example.com"}

@pytest.fixture(autouse=True)
def run_around_tests():
    app.dependency_overrides[get_db] = get_mock_db
    original_verify = auth_middleware.verify_supabase_jwt
    yield
    auth_middleware.verify_supabase_jwt = original_verify
    app.dependency_overrides.clear()

def test_presentation_requires_auth():
    payload = {"topic": "SaaS Kickoff", "outline": "1. Strategy"}
    response = client.post("/api/media/presentation", json=payload)
    assert response.status_code == 401

def test_transcribe_requires_auth():
    file_payload = {"file": ("meeting.mp3", b"audiobytes", "audio/mpeg")}
    response = client.post("/api/media/transcribe", files=file_payload)
    assert response.status_code == 401

def test_transcribe_unsupported_format():
    auth_middleware.verify_supabase_jwt = mock_verify_jwt
    headers = {"Authorization": "Bearer dummy_token"}
    file_payload = {"file": ("meeting.txt", b"txt bytes", "text/plain")}
    
    response = client.post("/api/media/transcribe", files=file_payload, headers=headers)
    assert response.status_code == 400
    assert "Unsupported audio format" in response.json()["detail"]

def test_presentation_generation_authorized():
    auth_middleware.verify_supabase_jwt = mock_verify_jwt
    headers = {"Authorization": "Bearer dummy_token"}
    payload = {"topic": "Q3 Planning Strategy", "outline": "Milestones roadmap"}
    
    response = client.post("/api/media/presentation", json=payload, headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    # Content must start with zip file signatures (PK..) since pptx is a zip wrapper
    assert response.content.startswith(b"PK")

def test_transcribe_authorized():
    auth_middleware.verify_supabase_jwt = mock_verify_jwt
    headers = {"Authorization": "Bearer dummy_token"}
    file_payload = {"file": ("meeting.mp3", b"audiobytes", "audio/mpeg")}
    
    response = client.post("/api/media/transcribe", files=file_payload, headers=headers)
    assert response.status_code == 201
    assert "document_id" in response.json()
    assert "transcript" in response.json()
    assert "Dave (Engineering)" in response.json()["transcript"]
