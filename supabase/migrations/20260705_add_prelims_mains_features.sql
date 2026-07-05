-- ==========================================================================
-- SQL MIGRATION: Add Prelims & Mains Features to Pro & Premium Plans
-- Run this in your Supabase SQL Editor to grant access.
-- ==========================================================================

-- 1. Insert the new features into the access_features table
INSERT INTO access_features (key, name, description, category, sort_order)
VALUES
  ('prelims', 'Prelims Hub', 'Access to Prelims Hub and question solving', 'feature', 16),
  ('mains', 'Mains Hub', 'Access to Mains Hub subjective answers and questions', 'feature', 17)
ON CONFLICT (key) DO NOTHING;

-- 2. Link these features to Pro Monthly, Pro Yearly, and Premium plans
DO $$
DECLARE
  prelims_feat_id uuid;
  mains_feat_id uuid;
  plan_rec record;
BEGIN
  -- Get feature IDs
  SELECT id INTO prelims_feat_id FROM access_features WHERE key = 'prelims';
  SELECT id INTO mains_feat_id FROM access_features WHERE key = 'mains';

  -- Loop through Pro Monthly, Pro Yearly, and Premium plans
  FOR plan_rec IN 
    SELECT id, name FROM access_plans 
    WHERE name IN ('Pro Monthly', 'Pro Yearly', 'Premium')
  LOOP
    -- Insert or update prelims mapping
    INSERT INTO plan_features (plan_id, feature_id, is_granted)
    VALUES (plan_rec.id, prelims_feat_id, true)
    ON CONFLICT (plan_id, feature_id) DO UPDATE 
    SET is_granted = true;

    -- Insert or update mains mapping
    INSERT INTO plan_features (plan_id, feature_id, is_granted)
    VALUES (plan_rec.id, mains_feat_id, true)
    ON CONFLICT (plan_id, feature_id) DO UPDATE 
    SET is_granted = true;
    
    RAISE NOTICE 'Mapped prelims and mains to plan: %', plan_rec.name;
  END LOOP;
END $$;
