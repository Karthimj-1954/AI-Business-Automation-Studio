import pytest
from fastapi.testclient import TestClient
import sys
import os
from uuid import uuid4, UUID

# Ensure the app folder is in the python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.database.connection import get_db
from app.middleware import auth_middleware

client = TestClient(app)

class DummySession:
    id = uuid4()
    user_id = UUID("00000000-0000-0000-0000-000000000000")
    title = "New Conversation"
    created_at = "2026-06-29T00:00:00Z"
    updated_at = "2026-06-29T00:00:00Z"

class MockQuery:
    def filter(self, *args, **kwargs): return self
    def order_by(self, *args, **kwargs): return self
    def limit(self, *args, **kwargs): return self
    def join(self, *args, **kwargs): return self
    def all(self): return []
    def first(self): return DummySession()

class MockDb:
    def query(self, *args, **kwargs): return MockQuery()
    def add(self, *args, **kwargs): pass
    def commit(self, *args, **kwargs): pass
    def refresh(self, obj):
        obj.id = uuid4()
        obj.created_at = "2026-06-29T00:00:00Z"
    def rollback(self, *args, **kwargs): pass

def get_mock_db():
    db = MockDb()
    try:
        yield db
    finally:
        pass

# Mock JWT token verify method
def mock_verify_jwt(token: str):
    return {
        "sub": "00000000-0000-0000-0000-000000000000",
        "email": "test@example.com",
        "role": "authenticated",
        "user_metadata": {"full_name": "Test User"}
    }

# Reset helper
@pytest.fixture(autouse=True)
def run_around_tests():
    app.dependency_overrides[get_db] = get_mock_db
    original_verify = auth_middleware.verify_supabase_jwt
    yield
    auth_middleware.verify_supabase_jwt = original_verify
    app.dependency_overrides.clear()

def test_session_create_requires_auth():
    response = client.post("/api/chat/sessions", json={"title": "Test Title"})
    assert response.status_code == 401

def test_session_create_authorized():
    auth_middleware.verify_supabase_jwt = mock_verify_jwt
    headers = {"Authorization": "Bearer dummy_jwt_token"}
    response = client.post("/api/chat/sessions", json={"title": "Custom Title"}, headers=headers)
    assert response.status_code == 201
    assert response.json()["title"] == "Custom Title"
    assert "id" in response.json()

def test_chat_send_streaming_authorized():
    auth_middleware.verify_supabase_jwt = mock_verify_jwt
    headers = {"Authorization": "Bearer dummy_jwt_token"}
    session_id = str(uuid4())
    payload = {"session_id": session_id, "query": "summarize notes"}
    
    response = client.post("/api/chat/send", json=payload, headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
    
    content = response.text
    assert "data:" in content
    assert "[DONE]" in content
