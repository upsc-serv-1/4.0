-- ==========================================================================
-- Migration: Access Control & Subscription System
-- Date: 2026-06-01
-- Description: Creates the full access control system with plans,
-- features, plan-feature mappings, user subscriptions, and overrides.
-- ==========================================================================

-- ── 0. ENSURE public.users HAS A PRIMARY KEY ──
-- The existing users table may lack a PK, which blocks FK references.
ALTER TABLE users ADD PRIMARY KEY (id);

-- ── 1. ACCESS FEATURES (Feature Catalog) ──
CREATE TABLE IF NOT EXISTS access_features (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text DEFAULT '',
  category    text NOT NULL DEFAULT 'feature'
              CHECK (category IN ('feature', 'institute', 'course', 'test')),
  is_active   boolean DEFAULT true,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- ── 2. ACCESS PLANS (Subscription Plans/Tiers) ──
CREATE TABLE IF NOT EXISTS access_plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text DEFAULT '',
  price       numeric(10,2) DEFAULT 0,
  currency    text DEFAULT 'INR',
  interval    text DEFAULT 'month'
              CHECK (interval IN ('month', 'year', 'lifetime', 'one_time')),
  is_active   boolean DEFAULT true,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- ── 3. PLAN FEATURES (Feature-to-Plan Mapping) ──
CREATE TABLE IF NOT EXISTS plan_features (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid NOT NULL REFERENCES access_plans(id) ON DELETE CASCADE,
  feature_id  uuid NOT NULL REFERENCES access_features(id) ON DELETE CASCADE,
  is_granted  boolean DEFAULT true,
  max_count   integer,          -- NULL = unlimited
  UNIQUE(plan_id, feature_id)
);

-- ── 4. PLAN INSTITUTES (Institute Access per Plan) ──
CREATE TABLE IF NOT EXISTS plan_institutes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         uuid NOT NULL REFERENCES access_plans(id) ON DELETE CASCADE,
  institute_name  text NOT NULL,
  UNIQUE(plan_id, institute_name)
);

-- ── 5. PLAN COURSES (Course Access per Plan) ──
CREATE TABLE IF NOT EXISTS plan_courses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      uuid NOT NULL REFERENCES access_plans(id) ON DELETE CASCADE,
  course_name  text NOT NULL,
  UNIQUE(plan_id, course_name)
);

-- ── 6. USER SUBSCRIPTIONS (User-to-Plan Assignment) ──
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id         uuid NOT NULL REFERENCES access_plans(id),
  is_active       boolean DEFAULT true,
  starts_at       timestamptz DEFAULT now(),
  expires_at      timestamptz,
  auto_renew      boolean DEFAULT false,
  payment_ref     text DEFAULT '',
  notes           text DEFAULT '',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user
  ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active
  ON user_subscriptions(user_id, is_active);

-- ── 7. USER FEATURE OVERRIDES (Per-User Overrides) ──
CREATE TABLE IF NOT EXISTS user_feature_overrides (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_key  text NOT NULL REFERENCES access_features(key),
  is_granted   boolean NOT NULL,
  reason       text DEFAULT '',
  created_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, feature_key)
);

-- ==========================================================================
-- 8. AUDIT LOG
-- ==========================================================================

CREATE TABLE IF NOT EXISTS access_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        uuid,                      -- admin who made the change (NULL for system)
  action          text NOT NULL,              -- 'subscription_created', 'subscription_deactivated',
                                              -- 'subscription_expired', 'override_created',
                                              -- 'override_deleted', 'plan_created', 'plan_updated',
                                              -- 'feature_created', 'feature_updated'
  target_type     text NOT NULL,              -- 'user', 'subscription', 'plan', 'feature', 'override'
  target_id       text,                       -- UUID or identifier of the affected entity
  details         jsonb DEFAULT '{}'::jsonb,  -- Extra info (old/new values, reason, etc.)
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_audit_actor ON access_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_access_audit_action ON access_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_access_audit_created ON access_audit_log(created_at DESC);

ALTER TABLE access_audit_log ENABLE ROW LEVEL SECURITY;
-- Only super_admins can read audit logs (enforced application-side)

