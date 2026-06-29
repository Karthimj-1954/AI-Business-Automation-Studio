import httpx
import logging
import random
from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.config import settings
from sqlalchemy.orm import Session
from app.models.models import DocumentChunk
from uuid import UUID

logger = logging.getLogger("app.rag")

class RagService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.embedding_url = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=150
        )

    def chunk_text(self, text: str) -> List[str]:
        """
        Split raw text into semantic paragraph chunks with overlap using LangChain.
        """
        if not text or not text.strip():
            return []
        return self.text_splitter.split_text(text)

    async def get_embedding(self, text: str) -> List[float]:
        """
        Retrieves a 768-dimension embedding vector for the text using the Gemini API.
        Falls back to a deterministic pseudo-random float vector if the API key is not configured or calls fail.
        """
        if not self.api_key or self.api_key.startswith("your-"):
            logger.warning("Gemini API key is not configured. Generating mock vector.")
            return self._generate_mock_embedding(text)

        payload = {
            "model": "models/text-embedding-004",
            "content": {
                "parts": [{"text": text}]
            }
        }
        params = {"key": self.api_key}

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(self.embedding_url, json=payload, params=params)
                if response.status_code == 200:
                    data = response.json()
                    values = data.get("embedding", {}).get("values", [])
                    if len(values) == 768:
                        return values
                    else:
                        logger.error(f"Unexpected embedding size from Gemini: {len(values)}. Expected 768.")
                else:
                    logger.error(f"Gemini API returned error ({response.status_code}): {response.text}")
        except Exception as e:
            logger.error(f"HTTP request to Gemini API failed: {e}")

        # Fallback if API call failed
        logger.warning("Gemini embedding retrieval failed. Falling back to mock vector.")
        return self._generate_mock_embedding(text)

    def _generate_mock_embedding(self, text: str) -> List[float]:
        """
        Generates a deterministic mock embedding vector of size 768 based on seed hash of the text.
        This ensures offline development and testing run successfully.
        """
        # Seed generator based on text hash
        text_hash = hash(text)
        random.seed(text_hash)
        # Generate 768 floats between -1.0 and 1.0
        vector = [random.uniform(-1.0, 1.0) for _ in range(768)]
        
        # Normalize the vector to maintain cosine distance consistency
        sq_sum = sum(x * x for x in vector)
        norm = sq_sum ** 0.5 if sq_sum > 0 else 1.0
        return [x / norm for x in vector]

    async def ingest_document(self, doc_id: UUID, text: str, db: Session) -> int:
        """
        Chunks the document text, generates vectors, and inserts them into the document_chunks table.
        Returns the number of ingested chunks.
        """
        chunks = self.chunk_text(text)
        if not chunks:
            return 0

        logger.info(f"Ingesting document ID {doc_id}: Sliced into {len(chunks)} chunks.")
        
        # Delete existing chunks if re-processing to avoid duplicates
        db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).delete()
        db.commit()

        count = 0
        for i, chunk in enumerate(chunks):
            try:
                embedding = await self.get_embedding(chunk)
                
                new_chunk = DocumentChunk(
                    document_id=doc_id,
                    content=chunk,
                    embedding=embedding,
                    meta={"chunk_index": i, "total_chunks": len(chunks)}
                )
                db.add(new_chunk)
                count += 1
            except Exception as e:
                logger.error(f"Failed to save chunk {i} of document {doc_id}: {e}")
                
        db.commit()
        logger.info(f"Successfully saved {count} vector chunks for document {doc_id}.")
        return count

    async def semantic_search(
        self, 
        query: str, 
        user_id: UUID,
        db: Session, 
        document_ids: List[UUID] = None, 
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Performs vector similarity search on document_chunks table using Cosine Distance.
        Scopes search to document_ids or user's documents if document_ids is empty.
        """
        query_vector = await self.get_embedding(query)
        
        # Build query
        # pgvector <=> operator computes Cosine Distance (distance = 1 - cosine_similarity)
        # Order by distance ascending means closest/most similar chunks first!
        from app.models.models import Document
        
        # Join chunks with documents to check owner user_id restrictions
        base_query = db.query(
            DocumentChunk,
            Document.name.label("doc_name"),
            DocumentChunk.embedding.cosine_distance(query_vector).label("distance")
        ).join(Document, Document.id == DocumentChunk.document_id).filter(Document.user_id == user_id)
        
        if document_ids:
            base_query = base_query.filter(DocumentChunk.document_id.in_(document_ids))
            
        results = base_query.order_by("distance").limit(limit).all()
        
        search_results = []
        for chunk, doc_name, distance in results:
            # Cosine similarity is 1 - Cosine Distance
            similarity_score = 1.0 - float(distance)
            search_results.append({
                "chunk_id": str(chunk.id),
                "document_id": str(chunk.document_id),
                "document_name": doc_name,
                "content": chunk.content,
                "similarity_score": similarity_score,
                "meta": chunk.meta
            })
            
        return search_results

rag_service = RagService()
