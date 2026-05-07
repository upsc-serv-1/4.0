-- ============================================================================
-- Soft Notes (Notability clone) — Supabase migration
-- Apply once via Supabase dashboard → SQL Editor → New query → paste → Run.
-- Idempotent: safe to re-run.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ---------- notebooks ------------------------------------------------------
create table if not exists public.soft_notebooks (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null default 'Untitled notebook',
  cover_color   text not null default '#fde68a',
  paper_style   text not null default 'plain',
  archived      boolean not null default false,
  pinned        boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists soft_notebooks_user_idx     on public.soft_notebooks(user_id);
create index if not exists soft_notebooks_archived_idx on public.soft_notebooks(user_id, archived);

-- ---------- pages ----------------------------------------------------------
create table if not exists public.soft_pages (
  id            uuid primary key default uuid_generate_v4(),
  notebook_id   uuid not null references public.soft_notebooks(id) on delete cascade,
  order_index   int  not null default 0,
  width         int  not null default 800,
  height        int  not null default 1131,
  paper_style   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists soft_pages_notebook_idx on public.soft_pages(notebook_id, order_index);

-- ---------- strokes (vector ink) ------------------------------------------
create table if not exists public.soft_strokes (
  id            uuid primary key default uuid_generate_v4(),
  page_id       uuid not null references public.soft_pages(id) on delete cascade,
  tool          text not null,                -- pen | highlighter | eraser | tape | shape
  color         text not null,
  width         real not null,
  opacity       real not null default 1,
  raw_points    jsonb not null,               -- SoftStrokePoint[]
  bezier_points jsonb,                        -- BezierPoint[] (cached)
  bounding_box  jsonb,
  z_index       int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists soft_strokes_page_idx on public.soft_strokes(page_id, z_index);

-- ---------- text boxes -----------------------------------------------------
create table if not exists public.soft_text_boxes (
  id            uuid primary key default uuid_generate_v4(),
  page_id       uuid not null references public.soft_pages(id) on delete cascade,
  x             real not null,
  y             real not null,
  width         real not null default 200,
  height        real not null default 60,
  content       text not null default '',
  font_size     int  not null default 16,
  font_family   text,
  color         text not null default '#0f172a',
  z_index       int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists soft_text_boxes_page_idx on public.soft_text_boxes(page_id);

-- ---------- RLS ------------------------------------------------------------
alter table public.soft_notebooks   enable row level security;
alter table public.soft_pages       enable row level security;
alter table public.soft_strokes     enable row level security;
alter table public.soft_text_boxes  enable row level security;

-- Owner-only policies. A page/stroke/text-box belongs to whoever owns the notebook.
drop policy if exists soft_nb_owner on public.soft_notebooks;
create policy soft_nb_owner on public.soft_notebooks
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists soft_pg_owner on public.soft_pages;
create policy soft_pg_owner on public.soft_pages
  using (exists (select 1 from public.soft_notebooks n
                 where n.id = soft_pages.notebook_id and n.user_id = auth.uid()))
  with check (exists (select 1 from public.soft_notebooks n
                      where n.id = soft_pages.notebook_id and n.user_id = auth.uid()));

drop policy if exists soft_st_owner on public.soft_strokes;
create policy soft_st_owner on public.soft_strokes
  using (exists (select 1 from public.soft_pages p
                 join public.soft_notebooks n on n.id = p.notebook_id
                 where p.id = soft_strokes.page_id and n.user_id = auth.uid()))
  with check (exists (select 1 from public.soft_pages p
                      join public.soft_notebooks n on n.id = p.notebook_id
                      where p.id = soft_strokes.page_id and n.user_id = auth.uid()));

drop policy if exists soft_tb_owner on public.soft_text_boxes;
create policy soft_tb_owner on public.soft_text_boxes
  using (exists (select 1 from public.soft_pages p
                 join public.soft_notebooks n on n.id = p.notebook_id
                 where p.id = soft_text_boxes.page_id and n.user_id = auth.uid()))
  with check (exists (select 1 from public.soft_pages p
                      join public.soft_notebooks n on n.id = p.notebook_id
                      where p.id = soft_text_boxes.page_id and n.user_id = auth.uid()));

-- ---------- updated_at trigger --------------------------------------------
create or replace function public.set_soft_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists soft_nb_set_updated_at on public.soft_notebooks;
create trigger soft_nb_set_updated_at  before update on public.soft_notebooks
  for each row execute function public.set_soft_updated_at();

drop trigger if exists soft_pg_set_updated_at on public.soft_pages;
create trigger soft_pg_set_updated_at  before update on public.soft_pages
  for each row execute function public.set_soft_updated_at();

drop trigger if exists soft_tb_set_updated_at on public.soft_text_boxes;
create trigger soft_tb_set_updated_at  before update on public.soft_text_boxes
  for each row execute function public.set_soft_updated_at();
