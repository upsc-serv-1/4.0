-- ========================================================================
-- 20260625_mains_tab_schemas.sql — Database Schemas for Mains & Optional Tab
-- ========================================================================

-- Enable uuid-ossp if not already enabled (for gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================================================
-- Sub-App 1: Mains Questions & Coaching Answers
-- ========================================================================

-- 1. Create mains_questions table
CREATE TABLE IF NOT EXISTS public.mains_questions (
  id TEXT PRIMARY KEY,
  question_number INTEGER,
  question_text TEXT NOT NULL,
  marks INTEGER,
  exam_year INTEGER,
  paper TEXT, -- e.g. 'GS1', 'GS2', 'GS3', 'GS4', 'Optional'
  subject TEXT, -- e.g. 'GEOGRAPHY', 'HISTORY', 'SOCIETY'
  section_group TEXT,
  microtopic TEXT,
  subtopic TEXT,
  hierarchy_path TEXT[], -- Dynamic 4, 5, or 6-layer syllabus path
  macrotag TEXT, -- e.g. 'Descriptive, Applied'
  microtag TEXT, -- e.g. 'Explain, India'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments for documentation
COMMENT ON TABLE public.mains_questions IS 'Stores subjective Mains and Optional questions and their syllabus hierarchy.';
COMMENT ON COLUMN public.mains_questions.hierarchy_path IS 'Syllabus path from paper down to subtopic, support dynamic depths (4-6 layers).';

-- 2. Create mains_answers table
CREATE TABLE IF NOT EXISTS public.mains_answers (
  id TEXT PRIMARY KEY, -- e.g. '2025-gs1-q180-civilsdaily'
  question_id TEXT NOT NULL REFERENCES public.mains_questions(id) ON DELETE CASCADE,
  institute TEXT NOT NULL, -- e.g. 'Civilsdaily', 'Drishti IAS', 'PWOnlyIAS'
  answer_text TEXT NOT NULL, -- Verbatim markdown answer content
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.mains_answers IS 'Stores coaching institute model answers verbatim to preserve markdown formatting.';

-- Create index for faster joins
CREATE INDEX IF NOT EXISTS idx_mains_answers_question_id ON public.mains_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_mains_answers_institute ON public.mains_answers(institute);


-- ========================================================================
-- Sub-App 2: Mains User Revision Tracker
-- ========================================================================

-- 3. Create mains_user_revision table
CREATE TABLE IF NOT EXISTS public.mains_user_revision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.mains_questions(id) ON DELETE CASCADE,
  institute TEXT, -- Optional: tracks which specific institute answer they revised
  revised_at TIMESTAMPTZ DEFAULT NOW(),
  confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  CONSTRAINT unique_user_question_revision UNIQUE (user_id, question_id, institute)
);

COMMENT ON TABLE public.mains_user_revision IS 'Tracks user confidence and revision history for mains questions.';

CREATE INDEX IF NOT EXISTS idx_mains_revision_user ON public.mains_user_revision(user_id);
CREATE INDEX IF NOT EXISTS idx_mains_revision_question ON public.mains_user_revision(question_id);


-- ========================================================================
-- Sub-App 3: Value Addition Hub Submodules (Option B: Separate Tables)
-- ========================================================================

-- 4. Create mains_data_facts table (Data & Facts)
CREATE TABLE IF NOT EXISTS public.mains_data_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper TEXT,
  subject TEXT,
  section_group TEXT,
  microtopic TEXT,
  subtopic TEXT,
  parameter TEXT NOT NULL,
  card_title TEXT NOT NULL,
  content_markdown TEXT NOT NULL, -- Verbatim HTML/Markdown text
  source TEXT,
  hierarchy_path TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.mains_data_facts IS 'Stores parameters, metrics and facts from the data & facts folder.';
CREATE INDEX IF NOT EXISTS idx_mains_data_facts_path ON public.mains_data_facts USING GIN(hierarchy_path);

-- 5. Create mains_intro_conclusions table (Introductions & Conclusions)
CREATE TABLE IF NOT EXISTS public.mains_intro_conclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper TEXT,
  subject TEXT,
  section_group TEXT,
  microtopic TEXT,
  subtopic TEXT,
  card_title TEXT NOT NULL,
  body TEXT NOT NULL,
  hierarchy_path TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.mains_intro_conclusions IS 'Stores readymade introduction and conclusion templates.';
CREATE INDEX IF NOT EXISTS idx_mains_intro_conclusions_path ON public.mains_intro_conclusions USING GIN(hierarchy_path);

-- 6. Create mains_essay_value_add table (Essay Anecdotes & Quotes)
CREATE TABLE IF NOT EXISTS public.mains_essay_value_add (
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

-- 7. Create mains_ethics_value_add table (Ethics Hub)
CREATE TABLE IF NOT EXISTS public.mains_ethics_value_add (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ethics_type TEXT NOT NULL CHECK (ethics_type IN ('diagram', 'dimension', 'comparison', 'innovation', 'pyq_quote', 'keyword', 'situation')),
  paper TEXT DEFAULT 'GS-IV',
  subject TEXT DEFAULT 'ETHICS, INTEGRITY & APTITUDE',
  section_group TEXT,
  microtopic TEXT,
  subtopic TEXT,
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL, -- Verbatim comparison tables, definitions, or description text
  diagram_image_path TEXT,
  officer_name TEXT,
  initiative TEXT,
  impact TEXT,
  core_values TEXT,
  pyqs TEXT[], -- List of associated PYQ years/marks, e.g. {'[2023]', '[2020]'}
  hierarchy_path TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.mains_ethics_value_add IS 'Stores terms, diagrams, innovations, and quotes specific to the GS4 Ethics hub.';
CREATE INDEX IF NOT EXISTS idx_mains_ethics_path ON public.mains_ethics_value_add USING GIN(hierarchy_path);

-- 8. Create mains_mnemonics table (Memory Mnemonics)
CREATE TABLE IF NOT EXISTS public.mains_mnemonics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper TEXT,
  subject TEXT,
  section_group TEXT,
  microtopic TEXT,
  subtopic TEXT,
  mnemonic_number_title TEXT NOT NULL, -- e.g. 'Mnemonic 28: Features of Bhakti...'
  mnemonic_keyword TEXT NOT NULL, -- e.g. 'BHAKTI ROLE'
  formula_expansion JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {letter, meaning, detail}
  explanation_examples TEXT NOT NULL,
  hierarchy_path TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.mains_mnemonics IS 'Stores memory mnemonics, keywords, and expansions.';
CREATE INDEX IF NOT EXISTS idx_mains_mnemonics_path ON public.mains_mnemonics USING GIN(hierarchy_path);

-- 9. Create mains_frameworks table (Answer Writing Frameworks)
CREATE TABLE IF NOT EXISTS public.mains_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_name TEXT NOT NULL,
  diagram_image_path TEXT,
  breakdown_markdown TEXT NOT NULL, -- Verbatim breakdown text
  hierarchies JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of hierarchy paths mapping to multiple subjects
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.mains_frameworks IS 'Stores global answer writing frameworks and multi-syllabus mappings.';
