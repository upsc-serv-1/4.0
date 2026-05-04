import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://example.com';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'key';

console.log("URL", process.env.EXPO_PUBLIC_SUPABASE_URL);

// Cannot fetch without keys, let's just check the local SQLite schema if it exists!
