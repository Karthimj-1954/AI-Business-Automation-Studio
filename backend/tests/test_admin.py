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
from app.models.models import Profile

client = TestClient(app)

# Dummy Profile instances
user_profile = Profile(
    id=UUID("00000000-0000-0000-0000-000000000000"),
    email="user@test.com",
    role="user"
)

admin_profile = Profile(
    id=UUID("00000000-0000-0000-0000-000000000000"),
    email="admin@test.com",
    role="admin"
)

class MockQuery:
    def __init__(self, target_obj):
        self.target_obj = target_obj
    def filter(self, *args, **kwargs): return self
    def order_by(self, *args, **kwargs): return self
    def group_by(self, *args, **kwargs): return self
    def limit(self, *args, **kwargs): return self
    def first(self): return self.target_obj
    def all(self): 
        if self.target_obj is not None:
            return [self.target_obj]
        return [("txt", 10), ("chat_tokens", 100)]
    def count(self): return 1
    def scalar(self): return 1024

class MockDb:
    def __init__(self, role="user"):
        self.role = role
    def query(self, *args, **kwargs):
        # Determine whether to return admin or standard user for Profile queries
        args_str = str(args)
        if "Profile" in args_str:
            target_obj = admin_profile if self.role == "admin" else user_profile
            return MockQuery(target_obj)
        # Returns tuples or default counts for other tables queries
        return MockQuery(None)
    def add(self, *args, **kwargs): pass
    def commit(self, *args, **kwargs): pass
    def rollback(self, *args, **kwargs): pass

def get_mock_user_db():
    db = MockDb(role="user")
    try:
        yield db
    finally:
        pass

def get_mock_admin_db():
    db = MockDb(role="admin")
    try:
        yield db
    finally:
        pass

def mock_verify_jwt(token: str):
    return {"sub": "00000000-0000-0000-0000-000000000000", "email": "test@example.com"}

@pytest.fixture
def override_user():
    app.dependency_overrides[get_db] = get_mock_user_db
    original_verify = auth_middleware.verify_supabase_jwt
    auth_middleware.verify_supabase_jwt = mock_verify_jwt
    yield
    auth_middleware.verify_supabase_jwt = original_verify
    app.dependency_overrides.clear()

@pytest.fixture
def override_admin():
    app.dependency_overrides[get_db] = get_mock_admin_db
    original_verify = auth_middleware.verify_supabase_jwt
    auth_middleware.verify_supabase_jwt = mock_verify_jwt
    yield
    auth_middleware.verify_supabase_jwt = original_verify
    app.dependency_overrides.clear()

def test_admin_metrics_requires_auth():
    response = client.get("/api/admin/metrics")
    assert response.status_code == 401

def test_admin_metrics_user_forbidden(override_user):
    headers = {"Authorization": "Bearer dummy_token"}
    response = client.get("/api/admin/metrics", headers=headers)
    assert response.status_code == 403
    assert "privileges required" in response.json()["detail"]

def test_admin_metrics_admin_authorized(override_admin):
    headers = {"Authorization": "Bearer dummy_token"}
    response = client.get("/api/admin/metrics", headers=headers)
    assert response.status_code == 200
    
    data = response.json()
    assert "users" in data
    assert "storage" in data
    assert "chat" in data
    assert "workflows" in data
    assert data["users"]["total"] == 1
    assert data["storage"]["total_bytes_used"] == 1024

def test_admin_users_list_admin_authorized(override_admin):
    headers = {"Authorization": "Bearer dummy_token"}
    response = client.get("/api/admin/users", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["role"] == "admin"
