import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rnelxupyiejsqekmcrcz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPublished() {
  console.log('Checking recent pre-2012 questions...');
  
  // We check paper 1 pre 2012
  const { data, error } = await supabase
    .from('mains_questions')
    .select('*')
    .lt('exam_year', 2012)
    .limit(10);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (data.length > 0) {
    console.log('Sample question keys:', Object.keys(data[0]));
    console.log('Sample question publish status:', data.map(q => ({
      id: q.id,
      year: q.exam_year,
      is_published: q.is_published,
      published: q.published,
      status: q.status
    })));
  } else {
    console.log('No pre-2012 questions found or exam_year is missing.');
  }
}

checkPublished().catch(console.error);