-- ==========================================================================
-- 9. SUBSCRIPTION EXPIRY FUNCTION
-- Auto-deactivates expired subscriptions (can be called by cron or on-demand)
-- ==========================================================================

CREATE OR REPLACE FUNCTION deactivate_expired_subscriptions()
RETURNS integer   -- Returns number of subscriptions deactivated
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deactivated_count integer;
BEGIN
  UPDATE user_subscriptions
  SET is_active = false,
      updated_at = now()
  WHERE is_active = true
    AND expires_at IS NOT NULL
    AND expires_at < now()
    AND is_active = true;  -- Only deactivate currently active ones

  GET DIAGNOSTICS deactivated_count = ROW_COUNT;

  -- Log the batch expiry
  IF deactivated_count > 0 THEN
    INSERT INTO access_audit_log (action, target_type, details)
    VALUES ('subscription_expired', 'subscription',
            jsonb_build_object('count', deactivated_count, 'batch_expiry', true));
  END IF;

  RETURN deactivated_count;
END;
$$;

-- ==========================================================================
-- ROW LEVEL SECURITY
-- ==========================================================================

ALTER TABLE access_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feature_overrides ENABLE ROW LEVEL SECURITY;

-- Public read for features/plans (the mobile app needs to check permissions)
CREATE POLICY "Public read access_features"
  ON access_features FOR SELECT USING (true);
CREATE POLICY "Public read access_plans"
  ON access_plans FOR SELECT USING (true);
CREATE POLICY "Public read plan_features"
  ON plan_features FOR SELECT USING (true);
CREATE POLICY "Public read plan_institutes"
  ON plan_institutes FOR SELECT USING (true);
CREATE POLICY "Public read plan_courses"
  ON plan_courses FOR SELECT USING (true);

-- Users can read their own subscriptions
CREATE POLICY "Users read own subscriptions"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can read their own overrides
CREATE POLICY "Users read own overrides"
  ON user_feature_overrides FOR SELECT
  USING (auth.uid() = user_id);

