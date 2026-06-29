-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create profiles table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create workspaces table
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Create documents table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Supabase storage path
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL, -- pending, processing, completed, failed
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Create document_chunks table (for RAG vector search)
-- text-embedding-004 from Gemini produces 768 dimensions
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(768) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on document_chunks
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'New Conversation' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on chat_sessions
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    citations JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create transcripts table
CREATE TABLE IF NOT EXISTS public.transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    raw_transcript TEXT NOT NULL,
    summary TEXT,
    action_items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on transcripts
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

-- Create workflows table
CREATE TABLE IF NOT EXISTS public.workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    steps JSONB DEFAULT '[]'::jsonb NOT NULL, -- JSON array of steps/nodes
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on workflows
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

-- Create workflow_executions table
CREATE TABLE IF NOT EXISTS public.workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL, -- pending, running, completed, failed
    input_data JSONB DEFAULT '{}'::jsonb NOT NULL,
    output_data JSONB DEFAULT '{}'::jsonb NOT NULL,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Enable RLS on workflow_executions
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

-- Create usage_statistics table
CREATE TABLE IF NOT EXISTS public.usage_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    feature TEXT NOT NULL, -- 'chat_tokens', 'ocr_pages', 'whisper_minutes', 'document_upload'
    units_used INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on usage_statistics
ALTER TABLE public.usage_statistics ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- CREATE FUNCTIONS & TRIGGERS
-- =========================================================================

-- Trigger to automatically handle profiles creation when auth.users is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
        COALESCE(new.raw_user_meta_data->>'avatar_url', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_chat_sessions_updated_at
    BEFORE UPDATE ON public.chat_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_workflows_updated_at
    BEFORE UPDATE ON public.workflows
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- INDEXES
-- =========================================================================

-- Vector index for fast cosine distance calculations (using Ivfflat or HNSW)
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
ON public.document_chunks 
USING hnsw (embedding vector_cosine_ops);

-- Standard indexes for performance
CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON public.document_chunks (document_id);
CREATE INDEX IF NOT EXISTS documents_workspace_id_idx ON public.documents (workspace_id);
CREATE INDEX IF NOT EXISTS documents_user_id_idx ON public.documents (user_id);
CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx ON public.chat_sessions (user_id);
CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON public.chat_messages (session_id);
CREATE INDEX IF NOT EXISTS workflows_user_id_idx ON public.workflows (user_id);
CREATE INDEX IF NOT EXISTS workflow_executions_workflow_id_idx ON public.workflow_executions (workflow_id);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Profiles: Users can read/update their own profile
CREATE POLICY "Users can view own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- Workspaces: Users can view workspaces they own
CREATE POLICY "Users can view workspaces they own" 
    ON public.workspaces FOR SELECT 
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can create workspaces" 
    ON public.workspaces FOR INSERT 
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update workspaces they own" 
    ON public.workspaces FOR UPDATE 
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete workspaces they own" 
    ON public.workspaces FOR DELETE 
    USING (auth.uid() = owner_id);

-- Documents: Users can access documents they uploaded or in workspaces they own
CREATE POLICY "Users can view own documents" 
    ON public.documents FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents" 
    ON public.documents FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents" 
    ON public.documents FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents" 
    ON public.documents FOR DELETE 
    USING (auth.uid() = user_id);

-- Document Chunks: Users can access chunks of documents they own
CREATE POLICY "Users can view document chunks of own documents" 
    ON public.document_chunks FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM public.documents d 
        WHERE d.id = document_chunks.document_id AND d.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert document chunks for own documents" 
    ON public.document_chunks FOR INSERT 
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.documents d 
        WHERE d.id = document_chunks.document_id AND d.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete document chunks of own documents" 
    ON public.document_chunks FOR DELETE 
    USING (EXISTS (
        SELECT 1 FROM public.documents d 
        WHERE d.id = document_chunks.document_id AND d.user_id = auth.uid()
    ));

-- Chat Sessions
CREATE POLICY "Users can view own chat sessions" 
    ON public.chat_sessions FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat sessions" 
    ON public.chat_sessions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions" 
    ON public.chat_sessions FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat sessions" 
    ON public.chat_sessions FOR DELETE 
    USING (auth.uid() = user_id);

-- Chat Messages
CREATE POLICY "Users can view messages of own chat sessions" 
    ON public.chat_messages FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM public.chat_sessions s 
        WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert messages to own chat sessions" 
    ON public.chat_messages FOR INSERT 
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.chat_sessions s 
        WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()
    ));

-- Transcripts
CREATE POLICY "Users can view transcripts of own documents" 
    ON public.transcripts FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM public.documents d 
        WHERE d.id = transcripts.document_id AND d.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert transcripts for own documents" 
    ON public.transcripts FOR INSERT 
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.documents d 
        WHERE d.id = transcripts.document_id AND d.user_id = auth.uid()
    ));

-- Workflows
CREATE POLICY "Users can view own workflows" 
    ON public.workflows FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workflows" 
    ON public.workflows FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workflows" 
    ON public.workflows FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workflows" 
    ON public.workflows FOR DELETE 
    USING (auth.uid() = user_id);

-- Workflow Executions
CREATE POLICY "Users can view workflow executions" 
    ON public.workflow_executions FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM public.workflows w 
        WHERE w.id = workflow_executions.workflow_id AND w.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert workflow executions" 
    ON public.workflow_executions FOR INSERT 
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.workflows w 
        WHERE w.id = workflow_executions.workflow_id AND w.user_id = auth.uid()
    ));

-- Usage Statistics
CREATE POLICY "Users can view own usage stats" 
    ON public.usage_statistics FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage stats" 
    ON public.usage_statistics FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
