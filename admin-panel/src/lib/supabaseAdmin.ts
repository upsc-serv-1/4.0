// Service-role Supabase client for admin-only operations
// Fetches service_role key from env (must be set in VITE_SUPABASE_SERVICE_ROLE_KEY)
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL!;
const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// Client with service_role for bypassing RLS
export const supabaseAdmin = serviceKey
  ? createClient(url, serviceKey)
  : null;

// Helper: check if admin client is available
export function hasAdminClient(): boolean {
  return supabaseAdmin !== null;
}