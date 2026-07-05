/**
 * AccessControlContext — Resolves effective user permissions from Supabase.
 *
 * Architecture:
 *   1. Fetch user's active subscription(s) → get plan → get plan_features
 *   2. Fetch user_feature_overrides for the user
 *   3. Merge: overrides take priority over plan features
 *   4. Cache the resolved permissions map in memory + KVStore for offline
 *
 * Usage:
 *   const { hasAccess } = useAccessControl();
 *   if (hasAccess('pyq')) { ... }
 *   if (hasInstituteAccess('VisionIAS')) { ... }
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';
import { KVStore } from '../lib/kvStore';
import { useAuth } from './AuthContext';

// ── Types ──

export type FeatureKey =
  | 'pyq'
  | 'flashcards'
  | 'analytics'
  | 'notes'
  | 'soft_notes'
  | 'hard_notes'
  | 'ai_search'
  | 'ai_settings'
  | 'capsules'
  | 'tracker'
  | 'quiz_arena'
  | 'export_pdf'
  | 'revision'
  | 'tags'
  | 'pilot_v2'
  | 'mains'
  | 'prelims';

interface AccessControlCtx {
  /** Check if the current user has access to a specific feature */
  hasAccess: (featureKey: FeatureKey | string) => boolean;
  /** Check if the user has access to a specific institute's tests */
  hasInstituteAccess: (institute: string) => boolean;
  /** Check if the user has access to a specific course */
  hasCourseAccess: (course: string) => boolean;
  /** Raw resolved feature map (key → granted) */
  featureMap: Record<string, boolean>;
  /** List of granted institute names */
  grantedInstitutes: string[];
  /** List of granted course names */
  grantedCourses: string[];
  /** True while initial permissions are being resolved */
  loading: boolean;
  /** Manually refresh permissions from server */
  refresh: () => Promise<void>;
}

const CACHE_KEY = 'access_control_cache';

// ── Bypasses & Subscription Configurations ──
// Set to true to bypass subscription paywalls for ALL users (perfect for local debugging/testing)
const BYPASS_ALL_SUBSCRIPTIONS = false;

// Add any email addresses here that should always have full subscription access
const BYPASS_EMAILS = [
  'dn.d.n.g.zm.s.n.f.smb.t@gmail.com',
  'upsc-serv-1@proton.me',
  'your@email.com',
  'aiimsmbbs17@gmail.com',
];

const Ctx = createContext<AccessControlCtx>({} as AccessControlCtx);

// ── Provider ──

