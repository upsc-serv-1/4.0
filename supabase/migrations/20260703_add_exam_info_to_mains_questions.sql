-- ========================================================================
-- 20260703_add_exam_info_to_mains_questions.sql — Add metadata columns
-- ========================================================================

ALTER TABLE public.mains_questions
ADD COLUMN IF NOT EXISTS is_pyq BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS source_attribution_label TEXT,
ADD COLUMN IF NOT EXISTS exam_info JSONB,
-- Explicit metadata columns matching Prelims table structure
ADD COLUMN IF NOT EXISTS stage TEXT,
ADD COLUMN IF NOT EXISTS exam TEXT,
ADD COLUMN IF NOT EXISTS exam_group TEXT,
ADD COLUMN IF NOT EXISTS is_upsc_cse BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_allied BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_others BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS exam_category TEXT;

COMMENT ON COLUMN public.mains_questions.is_pyq IS 'Flag indicating if the question is an official PYQ or a test series question.';
COMMENT ON COLUMN public.mains_questions.source_attribution_label IS 'Descriptive text for the source/attribution of the question.';
COMMENT ON COLUMN public.mains_questions.exam_info IS 'Detailed JSON metadata block containing exam classification info.';
COMMENT ON COLUMN public.mains_questions.stage IS 'Exam stage, e.g. "prelims" or "mains".';
COMMENT ON COLUMN public.mains_questions.exam IS 'Specific exam name, e.g. "Mains".';
COMMENT ON COLUMN public.mains_questions.exam_group IS 'Exam grouping, e.g. "UPSC CSE".';
COMMENT ON COLUMN public.mains_questions.is_upsc_cse IS 'Boolean flag indicating if the exam is UPSC Civil Services Exam.';
COMMENT ON COLUMN public.mains_questions.is_allied IS 'Boolean flag indicating if the exam is an allied services exam.';
COMMENT ON COLUMN public.mains_questions.is_others IS 'Boolean flag indicating if the exam is another category.';
COMMENT ON COLUMN public.mains_questions.exam_category IS 'Exam category, e.g. "cse".';
