-- Migration: 004_remove_document_embeddings.sql
-- Description: Remove unused document_embeddings table since we use OpenAI Vector Store
-- Applied: 2025-01-14
-- Drop the document_embeddings table and all its indexes
-- This table was never populated and is redundant with OpenAI Vector Store
-- Drop indexes first
DROP INDEX IF EXISTS idx_document_embeddings_document_id;

DROP INDEX IF EXISTS idx_document_embeddings_chunk_index;

DROP INDEX IF EXISTS idx_document_embeddings_created_at;

DROP INDEX IF EXISTS idx_document_embeddings_user_id;

-- Drop the table
DROP TABLE IF EXISTS document_embeddings;

-- Add comment explaining the removal
COMMENT ON SCHEMA public IS 'Document embeddings table removed - using OpenAI Vector Store for semantic search instead';