-- ========================================================================
-- SQL Script: Recreate Mains Questions & Answers with Logical Column Order
-- ========================================================================

-- 1. Drop existing tables (they are currently empty, so no data will be lost)
DROP TABLE IF EXISTS public.mains_answers CASCADE;
DROP TABLE IF EXISTS public.mains_questions CASCADE;

-- 2. Recreate mains_questions table in perfect alignment with reference schema
CREATE TABLE public.mains_questions (
  id TEXT PRIMARY KEY,
  question_number INTEGER,
  question_text TEXT NOT NULL,
  marks INTEGER,
  exam_year INTEGER,
  
  -- Syllabus Hierarchy Layers (Ordered logically)
  paper TEXT,
  subject TEXT,
  section_group TEXT,
  microtopic TEXT,
  subtopic TEXT,
  nanotopic TEXT,
  hierarchy_path TEXT[],

  -- Tagging, Search, & Exam Metadata (Matches reference schema exactly)
  macrotag TEXT,
  microtag TEXT,
  is_pyq BOOLEAN DEFAULT FALSE,
  source_attribution_label TEXT,
  exam_info JSONB,
  stage TEXT,
  exam TEXT,
  exam_group TEXT,
  is_upsc_cse BOOLEAN DEFAULT FALSE,
  is_allied BOOLEAN DEFAULT FALSE,
  is_others BOOLEAN DEFAULT FALSE,
  exam_category TEXT,
  
  -- Program & Coaching Metadata
  course TEXT,
  institute TEXT,
  program_id TEXT,
  program_name TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Recreate mains_answers table in perfect alignment with reference schema
CREATE TABLE public.mains_answers (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES public.mains_questions(id) ON DELETE CASCADE,
  institute TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Recreate indexes for performance
CREATE INDEX idx_mains_answers_question_id ON public.mains_answers(question_id);
CREATE INDEX idx_mains_answers_institute ON public.mains_answers(institute);
CREATE INDEX idx_mains_questions_subject ON public.mains_questions(subject);
CREATE INDEX idx_mains_questions_paper ON public.mains_questions(paper);

-- Comments for documentation
COMMENT ON TABLE public.mains_questions IS 'Stores subjective Mains and Optional questions and their syllabus hierarchy.';
COMMENT ON COLUMN public.mains_questions.hierarchy_path IS 'Syllabus path from paper down to subtopic/nanotopic.';
COMMENT ON COLUMN public.mains_questions.nanotopic IS 'Syllabus layer 5 (nanotopic) below subtopic, specifically used for optional subjects like Anthropology.';
