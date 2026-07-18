-- ========================================================================
-- 20260718_create_mains_notes.sql — Mains Markdown Notes Hub schema
-- ========================================================================

CREATE TABLE IF NOT EXISTS public.mains_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  
  -- Syllabus Hierarchy fields
  paper TEXT NOT NULL,          -- e.g. 'GS1', 'GS2', 'Optional'
  subject TEXT NOT NULL,        -- Normalized (e.g. 'ANTHROPOLOGY', 'HISTORY')
  section_group TEXT,           -- e.g. 'Paper I', 'Modern India'
  microtopic TEXT,              -- e.g. 'Unit 9'
  subtopic TEXT,                -- e.g. '9.3 Genetic polymorphism'
  nanotopic TEXT,               -- e.g. 'Scope'
  
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  revision_tags TEXT[] NOT NULL DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.mains_notes IS 'Stores user-created long-form Markdown notes with syllabus hierarchy.';

-- Enable Row Level Security (RLS)
ALTER TABLE public.mains_notes ENABLE ROW LEVEL SECURITY;

-- Policies for RLS
DROP POLICY IF EXISTS "Users can manage their own mains notes" ON public.mains_notes;
CREATE POLICY "Users can manage their own mains notes"
  ON public.mains_notes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_mains_notes_user ON public.mains_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_mains_notes_hierarchy ON public.mains_notes(paper, subject, section_group, microtopic);
