from fastapi.testclient import TestClient
import sys
import os

# Ensure the app folder is in the python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.config import settings

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert "Welcome" in response.json()["message"]

def test_health_endpoints():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

    response_api = client.get("/api/info/health")
    assert response_api.status_code == 200
    assert response_api.json()["status"] == "healthy"

def test_auth_protected_without_token():
    response = client.get("/api/auth/profile")
    assert response.status_code == 401
    assert "Missing authorization credentials" in response.json()["detail"]

def test_auth_protected_with_invalid_token():
    headers = {"Authorization": "Bearer invalidtoken"}
    response = client.get("/api/auth/profile", headers=headers)
    assert response.status_code == 401
    assert "Invalid token" in response.json()["detail"]

def test_config_defaults():
    assert settings.PROJECT_NAME == "AI Business Automation Studio"
    assert settings.RATE_LIMIT_PER_MINUTE == 60
