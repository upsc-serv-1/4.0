-- =========================================================
-- Tag rename + management RPCs (Phase 3.B)
-- Author: Emergent AI (mobile app team)
-- Date  : 2026-01-03
-- Run in Supabase SQL editor. Idempotent.
-- =========================================================

-- Rename a tag atomically across:
--   1. question_states.review_tags (jsonb array of strings) for that user
--   2. user_settings.custom_tags    (jsonb array of strings) for that user
-- This replaces the multi-round-trip name-based update the mobile app
-- used to do and guarantees the user never sees half-renamed rows.
CREATE OR REPLACE FUNCTION rename_user_tag(
  p_old_tag text,
  p_new_tag text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_old_norm  text := lower(trim(p_old_tag));
  v_new_label text := trim(p_new_tag);
  v_rows_updated int := 0;
  v_settings_updated int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_old_norm = '' OR v_new_label = '' THEN
    RAISE EXCEPTION 'Tag name cannot be empty';
  END IF;

  -- 1. Update question_states.review_tags
  WITH updated AS (
    UPDATE question_states
       SET review_tags = (
             SELECT coalesce(
               jsonb_agg(
                 CASE
                   WHEN lower(trim(elem::text, '"')) = v_old_norm THEN to_jsonb(v_new_label)
                   ELSE elem
                 END
               ),
               '[]'::jsonb
             )
             FROM jsonb_array_elements(review_tags) elem
           )
     WHERE user_id = v_user_id
       AND review_tags @? '$[*] ? (@.type() == "string")'
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(review_tags) t
         WHERE lower(trim(t)) = v_old_norm
       )
     RETURNING id
  )
  SELECT count(*) INTO v_rows_updated FROM updated;

  -- 2. Update user_settings.custom_tags
  WITH updated AS (
    UPDATE user_settings
       SET custom_tags = (
             SELECT coalesce(
               jsonb_agg(
                 CASE
                   WHEN lower(trim(elem::text, '"')) = v_old_norm THEN to_jsonb(v_new_label)
                   ELSE elem
                 END
               ),
               '[]'::jsonb
             )
             FROM jsonb_array_elements(custom_tags) elem
           )
     WHERE user_id = v_user_id
       AND custom_tags IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(custom_tags) t
         WHERE lower(trim(t)) = v_old_norm
       )
     RETURNING user_id
  )
  SELECT count(*) INTO v_settings_updated FROM updated;

  RETURN jsonb_build_object(
    'success', true,
    'question_rows_updated', v_rows_updated,
    'settings_updated', v_settings_updated,
    'old_tag', p_old_tag,
    'new_tag', v_new_label
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rename_user_tag(text, text) TO authenticated;


-- Remove a tag completely from a user's data.
CREATE OR REPLACE FUNCTION remove_user_tag(p_tag text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_norm    text := lower(trim(p_tag));
  v_rows_updated int := 0;
  v_settings_updated int := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_norm = '' THEN RAISE EXCEPTION 'Tag name cannot be empty'; END IF;

  WITH updated AS (
    UPDATE question_states
       SET review_tags = (
             SELECT coalesce(jsonb_agg(elem), '[]'::jsonb)
             FROM jsonb_array_elements(review_tags) elem
             WHERE lower(trim(elem::text, '"')) <> v_norm
           )
     WHERE user_id = v_user_id
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(review_tags) t
         WHERE lower(trim(t)) = v_norm
       )
     RETURNING id
  )
  SELECT count(*) INTO v_rows_updated FROM updated;

  WITH updated AS (
    UPDATE user_settings
       SET custom_tags = (
             SELECT coalesce(jsonb_agg(elem), '[]'::jsonb)
             FROM jsonb_array_elements(custom_tags) elem
             WHERE lower(trim(elem::text, '"')) <> v_norm
           )
     WHERE user_id = v_user_id
       AND custom_tags IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(custom_tags) t
         WHERE lower(trim(t)) = v_norm
       )
     RETURNING user_id
  )
  SELECT count(*) INTO v_settings_updated FROM updated;

  RETURN jsonb_build_object(
    'success', true,
    'question_rows_updated', v_rows_updated,
    'settings_updated', v_settings_updated,
    'tag', p_tag
  );
END;
$$;

GRANT EXECUTE ON FUNCTION remove_user_tag(text) TO authenticated;


-- Add a new tag to the user's custom tag catalog (no-op if already present).
CREATE OR REPLACE FUNCTION add_user_tag(p_tag text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_label   text := trim(p_tag);
  v_norm    text := lower(v_label);
  v_already bool := false;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_label = '' THEN RAISE EXCEPTION 'Tag name cannot be empty'; END IF;

  -- Ensure a user_settings row exists
  INSERT INTO user_settings (user_id, custom_tags)
  VALUES (v_user_id, '[]'::jsonb)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT EXISTS (
    SELECT 1 FROM user_settings us,
                  jsonb_array_elements_text(coalesce(us.custom_tags, '[]'::jsonb)) t
     WHERE us.user_id = v_user_id AND lower(trim(t)) = v_norm
  ) INTO v_already;

  IF NOT v_already THEN
    UPDATE user_settings
       SET custom_tags = coalesce(custom_tags, '[]'::jsonb) || to_jsonb(v_label)
     WHERE user_id = v_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'added', NOT v_already, 'tag', v_label);
END;
$$;

GRANT EXECUTE ON FUNCTION add_user_tag(text) TO authenticated;