-- Admin panel needs full CRUD on all access control tables
DROP POLICY IF EXISTS "Admin users can be read" ON admin_users;
CREATE POLICY "Admin users can be read"
  ON admin_users FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admin panel write access for authenticated users (they're in admin_users)
DROP POLICY IF EXISTS "Auth can manage access_features" ON access_features;
CREATE POLICY "Auth can manage access_features"
  ON access_features FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth can manage access_plans" ON access_plans;
CREATE POLICY "Auth can manage access_plans"
  ON access_plans FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth can manage plan_features" ON plan_features;
CREATE POLICY "Auth can manage plan_features"
  ON plan_features FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth can manage plan_institutes" ON plan_institutes;
CREATE POLICY "Auth can manage plan_institutes"
  ON plan_institutes FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth can manage plan_courses" ON plan_courses;
CREATE POLICY "Auth can manage plan_courses"
  ON plan_courses FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth can manage user_subscriptions" ON user_subscriptions;
CREATE POLICY "Auth can manage user_subscriptions"
  ON user_subscriptions FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth can manage user_feature_overrides" ON user_feature_overrides;
CREATE POLICY "Auth can manage user_feature_overrides"
  ON user_feature_overrides FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth can read access_audit_log" ON access_audit_log;
CREATE POLICY "Auth can read access_audit_log"
  ON access_audit_log FOR SELECT USING (auth.role() = 'authenticated');

-- ==========================================================================
-- USER SUBSCRIPTIONS: add trigger to auto-set updated_at
-- ==========================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- HELPER FUNCTION: Get effective permissions for a user
-- ==========================================================================

CREATE OR REPLACE FUNCTION get_user_effective_features(p_user_id uuid)
RETURNS TABLE (
  feature_key    text,
  feature_name   text,
  is_granted     boolean,
  source         text       -- 'plan', 'override_grant', 'override_revoke'
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  -- Features from active subscriptions
  SELECT
    af.key,
    af.name,
    pf.is_granted,
    'plan'::text
  FROM user_subscriptions us
  JOIN access_plans ap ON us.plan_id = ap.id
  JOIN plan_features pf ON pf.plan_id = ap.id
  JOIN access_features af ON af.id = pf.feature_id
  WHERE us.user_id = p_user_id
    AND us.is_active = true
    AND (us.expires_at IS NULL OR us.expires_at > now())
    AND ap.is_active = true
    AND af.is_active = true

  UNION ALL

  -- Overrides (these take priority over plan features)
  SELECT
    af.key,
    af.name,
    ufo.is_granted,
    CASE WHEN ufo.is_granted THEN 'override_grant' ELSE 'override_revoke' END
  FROM user_feature_overrides ufo
  JOIN access_features af ON af.key = ufo.feature_key
  WHERE ufo.user_id = p_user_id;
END;
$$;

-- ==========================================================================
-- SEED DATA: Default Features
-- ==========================================================================

INSERT INTO access_features (key, name, description, category, sort_order) VALUES
  ('pyq', 'Previous Year Questions', 'Access to UPSC previous year question papers', 'feature', 1),
  ('flashcards', 'Flashcards', 'Spaced repetition flashcard system', 'feature', 2),
  ('analytics', 'Analytics & Performance', 'Performance tracking and analytics dashboards', 'feature', 3),
  ('notes', 'Text Notes', 'Rich text note-taking', 'feature', 4),
  ('soft_notes', 'Soft Notes (Canvas)', 'Canvas-based sketching and handwritten notes', 'feature', 5),
  ('hard_notes', 'Hard Notes', 'Hard notes feature', 'feature', 6),
  ('ai_search', 'AI Search', 'AI-powered semantic search across content', 'feature', 7),
  ('ai_settings', 'AI Settings', 'AI configuration and preferences', 'feature', 8),
  ('capsules', 'Study Capsules', 'Quick study capsule summaries', 'feature', 9),
  ('tracker', 'Study Tracker', 'Daily study progress tracking', 'feature', 10),
  ('quiz_arena', 'Quiz Arena', 'Take timed tests and practice quizzes', 'feature', 11),
  ('export_pdf', 'PDF Export', 'Export notes and content as PDF', 'feature', 12),
  ('revision', 'Revision System', 'Structured revision and review system', 'feature', 13),
  ('tags', 'Tags & Categories', 'Question tagging and categorization', 'feature', 14),
  ('pilot_v2', 'Pilot V2 Features', 'Experimental Pilot V2 features', 'feature', 15)
ON CONFLICT (key) DO NOTHING;

-- ==========================================================================
-- SEED DATA: Default Plans
-- ==========================================================================

INSERT INTO access_plans (name, description, price, currency, interval, sort_order) VALUES
  ('Free', 'Basic access to selected features', 0, 'INR', 'lifetime', 1),
  ('Pro Monthly', 'Full access to all features — monthly subscription', 499, 'INR', 'month', 2),
  ('Pro Yearly', 'Full access to all features — yearly subscription (save 40%%)', 3599, 'INR', 'year', 3),
  ('Premium', 'All features + AI & priority support — yearly', 5999, 'INR', 'year', 4)
ON CONFLICT DO NOTHING;

-- Assign features to Free plan (basic subset)
DO $$
DECLARE
  free_plan_id uuid;
  pyq_feature_id uuid;
  notes_feature_id uuid;
  tracker_feature_id uuid;
  tags_feature_id uuid;
BEGIN
  SELECT id INTO free_plan_id FROM access_plans WHERE name = 'Free' LIMIT 1;

  -- Free plan gets: PYQ (limited), Notes, Tracker, Tags
  INSERT INTO plan_features (plan_id, feature_id, is_granted, max_count)
  SELECT free_plan_id, id, true,
    CASE WHEN key = 'pyq' THEN 50 ELSE NULL END
  FROM access_features
  WHERE key IN ('pyq', 'notes', 'tracker', 'tags')
  ON CONFLICT (plan_id, feature_id) DO NOTHING;

  -- Assign ALL features to Pro Monthly, Pro Yearly, and Premium
  INSERT INTO plan_features (plan_id, feature_id, is_granted)
  SELECT ap.id, af.id, true
  FROM access_plans ap
  CROSS JOIN access_features af
  WHERE ap.name IN ('Pro Monthly', 'Pro Yearly', 'Premium')
  ON CONFLICT (plan_id, feature_id) DO NOTHING;
END $$;
