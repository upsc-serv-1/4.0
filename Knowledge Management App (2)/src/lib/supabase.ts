import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = 'sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
