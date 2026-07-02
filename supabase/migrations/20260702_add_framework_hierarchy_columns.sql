-- ========================================================================
-- 20260702_add_framework_hierarchy_columns.sql — Add hierarchy columns to mains_frameworks
-- ========================================================================

-- Add columns hierarchy_1_path through hierarchy_5_path to support multi-syllabus column indexing
ALTER TABLE public.mains_frameworks
ADD COLUMN IF NOT EXISTS hierarchy_1_path TEXT[],
ADD COLUMN IF NOT EXISTS hierarchy_2_path TEXT[],
ADD COLUMN IF NOT EXISTS hierarchy_3_path TEXT[],
ADD COLUMN IF NOT EXISTS hierarchy_4_path TEXT[],
ADD COLUMN IF NOT EXISTS hierarchy_5_path TEXT[];

-- Comments for documentation
COMMENT ON COLUMN public.mains_frameworks.hierarchy_1_path IS 'Syllabus path array for first associated syllabus mapping.';
COMMENT ON COLUMN public.mains_frameworks.hierarchy_2_path IS 'Syllabus path array for second associated syllabus mapping.';
COMMENT ON COLUMN public.mains_frameworks.hierarchy_3_path IS 'Syllabus path array for third associated syllabus mapping.';
COMMENT ON COLUMN public.mains_frameworks.hierarchy_4_path IS 'Syllabus path array for fourth associated syllabus mapping.';
COMMENT ON COLUMN public.mains_frameworks.hierarchy_5_path IS 'Syllabus path array for fifth associated syllabus mapping.';
