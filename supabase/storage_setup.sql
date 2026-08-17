-- ========================================================================
-- Supabase Storage Setup for Flashcard Images
-- Run this in your new Supabase Project SQL Editor
-- ========================================================================

-- 1. Create the 'flashcard-images' bucket if it doesn't exist and set to public
INSERT INTO storage.buckets (id, name, public)
VALUES ('flashcard-images', 'flashcard-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow public access to view/download flashcard images
DROP POLICY IF EXISTS "Public Read Flashcard Images" ON storage.objects;
CREATE POLICY "Public Read Flashcard Images"
ON storage.objects FOR SELECT
USING (bucket_id = 'flashcard-images');

-- 3. Allow users to upload flashcard images
DROP POLICY IF EXISTS "Allow Upload Flashcard Images" ON storage.objects;
CREATE POLICY "Allow Upload Flashcard Images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'flashcard-images');

-- 4. Allow users to update flashcard images
DROP POLICY IF EXISTS "Allow Update Flashcard Images" ON storage.objects;
CREATE POLICY "Allow Update Flashcard Images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'flashcard-images');
