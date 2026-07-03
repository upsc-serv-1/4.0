-- ========================================================================
-- 20260703_add_test_info_to_mains_questions.sql — Add test-level columns
-- ========================================================================

ALTER TABLE public.mains_questions
ADD COLUMN IF NOT EXISTS course TEXT,
ADD COLUMN IF NOT EXISTS institute TEXT,
ADD COLUMN IF NOT EXISTS program_id TEXT,
ADD COLUMN IF NOT EXISTS program_name TEXT;

COMMENT ON COLUMN public.mains_questions.course IS 'Course category, e.g. "Civil Services".';
COMMENT ON COLUMN public.mains_questions.institute IS 'Coaching institute name, e.g. "Forum IAS".';
COMMENT ON COLUMN public.mains_questions.program_id IS 'Program identifier, e.g. "mgp".';
COMMENT ON COLUMN public.mains_questions.program_name IS 'Program name, e.g. "MGP".';
