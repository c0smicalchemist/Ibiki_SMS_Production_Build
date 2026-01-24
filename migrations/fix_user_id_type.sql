-- Fix user_id type mismatch (users.id is VARCHAR not INTEGER)

DROP TABLE IF EXISTS number_assignments CASCADE;
DROP TABLE IF EXISTS content_modifications CASCADE;

-- Number assignments with correct user_id type
CREATE TABLE number_assignments (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
  recipient_phone VARCHAR(20) NOT NULL,
  assigned_number VARCHAR(20) REFERENCES anveo_numbers(phone_number) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  UNIQUE(user_id, recipient_phone)
);

CREATE INDEX idx_number_assignments_lookup ON number_assignments(user_id, recipient_phone);
CREATE INDEX idx_number_assignments_number ON number_assignments(assigned_number);

-- Content modifications with correct user_id type
CREATE TABLE content_modifications (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  message_id INTEGER,
  original_text TEXT NOT NULL,
  modified_text TEXT NOT NULL,
  risk_score INTEGER DEFAULT 0,
  modifications JSONB,
  action_taken VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_content_mods_user ON content_modifications(user_id);
CREATE INDEX idx_content_mods_risk ON content_modifications(risk_score DESC);
CREATE INDEX idx_content_mods_created ON content_modifications(created_at DESC);

-- Grant permissions
GRANT ALL ON number_assignments TO ibiki_user;
GRANT ALL ON content_modifications TO ibiki_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ibiki_user;
