-- ========================================================================
-- 20260704_mains_question_states.sql — User question states for Mains & Optional Tab
-- ========================================================================

CREATE TABLE IF NOT EXISTS public.mains_question_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.mains_questions(id) ON DELETE CASCADE,
  confidence TEXT CHECK (confidence IN ('low', 'medium', 'high', 'guess')),
  difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
  review_tags JSONB DEFAULT '[]'::jsonb,
  note TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_mains_question UNIQUE (user_id, question_id)
);

COMMENT ON TABLE public.mains_question_states IS 'Stores user-specific states (revision tags, notes, confidence, difficulty) for Mains/Subjective questions.';

-- Enable Row Level Security (RLS)
ALTER TABLE public.mains_question_states ENABLE ROW LEVEL SECURITY;

-- Policies for RLS
DROP POLICY IF EXISTS "Users can manage their own mains question states" ON public.mains_question_states;
CREATE POLICY "Users can manage their own mains question states"
  ON public.mains_question_states
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mains_qstates_user_q ON public.mains_question_states(user_id, question_id);
