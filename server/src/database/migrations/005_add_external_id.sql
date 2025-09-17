-- Add external_id column to documents table for OpenAI vector store file IDs
-- This allows us to optimize vector search by limiting search space to user's documents

ALTER TABLE documents 
ADD COLUMN external_id VARCHAR(255);

-- Add index for faster lookups by external_id
CREATE INDEX idx_documents_external_id ON documents(external_id);

-- Add index for user_id + external_id combination for optimized queries
CREATE INDEX idx_documents_user_external_id ON documents(user_id, external_id) WHERE external_id IS NOT NULL;
