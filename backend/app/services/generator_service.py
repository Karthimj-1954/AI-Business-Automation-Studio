import logging
from typing import Optional
from app.config import settings

logger = logging.getLogger("app.generators")

class GeneratorService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        
    async def _call_gemini(self, system_instruction: str, prompt: str, mock_fallback_text: str) -> str:
        """
        Internal helper to invoke Gemini API via LangChain. 
        Falls back to mock text if API key is not configured or calls fail.
        """
        if not self.api_key or self.api_key.startswith("your-"):
            logger.warning("Gemini API key is not configured. Returning mock generator output.")
            return mock_fallback_text
            
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            model = ChatGoogleGenerativeAI(
                model="gemini-1.5-flash",
                google_api_key=self.api_key,
                temperature=0.7
            )
            response = await model.ainvoke([
                ("system", system_instruction),
                ("user", prompt)
            ])
            return response.content
        except Exception as e:
            logger.error(f"Gemini generation call failed: {e}")
            return f"{mock_fallback_text}\n\n[API Fallback Notice: Live generation failed due to connection or auth errors]"

    async def generate_email(
        self, 
        recipient: str, 
        tone: str, 
        key_points: str, 
        context: Optional[str] = ""
    ) -> str:
        """
        Drafts a business email using key points and recipient information.
        """
        system_instruction = (
            "You are an expert copywriter. Write a highly professional business email.\n"
            "Include a compelling subject line and maintain a clean email layout structure."
        )
        
        prompt = (
            f"Draft an email to: {recipient}\n"
            f"Tone: {tone}\n"
            f"Key Points to cover:\n{key_points}\n"
        )
        if context:
            prompt += f"Additional Context: {context}\n"
            
        mock_fallback = (
            f"Subject: Follow-up regarding key objectives\n\n"
            f"Dear {recipient},\n\n"
            f"I hope this email finds you well.\n\n"
            f"Regarding our ongoing discussions, here are the key highlights:\n"
            f"{key_points.strip()}\n\n"
            f"Please let me know your thoughts on this outline and how we should proceed.\n\n"
            f"Best regards,\n"
            f"Studio AI Workspace"
        )
        
        return await self._call_gemini(system_instruction, prompt, mock_fallback)

    async def generate_summary(self, doc_name: str, doc_text: str, target_length: str) -> str:
        """
        Compiles structural bullet summaries and action lists from text.
        """
        system_instruction = (
            "You are a professional research analyst. Summarize the provided document text clearly.\n"
            "Format the output using markdown: start with a brief summary paragraph, followed by a bulleted list "
            "of Key Findings, and end with an Action Items list."
        )
        
        prompt = (
            f"Document Title: {doc_name}\n"
            f"Target Length: {target_length}\n"
            f"Content to summarize:\n{doc_text[:12000]}" # Truncate to stay within prompt window
        )
        
        mock_fallback = (
            f"# Document Summary: {doc_name}\n\n"
            f"This summary highlights the core concepts extracted from the uploaded document.\n\n"
            f"### Key Findings\n"
            f"- **Core Themes**: Initial parsing indicates standard business operations and metadata schemas.\n"
            f"- **Target Length**: Optimized for a {target_length} brief layout.\n"
            f"- **Text Analysis**: Document size contains around {len(doc_text.split())} words.\n\n"
            f"### Action Items\n"
            f"1. Review full details in the dashboard inspector.\n"
            f"2. Execute semantic RAG search queries to inspect specific lines."
        )
        
        return await self._call_gemini(system_instruction, prompt, mock_fallback)

    async def generate_report(self, topic: str, outline: str, length: str) -> str:
        """
        Generates structured markdown reports (SWOT, proposals).
        """
        system_instruction = (
            "You are a management consultant. Write a comprehensive business report based on the topic and outline.\n"
            "Format the report using clean markdown headings, bold terms, and lists. Do not include HTML tags."
        )
        
        prompt = (
            f"Report Topic: {topic}\n"
            f"Outline Sections to write:\n{outline}\n"
            f"Target Size: {length}\n"
        )
        
        mock_fallback = (
            f"# Business Report: {topic}\n\n"
            f"## Executive Summary\n"
            f"This outlines the preliminary investigation regarding {topic}.\n\n"
            f"## SWOT Analysis\n"
            f"- **Strengths**: Scalable microservice designs and vector caching integrations.\n"
            f"- **Weaknesses**: Dependency constraints on local environment system tools.\n"
            f"- **Opportunities**: Auto-scaling streaming servers via Server-Sent Events.\n"
            f"- **Threats**: API key rate limiting restrictions under peak loads.\n\n"
            f"## Proposed Outline Review\n"
            f"Executing outlined plan sections:\n{outline.strip()}"
        )
        
        return await self._call_gemini(system_instruction, prompt, mock_fallback)

generator_service = GeneratorService()
