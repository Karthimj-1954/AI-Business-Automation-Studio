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

class DummyWorkflow:
    id = uuid4()
    user_id = UUID("00000000-0000-0000-0000-000000000000")
    name = "Test Pipeline"
    description = "Test Description"
    steps = [
        {"id": "step_1", "type": "trigger", "action": "manual"},
        {"id": "step_2", "type": "summarize", "document_id": "00000000-0000-0000-0000-000000000000"}
    ]

class DummyDoc:
    id = uuid4()
    name = "Proposal.txt"
    meta = {"parsed_text": "This contains the primary core key goals definitions."}

class MockQuery:
    def filter(self, *args, **kwargs): return self
    def order_by(self, *args, **kwargs): return self
    def limit(self, *args, **kwargs): return self
    def first(self): return DummyWorkflow()

class MockDb:
    def query(self, *args, **kwargs): 
        # Detect if we are querying Document
        args_str = str(args)
        if "Document" in args_str:
            class DocQuery:
                def filter(self, *args, **kwargs): return self
                def first(self): return DummyDoc()
            return DocQuery()
        return MockQuery()
    def add(self, *args, **kwargs): pass
    def commit(self, *args, **kwargs): pass
    def refresh(self, obj):
        obj.id = uuid4()
        obj.started_at = "2026-06-29T00:00:00Z"
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

def test_workflow_create_requires_auth():
    payload = {"name": "Pipeline", "steps": []}
    response = client.post("/api/workflows", json=payload)
    assert response.status_code == 401

def test_workflow_run_requires_auth():
    response = client.post(f"/api/workflows/{uuid4()}/run", json={})
    assert response.status_code == 401

def test_workflow_create_authorized():
    auth_middleware.verify_supabase_jwt = mock_verify_jwt
    headers = {"Authorization": "Bearer dummy_token"}
    payload = {
        "name": "Sync Targets Outline",
        "description": "Trigger outline builds",
        "steps": [
            {"id": "step_1", "type": "trigger", "action": "manual"}
        ]
    }
    
    response = client.post("/api/workflows", json=payload, headers=headers)
    assert response.status_code == 201
    assert response.json()["name"] == "Sync Targets Outline"
    assert "id" in response.json()

def test_workflow_run_authorized():
    auth_middleware.verify_supabase_jwt = mock_verify_jwt
    headers = {"Authorization": "Bearer dummy_token"}
    
    response = client.post(f"/api/workflows/{uuid4()}/run", json={"input_data": {}}, headers=headers)
    assert response.status_code == 200
    assert "status" in response.json()
    assert response.json()["status"] == "completed"
    assert "output_data" in response.json()

def test_workflow_update_authorized():
    auth_middleware.verify_supabase_jwt = mock_verify_jwt
    headers = {"Authorization": "Bearer dummy_token"}
    payload = {
        "name": "Updated Pipeline Name",
        "description": "Updated Description",
        "steps": [
            {"id": "step_1", "type": "trigger", "action": "manual"},
            {"id": "step_2", "type": "email", "recipient": "sales@client.com"}
        ]
    }
    
    response = client.put(f"/api/workflows/{uuid4()}", json=payload, headers=headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Pipeline Name"