export function AccessControlProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  const isBypassUser = useMemo(() => {
    if (BYPASS_ALL_SUBSCRIPTIONS) return true;
    if (!userEmail) return false;
    return BYPASS_EMAILS.map(e => e.toLowerCase()).includes(userEmail.toLowerCase());
  }, [userEmail]);

  const [featureMap, setFeatureMap] = useState<Record<string, boolean>>({});
  const [grantedInstitutes, setGrantedInstitutes] = useState<string[]>([]);
  const [grantedCourses, setGrantedCourses] = useState<string[]>([]);
  const [globalBypass, setGlobalBypass] = useState(false);
  const [loading, setLoading] = useState(true);

  // Hydrate from cache on mount
  useEffect(() => {
    try {
      const cached = KVStore.getJson<{
        featureMap: Record<string, boolean>;
        institutes: string[];
        courses: string[];
        ts: number;
      }>(CACHE_KEY);
      if (cached) {
        setFeatureMap(cached.featureMap || {});
        setGrantedInstitutes(cached.institutes || []);
        setGrantedCourses(cached.courses || []);
        // If cache is less than 1 hour old, skip loading
        if (cached.ts && Date.now() - cached.ts < 3600_000) {
          setLoading(false);
          return;
        }
      }
    } catch { /* ignore */ }
  }, []);

  const resolvePermissions = useCallback(async () => {
    if (!userId) {
      setFeatureMap({});
      setGrantedInstitutes([]);
      setGrantedCourses([]);
      setLoading(false);
      return;
    }

    try {
      // 0. Check Global config bypass setting
      let isGlobalBypassActive = false;
      try {
        const { data: globalConfig } = await supabase
          .from('user_settings')
          .select('permissions')
          .eq('user_id', '00000000-0000-0000-0000-000000000000')
          .maybeSingle();
        if (globalConfig?.permissions) {
          const conf = globalConfig.permissions as any;
          if (conf.paywallBypass === true) {
            isGlobalBypassActive = true;
          }
        }
      } catch (e) {
        console.error('Error fetching global config bypass:', e);
      }
      setGlobalBypass(isGlobalBypassActive);

      // 1. Get the user's active subscriptions
      const { data: subs } = await supabase
        .from('user_subscriptions')
        .select('plan_id, is_active, expires_at, course_name')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      const effectiveFeatures: Record<string, boolean> = {};
      let institutes: string[] = [];
      let courses: string[] = [];

      if (subs && (!subs.expires_at || new Date(subs.expires_at) > new Date())) {
        // 2. Get plan features
        const { data: planFeats } = await supabase
          .from('plan_features')
          .select('access_features!inner(key), is_granted, max_count')
          .eq('plan_id', subs.plan_id);

        (planFeats || []).forEach((pf: any) => {
          if (pf.access_features?.key) {
            effectiveFeatures[pf.access_features.key] = pf.is_granted;
          }
        });

        // 3. Get plan institutes
        const { data: planInsts } = await supabase
          .from('plan_institutes')
          .select('institute_name')
          .eq('plan_id', subs.plan_id);
        institutes = (planInsts || []).map((pi: any) => pi.institute_name);

        // 4. Get plan courses
        const { data: planCrs } = await supabase
          .from('plan_courses')
          .select('course_name')
          .eq('plan_id', subs.plan_id);
        courses = (planCrs || []).map((pc: any) => pc.course_name);

        // Add subscription-level course access (Issue 6)
        if (subs.course_name) {
          courses.push(subs.course_name);
        }
      }

      // 5. Apply overrides (overrides always win)
      const { data: overrides } = await supabase
        .from('user_feature_overrides')
        .select('feature_key, is_granted')
        .eq('user_id', userId);

      (overrides || []).forEach((ov: any) => {
        effectiveFeatures[ov.feature_key] = ov.is_granted;
      });

      // 6. User-specific course access overrides from user_settings permissions (Issue 5)
      try {
        const { data: settingsData } = await supabase
          .from('user_settings')
          .select('permissions')
          .eq('user_id', userId)
          .maybeSingle();

        if (settingsData?.permissions && typeof settingsData.permissions === 'object') {
          const perms = settingsData.permissions as any;
          if (Array.isArray(perms.allowedCourses)) {
            courses = Array.from(new Set([...courses, ...perms.allowedCourses]));
          }
        }
      } catch (err) {
        console.error('[AccessControl] Failed to load course overrides:', err);
      }

      setFeatureMap(effectiveFeatures);
      setGrantedInstitutes(institutes);
      setGrantedCourses(courses);

      // Cache for offline
      KVStore.setJson(CACHE_KEY, {
        featureMap: effectiveFeatures,
        institutes,
        courses,
        ts: Date.now(),
      });
    } catch (err) {
      console.error('[AccessControl] Failed to resolve permissions:', err);
      // Keep cached values if fetch fails
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Resolve on auth change
  useEffect(() => {
    if (userId) {
      resolvePermissions();
    } else {
      setFeatureMap({});
      setGrantedInstitutes([]);
      setGrantedCourses([]);
      setLoading(false);
    }
  }, [userId, resolvePermissions]);

  // Resolve when app state transitions back to active (foreground)
  useEffect(() => {
    if (!userId) return;
    
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        resolvePermissions();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [userId, resolvePermissions]);

  // Periodically refresh permissions in the background every 5 minutes to catch subscription changes
  useEffect(() => {
    if (!userId) return;
    
    const interval = setInterval(() => {
      resolvePermissions();
    }, 5 * 60_000); // 5 minutes

    return () => {
      clearInterval(interval);
    };
  }, [userId, resolvePermissions]);

  const hasAccess = useCallback(
    (featureKey: string) => {
      if (isBypassUser || globalBypass) return true;
      return featureMap[featureKey] === true;
    },
    [featureMap, isBypassUser, globalBypass]
  );

  const hasInstituteAccess = useCallback(
    (institute: string) => {
      if (isBypassUser || globalBypass) return true;
      return grantedInstitutes.length === 0 || grantedInstitutes.includes(institute);
    },
    [grantedInstitutes, isBypassUser, globalBypass]
  );

  const hasCourseAccess = useCallback(
    (course: string) => {
      if (isBypassUser || globalBypass) return true;
      return grantedCourses.length === 0 || grantedCourses.includes(course);
    },
    [grantedCourses, isBypassUser, globalBypass]
  );

  const value: AccessControlCtx = useMemo(
    () => ({
      hasAccess,
      hasInstituteAccess,
      hasCourseAccess,
      featureMap,
      grantedInstitutes,
      grantedCourses,
      loading,
      refresh: resolvePermissions,
    }),
    [hasAccess, hasInstituteAccess, hasCourseAccess, featureMap, grantedInstitutes, grantedCourses, loading, resolvePermissions]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccessControl(): AccessControlCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAccessControl must be used inside AccessControlProvider');
  return ctx;
}
