-- ========================================================================
-- 20260716_mains_value_add_states.sql — User value addition states for Mains Tab
-- ========================================================================

CREATE TABLE IF NOT EXISTS public.mains_value_add_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  review_tags JSONB DEFAULT '[]'::jsonb,
  content JSONB DEFAULT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_mains_value_add UNIQUE (user_id, card_id)
);

-- If the table already exists from a previous step, run this SQL statement to add the column:
-- ALTER TABLE public.mains_value_add_states ADD COLUMN IF NOT EXISTS content JSONB DEFAULT NULL;


COMMENT ON TABLE public.mains_value_add_states IS 'Stores user-specific revision tags for Value Addition cards.';

-- Enable Row Level Security (RLS)
ALTER TABLE public.mains_value_add_states ENABLE ROW LEVEL SECURITY;

-- Policies for RLS
DROP POLICY IF EXISTS "Users can manage their own mains value add states" ON public.mains_value_add_states;
CREATE POLICY "Users can manage their own mains value add states"
  ON public.mains_value_add_states
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mains_vastates_user_card ON public.mains_value_add_states(user_id, card_id);
