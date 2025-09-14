-- Migration: 003_add_user_management.sql
-- Description: Add user management tables and update existing schema for user isolation
-- Applied: 2025-01-27

-- Users table - stores user account information
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_password_hash CHECK (password_hash != ''),
    CONSTRAINT valid_first_name CHECK (first_name IS NULL OR first_name != ''),
    CONSTRAINT valid_last_name CHECK (last_name IS NULL OR last_name != '')
);

-- User sessions table - for JWT token management and blacklisting
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_jti VARCHAR(255) UNIQUE NOT NULL, -- JWT ID for token tracking
    refresh_token_hash VARCHAR(255) NOT NULL, -- Hashed refresh token
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_revoked BOOLEAN DEFAULT FALSE,
    user_agent TEXT,
    ip_address INET,
    
    -- Constraints
    CONSTRAINT valid_token_jti CHECK (token_jti != ''),
    CONSTRAINT valid_refresh_token_hash CHECK (refresh_token_hash != ''),
    CONSTRAINT valid_expires_at CHECK (expires_at > created_at)
);

-- Add user_id columns to existing tables for data isolation
ALTER TABLE documents ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE file_storage ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_last_login ON users(last_login DESC);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token_jti ON user_sessions(token_jti);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_is_revoked ON user_sessions(is_revoked);
CREATE INDEX idx_user_sessions_created_at ON user_sessions(created_at DESC);

-- Add indexes for user_id foreign keys
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_file_storage_user_id ON file_storage(user_id);

-- Create composite indexes for common queries
CREATE INDEX idx_documents_user_uploaded_at ON documents(user_id, uploaded_at DESC);
CREATE INDEX idx_chat_messages_user_session ON chat_messages(user_id, session_id);
CREATE INDEX idx_file_storage_user_type ON file_storage(user_id, file_type);

-- Apply updated_at trigger to users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP 
    OR (is_revoked = TRUE AND created_at < CURRENT_TIMESTAMP - INTERVAL '7 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user statistics
CREATE OR REPLACE FUNCTION get_user_stats(user_uuid UUID)
RETURNS TABLE (
    document_count BIGINT,
    chat_message_count BIGINT,
    total_file_size BIGINT,
    last_activity TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::BIGINT FROM documents WHERE user_id = user_uuid) as document_count,
        (SELECT COUNT(*)::BIGINT FROM chat_messages WHERE user_id = user_uuid) as chat_message_count,
        (SELECT COALESCE(SUM(file_size), 0)::BIGINT FROM file_storage WHERE user_id = user_uuid) as total_file_size,
        (SELECT MAX(GREATEST(
            COALESCE((SELECT MAX(uploaded_at) FROM documents WHERE user_id = user_uuid), '1970-01-01'::timestamp),
            COALESCE((SELECT MAX(timestamp) FROM chat_messages WHERE user_id = user_uuid), '1970-01-01'::timestamp)
        )) as last_activity);
END;
$$ LANGUAGE plpgsql;

-- Note: No default admin user is created for security reasons
-- Create admin users through the API or database directly after deployment
-- Use strong, unique passwords and enable 2FA if possible

-- Add comments for documentation
COMMENT ON TABLE users IS 'User accounts with authentication and profile information';
COMMENT ON TABLE user_sessions IS 'JWT session management and token blacklisting';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hashed password with 12+ salt rounds';
COMMENT ON COLUMN user_sessions.token_jti IS 'JWT ID for tracking and blacklisting tokens';
COMMENT ON COLUMN user_sessions.refresh_token_hash IS 'Hashed refresh token for security';
COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Removes expired and old revoked sessions';
COMMENT ON FUNCTION get_user_stats(UUID) IS 'Returns user activity statistics and usage metrics';
