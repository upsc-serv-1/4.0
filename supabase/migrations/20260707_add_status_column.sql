-- Migration: Add status column to mains tables to support Draft/Staging vs Live content workflow

-- 1. mains_data_facts
ALTER TABLE public.mains_data_facts 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published'));

-- 2. mains_intro_conclusions
ALTER TABLE public.mains_intro_conclusions 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published'));

-- 3. mains_essay_value_add
ALTER TABLE public.mains_essay_value_add 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published'));

-- 4. mains_ethics_value_add
ALTER TABLE public.mains_ethics_value_add 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published'));

-- 5. mains_mnemonics
ALTER TABLE public.mains_mnemonics 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published'));

-- 6. mains_frameworks
ALTER TABLE public.mains_frameworks 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published'));

-- 7. mains_questions
ALTER TABLE public.mains_questions 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published'));

-- Automatically mark existing records as 'published' so they don't disappear from the app
UPDATE public.mains_data_facts SET status = 'published';
UPDATE public.mains_intro_conclusions SET status = 'published';
UPDATE public.mains_essay_value_add SET status = 'published';
UPDATE public.mains_ethics_value_add SET status = 'published';
UPDATE public.mains_mnemonics SET status = 'published';
UPDATE public.mains_frameworks SET status = 'published';
UPDATE public.mains_questions SET status = 'published';
