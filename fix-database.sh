#!/bin/bash
# Fix database schema for Ibiki SMS

echo "=== FIXING DATABASE SCHEMA ==="
sudo -u postgres psql -d ibiki << 'EOF'
-- Create users table with proper schema
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert admin user
INSERT INTO users (email, username, password, name, role) 
VALUES ('admin@example.com', 'admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'System Administrator', 'admin') 
ON CONFLICT (email) DO NOTHING;

-- Verify setup
SELECT COUNT(*) as total_users FROM users;
SELECT * FROM users LIMIT 1;
EOF

echo "=== DATABASE FIXED ==="
pm2 restart ibiki-sms
echo "=== APPLICATION RESTARTED ==="