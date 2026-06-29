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

class DummyDoc:
    id = uuid4()
    name = "ProjectOutline.txt"
    meta = {"parsed_text": "This contains the primary core key goals and metrics definitions."}

class MockQuery:
    def filter(self, *args, **kwargs): return self
    def order_by(self, *args, **kwargs): return self
    def limit(self, *args, **kwargs): return self
    def join(self, *args, **kwargs): return self
    def all(self): return []
    def first(self): return DummyDoc()

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

def test_email_gen_requires_auth():
    payload = {"recipient": "Sales Team", "tone": "professional", "key_points": "sync targets"}
    response = client.post("/api/generate/email", json=payload)
    assert response.status_code == 401

def test_summary_gen_requires_auth():
    payload = {"document_id": str(uuid4())}
    response = client.post("/api/generate/summary", json=payload)
    assert response.status_code == 401

def test_email_gen_authorized():
    auth_middleware.verify_supabase_jwt = mock_verify_jwt
    headers = {"Authorization": "Bearer dummy_token"}
    payload = {
        "recipient": "Partner Corp",
        "tone": "professional",
        "key_points": "1. Project kickoff meeting scheduled for July 1st\n2. Share deliverables list"
    }
    
    response = client.post("/api/generate/email", json=payload, headers=headers)
    assert response.status_code == 200
    assert "content" in response.json()
    assert "Partner Corp" in response.json()["content"]

def test_summary_gen_authorized():
    auth_middleware.verify_supabase_jwt = mock_verify_jwt
    headers = {"Authorization": "Bearer dummy_token"}
    payload = {"document_id": str(uuid4()), "target_length": "short"}
    
    response = client.post("/api/generate/summary", json=payload, headers=headers)
    assert response.status_code == 200
    assert "content" in response.json()
    assert "Document Summary" in response.json()["content"]

def test_report_gen_authorized():
    auth_middleware.verify_supabase_jwt = mock_verify_jwt
    headers = {"Authorization": "Bearer dummy_token"}
    payload = {
        "topic": "SaaS Monetization Strategy",
        "outline": "1. Pricing Tiers\n2. Payment Gateways",
        "length": "medium"
    }
    
    response = client.post("/api/generate/report", json=payload, headers=headers)
    assert response.status_code == 200
    assert "content" in response.json()
    assert "Business Report" in response.json()["content"]
