-- Migration: 002_add_embeddings.sql
-- Description: Add document embeddings table for semantic search
-- Applied: 2025-09-03

-- Document embeddings table - stores vector embeddings for semantic search
CREATE TABLE document_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    chunk_text TEXT NOT NULL,
    embedding REAL[], -- OpenAI ada-002 embedding as array of floats
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_chunk_index CHECK (chunk_index >= 0),
    CONSTRAINT valid_chunk_text CHECK (chunk_text != ''),
    CONSTRAINT valid_embedding_length CHECK (array_length(embedding, 1) = 1536)
);

-- Create indexes for embeddings
CREATE INDEX idx_document_embeddings_document_id ON document_embeddings(document_id);
CREATE INDEX idx_document_embeddings_chunk_index ON document_embeddings(document_id, chunk_index);
CREATE INDEX idx_document_embeddings_created_at ON document_embeddings(created_at DESC);
