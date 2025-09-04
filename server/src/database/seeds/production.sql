-- Production seed data
-- This file contains minimal production setup (no sample data)

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

-- Create function to clean up orphaned files
CREATE OR REPLACE FUNCTION cleanup_orphaned_files()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Mark orphaned files as deleted
    UPDATE file_storage
    SET is_deleted = TRUE
    WHERE file_type = 'temp'
    AND last_accessed < CURRENT_TIMESTAMP - INTERVAL '24 hours';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
