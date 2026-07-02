-- ========================================================================
-- 20260702_alter_mains_questions_marks.sql — Alter marks column type to NUMERIC
-- ========================================================================

-- Alter marks column from INTEGER to NUMERIC to support floating point marks (like 12.5)
ALTER TABLE public.mains_questions
ALTER COLUMN marks TYPE NUMERIC;

-- Comment for documentation
COMMENT ON COLUMN public.mains_questions.marks IS 'Marks awarded for the question, changed to NUMERIC to support fractional marks.';
