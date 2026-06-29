import pytest
from fastapi.testclient import TestClient
import sys
import os
from uuid import uuid4

# Ensure the app folder is in the python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.services.rag_service import rag_service

client = TestClient(app)

def test_chunk_text():
    text = "This is a sentence. " * 100 # Long text to force splits
    chunks = rag_service.chunk_text(text)
    assert len(chunks) > 0
    # Every chunk should be less than chunk_size (800)
    for chunk in chunks:
        assert len(chunk) <= 800

def test_generate_mock_embedding():
    vector = rag_service._generate_mock_embedding("sample text")
    assert len(vector) == 768
    # Assert normalized (sum of squares is ~1.0)
    sum_squares = sum(x * x for x in vector)
    assert abs(sum_squares - 1.0) < 1e-5

def test_query_endpoint_unauthorized():
    payload = {"query": "what is AI?"}
    response = client.post("/api/documents/query", json=payload)
    assert response.status_code == 401

def test_query_endpoint_authorized_empty():
    headers = {"Authorization": "Bearer dummy_jwt_token"}
    payload = {"query": "finance summary", "limit": 2}
    
    # Mock verify_supabase_jwt middleware
    from app.middleware import auth_middleware
    original_verify = auth_middleware.verify_supabase_jwt
    auth_middleware.verify_supabase_jwt = lambda token: {"sub": "00000000-0000-0000-0000-000000000000", "email": "test@example.com"}
    
    # Mock rag_service.semantic_search to avoid database connection exception
    from app.services.rag_service import rag_service
    original_search = rag_service.semantic_search
    async def mock_search(*args, **kwargs):
        return []
    rag_service.semantic_search = mock_search
    
    try:
        response = client.post("/api/documents/query", json=payload, headers=headers)
        assert response.status_code == 200
        # Since DB is empty, should return empty list
        assert response.json() == []
    finally:
        auth_middleware.verify_supabase_jwt = original_verify
        rag_service.semantic_search = original_search
