-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: create_user_ai_prompts
-- Stores user's AI prompt customizations (explain, summarize, search, save_sheet)
-- across all devices. Each user has one row per prompt_key.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_key TEXT NOT NULL CHECK (prompt_key IN ('ai_prompt_explain', 'ai_prompt_summarize', 'ai_prompt_search', 'pilot-v2:save-sheet:ai-preset-prompt')),
  prompt_text TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Enforce one row per user per prompt_key
  UNIQUE (user_id, prompt_key)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_user_ai_prompts_user_id ON user_ai_prompts(user_id);

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_user_ai_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_ai_prompts_updated_at ON user_ai_prompts;
CREATE TRIGGER trg_user_ai_prompts_updated_at
  BEFORE UPDATE ON user_ai_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_user_ai_prompts_updated_at();

-- Enable Row Level Security
ALTER TABLE user_ai_prompts ENABLE ROW LEVEL SECURITY;

-- Users can only read their own prompts
CREATE POLICY select_own_ai_prompts ON user_ai_prompts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own prompts
CREATE POLICY insert_own_ai_prompts ON user_ai_prompts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own prompts
CREATE POLICY update_own_ai_prompts ON user_ai_prompts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own prompts
CREATE POLICY delete_own_ai_prompts ON user_ai_prompts
  FOR DELETE
  USING (auth.uid() = user_id);
