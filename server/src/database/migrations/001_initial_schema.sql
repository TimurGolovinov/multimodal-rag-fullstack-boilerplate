-- Migration: 001_initial_schema.sql
-- Description: Create initial database schema
-- Applied: 2025-09-03

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Documents table - stores document metadata and content
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    content TEXT,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    mime_type VARCHAR(100) NOT NULL,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('text', 'image', 'audio', 'video', 'pdf', 'word')),
    thumbnail_path VARCHAR(500),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    processing_status VARCHAR(50) DEFAULT 'completed' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,

    -- Constraints
    CONSTRAINT valid_file_path CHECK (file_path != ''),
    CONSTRAINT valid_filename CHECK (filename != '')
);

-- Chat messages table - stores conversation history
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    document_ids UUID[] DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- File storage tracking table - for cleanup and management
CREATE TABLE file_storage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_path VARCHAR(500) NOT NULL UNIQUE,
    file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('document', 'thumbnail', 'temp')),
    file_size BIGINT NOT NULL,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Create indexes for performance
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_uploaded_at ON documents(uploaded_at DESC);
CREATE INDEX idx_documents_filename ON documents(filename);
CREATE INDEX idx_documents_processing_status ON documents(processing_status);
CREATE INDEX idx_documents_metadata_gin ON documents USING GIN (metadata);

CREATE INDEX idx_chat_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_timestamp ON chat_messages(timestamp DESC);
CREATE INDEX idx_chat_document_ids ON chat_messages USING GIN (document_ids);

CREATE INDEX idx_file_storage_path ON file_storage(file_path);
CREATE INDEX idx_file_storage_type ON file_storage(file_type);
CREATE INDEX idx_file_storage_last_accessed ON file_storage(last_accessed);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers for updated_at
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
