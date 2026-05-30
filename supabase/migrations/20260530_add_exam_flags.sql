-- Migration: Add exam flag columns to questions table
-- Date: 2026-05-30
-- Description: Add is_upsc_cms, is_neetpg, and is_inicet boolean columns to track different exam types

-- Add the three new columns to questions table
alter table public.questions add column if not exists is_upsc_cms boolean default false;
alter table public.questions add column if not exists is_neetpg boolean default false;
alter table public.questions add column if not exists is_inicet boolean default false;

-- Create indexes for performance (optional, but recommended for filtering)
create index if not exists idx_questions_is_upsc_cms on public.questions(is_upsc_cms);
create index if not exists idx_questions_is_neetpg on public.questions(is_neetpg);
create index if not exists idx_questions_is_inicet on public.questions(is_inicet);

-- Comment for documentation
comment on column public.questions.is_upsc_cms is 'Flag indicating if question is from UPSC CMS (NEET-based) exam';
comment on column public.questions.is_neetpg is 'Flag indicating if question is from NEET-PG exam';
comment on column public.questions.is_inicet is 'Flag indicating if question is from INI-CET exam';
