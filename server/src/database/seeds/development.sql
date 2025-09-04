-- Development seed data
-- This file contains sample data for local development

-- Insert sample document for testing
INSERT INTO documents (filename, original_filename, content, file_path, file_size, mime_type, document_type, metadata)
VALUES (
    'sample-document.txt',
    'sample-document.txt',
    'This is a sample document for testing the database setup.',
    '/uploads/documents/2024/01/sample-document.txt',
    1024,
    'text/plain',
    'text',
    '{"test": true, "category": "sample"}'
) ON CONFLICT DO NOTHING;

-- Insert sample chat message
INSERT INTO chat_messages (session_id, role, content, document_ids)
VALUES (
    'test-session-001',
    'user',
    'Hello, can you help me with this document?',
    ARRAY[]::UUID[]
) ON CONFLICT DO NOTHING;

-- Create views for common queries
CREATE OR REPLACE VIEW document_summary AS
SELECT
    document_type,
    COUNT(*) as count,
    AVG(file_size) as avg_size,
    MIN(uploaded_at) as oldest,
    MAX(uploaded_at) as newest
FROM documents
GROUP BY document_type;

CREATE OR REPLACE VIEW storage_usage AS
SELECT
    file_type,
    COUNT(*) as file_count,
    SUM(file_size) as total_size,
    AVG(file_size) as avg_size
FROM file_storage
WHERE NOT is_deleted
GROUP BY file_type;
