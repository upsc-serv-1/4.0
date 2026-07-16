const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd3N1cXprbmRseGZvYW50bmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjA0NjAsImV4cCI6MjA5Mjc5NjQ2MH0.u9-dnMmLXr_5fF243uzx6WyE_vR6dzERDuyFuF-HeZk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const tables = [
      'mains_data_facts',
      'mains_intro_conclusions',
      'mains_essay_value_add',
      'mains_ethics_value_add',
      'mains_mnemonics',
      'mains_frameworks',
      'mains_questions'
    ];
    
    for (const table of tables) {
      console.log(`\nInspecting table: ${table}`);
      // We can query using RPC if we have one, or just query 1 row and check keys
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
        
      if (error) {
        console.error(`Error querying ${table}:`, error.message);
      } else if (data && data.length > 0) {
        console.log(`Columns for ${table}:`, Object.keys(data[0]));
      } else {
        // If table is empty, select schema via REST/postgrest or a blank select
        console.log(`Table ${table} is empty. Trying to query with invalid column to see error (shows columns)...`);
        const { error: err2 } = await supabase
          .from(table)
          .select('non_existent_column_for_inspection_test');
        if (err2) {
          console.log(`PostgREST error message:`, err2.message);
        }
      }
    }
  } catch (err) {
    console.error('Catch error:', err);
  }
}

run();
