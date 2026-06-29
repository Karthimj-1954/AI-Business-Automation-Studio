import asyncio
import json
import logging
from typing import List, Dict, Any, AsyncGenerator
from app.config import settings
from app.services.rag_service import rag_service
from app.models.models import ChatMessage
from sqlalchemy.orm import Session
from uuid import UUID

logger = logging.getLogger("app.chat")

class ChatService:
    async def get_chat_stream(
        self,
        query: str,
        session_id: UUID,
        user_id: UUID,
        db: Session,
        document_ids: List[UUID] = None,
        history: List[Dict[str, str]] = None
    ) -> AsyncGenerator[str, None]:
        """
        Retrieves top RAG chunks, builds prompts, streams tokens from Gemini API via SSE,
        and saves message logs to the SQL database.
        """
        citations = []
        context = ""

        # 1. Fetch relevant chunks from RAG database if document scopes are supplied
        if document_ids:
            try:
                search_results = await rag_service.semantic_search(
                    query=query,
                    user_id=user_id,
                    db=db,
                    document_ids=document_ids,
                    limit=4
                )
                
                if search_results:
                    context_runs = []
                    for i, r in enumerate(search_results):
                        citations.append({
                            "document_id": r["document_id"],
                            "document_name": r["document_name"],
                            "similarity_score": r["similarity_score"]
                        })
                        context_runs.append(
                            f"[Document: {r['document_name']}, Score: {r['similarity_score']:.2f}]\n{r['content']}"
                        )
                    context = "\n\n".join(context_runs)
            except Exception as e:
                logger.error(f"Failed to fetch semantic search context for query: {e}")

        # Send citations first in the stream if present
        if citations:
            yield f"data: {json.dumps({'citations': citations})}\n\n"

        # 2. Build prompt context
        system_instruction = (
            "You are a helpful and expert AI Solutions Architect inside the AI Business Automation Studio.\n"
            "Formulate answers clearly and professionally. Use markdown format, list points, and headings where appropriate.\n"
            "If document context is provided below, rely on it to formulate your answer and cite relevant documents.\n"
        )
        
        prompt = ""
        if context:
            prompt += f"Use the following document context to answer the user query:\n\n{context}\n\n"
            
        # Add conversation history turns
        if history:
            prompt += "Previous conversation history:\n"
            for msg in history:
                prompt += f"{msg['role'].capitalize()}: {msg['content']}\n"
                
        prompt += f"User: {query}\nAssistant:"

        # 3. Stream content
        full_response = ""
        api_key = settings.GEMINI_API_KEY

        # Check if API key is mock/empty
        if not api_key or api_key.startswith("your-"):
            logger.warning("Gemini API key is not configured. Streaming mock response.")
            mock_text = (
                "**Phase 5 Vector Stream Active**\n\n"
                "This is a simulated response because your `GEMINI_API_KEY` is not set.\n\n"
                "Here is what I detected:\n"
                f"- **Your Query**: \"{query}\"\n"
                f"- **Citations Found**: {len(citations)} document chunk references.\n\n"
                "To connect to the live Gemini API, configure the `GEMINI_API_KEY` environment variable in your backend `.env` file."
            )
            # Stream word-by-word
            for word in mock_text.split(" "):
                await asyncio.sleep(0.04)
                yield f"data: {json.dumps({'text': word + ' '})}\n\n"
                full_response += word + " "
        else:
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                model = ChatGoogleGenerativeAI(
                    model="gemini-1.5-flash",
                    google_api_key=api_key,
                    temperature=0.7
                )
                
                # Stream generator
                async for chunk in model.astream([
                    ("system", system_instruction),
                    ("user", prompt)
                ]):
                    text_chunk = chunk.content
                    full_response += text_chunk
                    yield f"data: {json.dumps({'text': text_chunk})}\n\n"
            except Exception as e:
                logger.error(f"Error streaming from Gemini: {e}")
                err_msg = f"\n\n[Generation Error: {str(e)}]"
                yield f"data: {json.dumps({'text': err_msg})}\n\n"
                full_response += err_msg

        # 4. Save messages to database at the end of the stream
        try:
            # User Message
            user_msg = ChatMessage(
                session_id=session_id,
                role="user",
                content=query,
                citations=[]
            )
            db.add(user_msg)
            
            # Assistant Message
            assistant_msg = ChatMessage(
                session_id=session_id,
                role="assistant",
                content=full_response.strip(),
                citations=citations
            )
            db.add(assistant_msg)
            
            db.commit()
            logger.info(f"Saved user and assistant messages for session: {session_id}")
        except Exception as e:
            logger.error(f"Failed to save messages to database: {e}")
            db.rollback()

        # Final close chunk
        yield "data: [DONE]\n\n"

chat_service = ChatService()
