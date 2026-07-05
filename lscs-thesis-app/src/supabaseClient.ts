import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any;

export async function fetchCases() {
  if (!supabase) {
    console.warn("Supabase is not configured.");
    return [];
  }
  const { data, error } = await supabase
    .from('lscs_thesis_cases')
    .select('*')
    .range(0, 9999) // Bypasses Supabase default 1000 row page limit, supporting up to 10,000 records
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }
  return data || [];
}

export async function saveCaseToSupabase(caseData: Record<string, any>) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  // Map fields & replace empty inputs with null
  const cleanedData = { ...caseData };
  Object.keys(cleanedData).forEach((key) => {
    if (cleanedData[key] === '') {
      cleanedData[key] = null; // Save blank inputs as NULL in SQL
    }
  });

  const { id, ...dataToSave } = cleanedData;

  if (id) {
    // Update existing case
    const { data, error } = await supabase
      .from('lscs_thesis_cases')
      .update(dataToSave)
      .eq('id', id)
      .select();
    if (error) throw error;
    return data?.[0] || null;
  } else {
    // Insert new case
    const { data, error } = await supabase
      .from('lscs_thesis_cases')
      .insert([dataToSave])
      .select();
    if (error) throw error;
    return data?.[0] || null;
  }
}

export async function deleteCaseFromSupabase(id: string) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  const { error } = await supabase
    .from('lscs_thesis_cases')
    .delete()
    .eq('id', id);

  if (error) {
    throw error;
  }
}

export async function fetchCaseById(id: string) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  const { data, error } = await supabase
    .from('lscs_thesis_cases')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw error;
  }
  return data;
}

export async function fetchMasterPrompt(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('lscs_thesis_settings')
      .select('value')
      .eq('id', 'master_prompt')
      .single();

    if (error) {
      console.warn("Could not fetch master prompt from Supabase settings table. Falling back to static prompt.");
      return null;
    }
    return data?.value || null;
  } catch (err) {
    console.warn("Settings table query failed. Fallback active:", err);
    return null;
  }
}

export async function saveMasterPrompt(newPrompt: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('lscs_thesis_settings')
      .upsert({ id: 'master_prompt', value: newPrompt, updated_at: new Date().toISOString() });
    
    if (error) {
      console.error("Error saving master prompt to Supabase settings table:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Save master prompt query failed:", err);
    return false;
  }
}
