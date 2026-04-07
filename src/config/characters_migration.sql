-- Characters Migration
CREATE TABLE IF NOT EXISTS characters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL if preset by admin
  name VARCHAR(255) NOT NULL,
  image_url TEXT DEFAULT '',
  role VARCHAR(100) DEFAULT '',
  personality TEXT DEFAULT '',
  background TEXT DEFAULT '',
  traits JSONB DEFAULT '[]'::JSONB,
  is_public BOOLEAN DEFAULT false, -- If true, it is available to all users as preset
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_characters_user_id ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_is_public ON characters(is_public);

CREATE OR REPLACE TRIGGER update_characters_updated_at
  BEFORE UPDATE ON characters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
