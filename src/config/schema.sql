-- BidLan Supabase Database Schema
-- Run this in your Supabase SQL Editor to set up the tables

-- ─── Users Table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  profile_pic TEXT DEFAULT '',
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── User Settings Table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  theme VARCHAR(20) DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  language VARCHAR(10) DEFAULT 'en',
  default_pixel VARCHAR(10) DEFAULT '720' CHECK (default_pixel IN ('360', '480', '720', '1080')),
  notifications_enabled BOOLEAN DEFAULT true,
  autoplay BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Saved Videos Table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  video_id VARCHAR(255) NOT NULL,
  platform VARCHAR(20) DEFAULT 'youtube',
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, video_id)
);

-- ─── Uploaded Videos Metadata ──────────────────────────────────
CREATE TABLE IF NOT EXISTS uploaded_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  video_id VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT DEFAULT '',
  category VARCHAR(100) DEFAULT 'general',
  thumbnail_url TEXT DEFAULT '',
  video_url TEXT NOT NULL,
  duration VARCHAR(20) DEFAULT '0:00',
  duration_seconds INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  language VARCHAR(10) DEFAULT 'en',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'processing', 'removed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Characters Table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS characters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  image_url TEXT DEFAULT '',
  role VARCHAR(100) DEFAULT '',
  personality TEXT DEFAULT '',
  background TEXT DEFAULT '',
  traits JSONB DEFAULT '[]'::JSONB,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_characters_user_id ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_is_public ON characters(is_public);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_videos_user_id ON saved_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_videos_user_id ON uploaded_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_videos_category ON uploaded_videos(category);
CREATE INDEX IF NOT EXISTS idx_uploaded_videos_status ON uploaded_videos(status);

-- ─── Updated At Trigger ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_uploaded_videos_updated_at
  BEFORE UPDATE ON uploaded_videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
