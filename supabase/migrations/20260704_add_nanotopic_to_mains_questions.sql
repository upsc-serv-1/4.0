-- ========================================================================
-- 20260704_add_nanotopic_to_mains_questions.sql — Add nanotopic column
-- ========================================================================

-- Add nanotopic column to mains_questions table to support 5-layer optional subject (Anthropology) syllabus taxonomy.
ALTER TABLE public.mains_questions ADD COLUMN IF NOT EXISTS nanotopic TEXT;

COMMENT ON COLUMN public.mains_questions.nanotopic IS 'Syllabus layer 5 (nanotopic) below subtopic, specifically used for optional subjects like Anthropology.';
