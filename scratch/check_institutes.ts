import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rnelxupyiejsqekmcrcz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInstitutes() {
  const { data, error } = await supabase
    .from('mains_answers')
    .select('institute')
    .limit(100);
    
  if (error) {
    console.error('Error fetching institutes:', error);
    return;
  }
  
  const institutes = new Set(data.map(d => d.institute));
  console.log('Institutes found in sample:', Array.from(institutes));
}

checkInstitutes();
