-- ==========================================================================
-- Migration: Add Admin RLS Policies and Course Field for User Subscriptions
-- Date: 2026-07-04
-- Description: Enables authenticated administrators to read all users and
-- manage user settings. Also adds course-level purchase tracking to subscriptions.
-- ==========================================================================

-- Enable RLS on users table if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all users (needed by Admin Panel)
DROP POLICY IF EXISTS "Auth can read all users" ON users;
CREATE POLICY "Auth can read all users"
  ON users FOR SELECT
  USING (auth.role() = 'authenticated');

-- Enable RLS on user_settings table if not already enabled
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage all user_settings (needed by Admin Panel)
DROP POLICY IF EXISTS "Auth can manage all user_settings" ON user_settings;
CREATE POLICY "Auth can manage all user_settings"
  ON user_settings FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Add course_name column to user_subscriptions table to track which course a plan purchase applies to
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS course_name TEXT;

-- Comment on course_name column
COMMENT ON COLUMN user_subscriptions.course_name IS
  'The course that this subscription purchase applies to (e.g., UPSC CSE, Medical Science).';
