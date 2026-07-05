import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function fetchCases() {
  const { data, error } = await supabase
    .from('lscs_thesis_cases')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }
  return data || [];
}

export async function saveCaseToSupabase(caseData: Record<string, any>) {
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
  const { error } = await supabase
    .from('lscs_thesis_cases')
    .delete()
    .eq('id', id);

  if (error) {
    throw error;
  }
}

export async function fetchCaseById(id: string) {
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
