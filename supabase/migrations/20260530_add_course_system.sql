-- ========================================================================
-- 20260530_add_course_system.sql — Multi-course support for UPSC CSE & Medical Science
-- ========================================================================

-- 1. Add 'course' column to questions table
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS course TEXT DEFAULT 'UPSC CSE';

-- Comment explaining the column
COMMENT ON COLUMN public.questions.course IS 
'Course identifier: UPSC CSE, Medical Science, NEET PG, etc. Defaults to UPSC CSE for backward compatibility.';

-- 1b. Add 'sub_topic' column to questions table (4-level hierarchy support)
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS sub_topic TEXT;

-- Comment explaining the column
COMMENT ON COLUMN public.questions.sub_topic IS 
'Level 4 of taxonomy hierarchy. Full hierarchy: subject → section_group → micro_topic → sub_topic';

-- 2. Add 'course' column to tests table
ALTER TABLE public.tests 
ADD COLUMN IF NOT EXISTS course TEXT DEFAULT 'UPSC CSE';

COMMENT ON COLUMN public.tests.course IS 
'Course identifier for the test. Defaults to UPSC CSE.';

-- 3. Create indexes for faster course filtering
CREATE INDEX IF NOT EXISTS idx_questions_course ON public.questions(course);
CREATE INDEX IF NOT EXISTS idx_tests_course ON public.tests(course);

-- 4. Create a courses reference table (optional, for future use)
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,  -- 'UPSC CSE', 'Medical Science'
  code TEXT NOT NULL UNIQUE,  -- 'upsc_cse', 'medical_science'
  display_name TEXT NOT NULL, -- 'UPSC CSE', 'Medical Science'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default courses
INSERT INTO public.courses (name, code, display_name) VALUES
  ('UPSC CSE', 'upsc_cse', 'UPSC CSE'),
  ('Medical Science', 'medical_science', 'Medical Science')
ON CONFLICT (name) DO NOTHING;

-- 5. Add user course preference (optional, for future use)
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS selected_course TEXT DEFAULT 'UPSC CSE';

COMMENT ON COLUMN public.user_settings.selected_course IS 
'User's currently selected course. Stored in app context as well.';

-- ========================================================================
-- IMPORTANT: After running this migration:
-- ========================================================================
-- 1. All existing questions & tests are tagged as 'UPSC CSE' (backward compatible)
-- 2. When adding Medical Science questions, explicitly set course='Medical Science'
-- 3. App will filter based on useCourse() context hook
-- 4. Flashcards remain shared (no course column, visible in all courses)
