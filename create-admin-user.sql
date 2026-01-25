-- Create Admin User
-- Email: admin@pantry.com
-- Password: Admin12345

INSERT INTO users (
    email,
    password_hash,
    full_name,
    role,
    email_verified,
    is_active,
    created_at,
    updated_at
) VALUES (
    'admin@pantry.com',
    '$2b$12$/.PFO3slMxIOQmLY95f06OwCXcNYo/N/Rv7LIPYqlH9gfsjWERxou',
    'Admin User',
    'admin',
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT (email) DO NOTHING;

-- Verify user was created
SELECT id, email, role, is_active, created_at FROM users WHERE email = 'admin@pantry.com';
