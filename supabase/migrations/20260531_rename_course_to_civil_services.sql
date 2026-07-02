-- ========================================================================
-- 20260531_rename_course_to_civil_services.sql
-- Rename primary course 'UPSC CSE' to 'Civil Services'
-- ========================================================================

-- 1. Update course defaults to 'Civil Services'
ALTER TABLE public.questions ALTER COLUMN course SET DEFAULT 'Civil Services';
ALTER TABLE public.tests ALTER COLUMN course SET DEFAULT 'Civil Services';
ALTER TABLE public.user_settings ALTER COLUMN selected_course SET DEFAULT 'Civil Services';

-- 2. Update existing rows in courses table
UPDATE public.courses 
SET name = 'Civil Services', code = 'civil_services', display_name = 'Civil Services'
WHERE name = 'UPSC CSE';

-- 3. Update existing questions and tests from 'UPSC CSE' to 'Civil Services'
UPDATE public.questions 
SET course = 'Civil Services' 
WHERE course = 'UPSC CSE';

UPDATE public.tests 
SET course = 'Civil Services' 
WHERE course = 'UPSC CSE';

-- 4. Update user_settings selected_course
UPDATE public.user_settings 
SET selected_course = 'Civil Services' 
WHERE selected_course = 'UPSC CSE';
