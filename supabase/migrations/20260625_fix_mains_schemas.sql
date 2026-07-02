-- ========================================================================
-- 20260625_fix_mains_schemas.sql — Recreate mains_essay_value_add cleanly
-- ========================================================================

-- Recreate mains_essay_value_add table to ensure it has all columns (including paper, entry_type, etc.)
DROP TABLE IF EXISTS public.mains_essay_value_add;

CREATE TABLE public.mains_essay_value_add (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper TEXT,
  subject TEXT,
  section_group TEXT,
  microtopic TEXT,
  subtopic TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('anecdote', 'quote')) DEFAULT 'anecdote',
  content TEXT NOT NULL, -- Verbatim anecdote or quote text
  author TEXT,
  usage_guide TEXT,
  hierarchy_path TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.mains_essay_value_add IS 'Stores anecdotes, quotes and usage guides for essay writing.';
