# AI Business Automation Studio

AI Business Automation Studio is a premium, production-ready AI SaaS application built to automate document analysis (RAG), meeting transcription (Whisper), professional email generation, slide creations (PPTX), and visual workflow executions.

This repository is organized as a monorepo containing:
- **`frontend/`**: Next.js 15 App Router interface styled using Tailwind CSS, Vanilla CSS, and Framer Motion.
- **`backend/`**: FastAPI (Python 3.12) backend handling LLM orchestrations, RAG search pipelines, database queries, and background processes.
- **`supabase/`**: Migration schema files setting up table architecture and Row Level Security.

---

## Technical Stack & Infrastructure

- **Frontend**: Next.js 15, React 19, Tailwind CSS, Framer Motion, Supabase Client SDK.
- **Backend**: FastAPI, Uvicorn, LangChain, Gemini API / OpenAI API.
- **Database**: Supabase PostgreSQL + `pgvector` for semantic embeddings.
- **Auth & Storage**: Supabase Auth (JWT) & Supabase Storage.
- **Deployments**: Vercel (Frontend), Render / Docker (Backend), Docker Compose (Fullstack Local Orchestration).

---

## Core Product Features

### 1. Document Library & OCR RAG Search
- OCR text extraction (PDF, DOCX, TXT, CSV, PNG, JPG).
- Paragraph splits (800 size, 150 overlap) with vector embeddings saved to PostgreSQL.
- Cosine similarity matching RAG query endpoints.

### 2. Live SSE Chat Stream
- Real-time token events streaming via LangChain async loops.
- File references indexing, citing relevant source context inside responses.

### 3. AI Presentation & Transcriber Generators
- PPTX presentation generation with styled templates (Charcoal gray backgrounds, neon purple accent highlights) downloadable directly in-browser.
- Whisper audio transcript extractor uploading results to Supabase Storage and background vector RAG engines.

### 4. Sequential Workflows Canvas Builder
- Visual automation steps creator (Trigger Node -> AI Document Summarizer -> AI Outreach Email drafts).
- manual execution triggers saving run history outputs logs.

### 5. Administration Analytics Dashboard
- KPI counts tracking registered profile directories, file size storage footprint, and token feature units consumed.

---

## Environment Variables

Configure files named `.env` in both folders matching the structure below:

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Backend (`backend/.env`)
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-optional-openai-api-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
JWT_SECRET=your-supabase-project-jwt-secret
```

---

## Installation & Deployment

### 1. Unified Container Deployment (Docker Compose)
To compile and launch the full-stack database, FastAPI app, and Next.js client under local orchestration:
```bash
docker-compose up --build
```
- Frontend client will be served at: `http://localhost:3000`
- Backend API docs will be served at: `http://localhost:8000/docs`

### 2. Manual Verification
Run frontend TypeScript compile type safety checks:
```bash
cd frontend
npx tsc --noEmit
```

Run backend pytest verification suite:
```bash
cd backend
python -m pytest tests
```
