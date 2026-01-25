-- Create security_events table for Cloud SQL PostgreSQL
-- This table stores security audit logs

CREATE TABLE IF NOT EXISTS security_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    user_id INTEGER,
    ip_address VARCHAR(45) NOT NULL,
    user_agent VARCHAR(500),
    details TEXT,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_security_events_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS ix_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS ix_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS ix_security_events_created_at ON security_events(created_at);
CREATE INDEX IF NOT EXISTS ix_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS ix_security_events_type_created ON security_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS ix_security_events_user_created ON security_events(user_id, created_at);
