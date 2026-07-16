const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd3N1cXprbmRseGZvYW50bmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjA0NjAsImV4cCI6MjA5Mjc5NjQ2MH0.u9-dnMmLXr_5fF243uzx6WyE_vR6dzERDuyFuF-HeZk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log('Fetching 1 row from mains_data_facts...');
    const { data, error } = await supabase
      .from('mains_data_facts')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error fetching mains_data_facts:', error);
    } else {
      console.log('Result row:', data);
    }
  } catch (err) {
    console.error('Catch error:', err);
  }
}

run();
