-- ========================================================================
-- SOFTNOTES_MIGRATION.sql — Schema for Notability-clone (Soft Notes) subsystem
-- ========================================================================

-- 1. Create soft_notebooks table
CREATE TABLE IF NOT EXISTS public.soft_notebooks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  cover_color text NOT NULL DEFAULT '#fde68a',
  paper_style text NOT NULL DEFAULT 'plain',
  archived    boolean NOT NULL DEFAULT false,
  pinned      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Create soft_pages table
CREATE TABLE IF NOT EXISTS public.soft_pages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid REFERENCES public.soft_notebooks(id) ON DELETE CASCADE NOT NULL,
  order_index integer NOT NULL,
  width       integer NOT NULL DEFAULT 800,
  height      integer NOT NULL DEFAULT 1131,
  paper_style text NOT NULL DEFAULT 'plain',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. Create soft_strokes table
CREATE TABLE IF NOT EXISTS public.soft_strokes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id       uuid REFERENCES public.soft_pages(id) ON DELETE CASCADE NOT NULL,
  tool          text NOT NULL,
  color         text NOT NULL,
  width         numeric NOT NULL,
  opacity       numeric NOT NULL,
  raw_points    jsonb NOT NULL,
  bezier_points jsonb,
  bounding_box  jsonb,
  z_index       integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 4. Create soft_text_boxes table
CREATE TABLE IF NOT EXISTS public.soft_text_boxes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     uuid REFERENCES public.soft_pages(id) ON DELETE CASCADE NOT NULL,
  x           numeric NOT NULL,
  y           numeric NOT NULL,
  width       numeric NOT NULL,
  height      numeric NOT NULL,
  content     text NOT NULL,
  font_size   numeric NOT NULL,
  font_family text,
  color       text NOT NULL,
  z_index     integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.soft_notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soft_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soft_strokes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soft_text_boxes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can manage their own notebooks" ON public.soft_notebooks;
DROP POLICY IF EXISTS "Users can manage pages of their own notebooks" ON public.soft_pages;
DROP POLICY IF EXISTS "Users can manage strokes of their own notebooks" ON public.soft_strokes;
DROP POLICY IF EXISTS "Users can manage text boxes of their own notebooks" ON public.soft_text_boxes;

-- Create unified ALL policies for complete CRUD access
CREATE POLICY "Users can manage their own notebooks" ON public.soft_notebooks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage pages of their own notebooks" ON public.soft_pages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.soft_notebooks
      WHERE public.soft_notebooks.id = public.soft_pages.notebook_id
        AND public.soft_notebooks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.soft_notebooks
      WHERE public.soft_notebooks.id = public.soft_pages.notebook_id
        AND public.soft_notebooks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage strokes of their own notebooks" ON public.soft_strokes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.soft_pages
      JOIN public.soft_notebooks ON public.soft_notebooks.id = public.soft_pages.notebook_id
      WHERE public.soft_pages.id = public.soft_strokes.page_id
        AND public.soft_notebooks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.soft_pages
      JOIN public.soft_notebooks ON public.soft_notebooks.id = public.soft_pages.notebook_id
      WHERE public.soft_pages.id = public.soft_strokes.page_id
        AND public.soft_notebooks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage text boxes of their own notebooks" ON public.soft_text_boxes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.soft_pages
      JOIN public.soft_notebooks ON public.soft_notebooks.id = public.soft_pages.notebook_id
      WHERE public.soft_pages.id = public.soft_text_boxes.page_id
        AND public.soft_notebooks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.soft_pages
      JOIN public.soft_notebooks ON public.soft_notebooks.id = public.soft_pages.notebook_id
      WHERE public.soft_pages.id = public.soft_text_boxes.page_id
        AND public.soft_notebooks.user_id = auth.uid()
    )
  );

-- Create performance indexes for lookup operations
CREATE INDEX IF NOT EXISTS idx_soft_notebooks_user ON public.soft_notebooks(user_id);
CREATE INDEX IF NOT EXISTS idx_soft_pages_notebook ON public.soft_pages(notebook_id);
CREATE INDEX IF NOT EXISTS idx_soft_strokes_page ON public.soft_strokes(page_id);
CREATE INDEX IF NOT EXISTS idx_soft_text_boxes_page ON public.soft_text_boxes(page_id);
