-- Migration: alter question_number from INTEGER to TEXT
-- Reason: UPSC question numbers use alphanumeric format (e.g. "7c", "5e", "1a")
ALTER TABLE public.mains_questions
  ALTER COLUMN question_number TYPE TEXT USING question_number::TEXT;
