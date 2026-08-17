import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rnelxupyiejsqekmcrcz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function publishQuestions() {
  console.log('Publishing pre-2012 Anthropology questions...');
  
  // Update status for all Anthropology questions where exam_year < 2012
  const { data, error } = await supabase
    .from('mains_questions')
    .update({ status: 'published' })
    .ilike('subject', '%Anthropology%')
    .lt('exam_year', 2012);
    
  if (error) {
    console.error('Error updating status:', error);
    return;
  }
  
  console.log('Successfully published pre-2012 Anthropology questions.');
  
  // Also checking just in case some of them didn't have subject strictly as Anthropology 
  // but ID starts with mains-anthro (e.g. from mains_anthro1_pre2012.json)
  const { data: data2, error: error2 } = await supabase
    .from('mains_questions')
    .update({ status: 'published' })
    .ilike('id', 'mains-anthro%')
    .lt('exam_year', 2012);
    
  if (error2) {
    console.error('Error updating status by ID pattern:', error2);
  } else {
    console.log('Successfully ensured all pre-2012 mains-anthro questions are published.');
  }
}

publishQuestions().catch(console.error);
