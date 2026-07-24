const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://rnelxupyiejsqekmcrcz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const files = [
  "C:\\Users\\Dr. Yogesh\\Desktop\\mains\\neet and upsc cms\\neet pg\\neet-pg-pyq-2018.json",
  "C:\\Users\\Dr. Yogesh\\Desktop\\mains\\neet and upsc cms\\neet pg\\neet-pg-pyq-2024.json",
  "C:\\Users\\Dr. Yogesh\\Desktop\\mains\\neet and upsc cms\\ini cet\\ini-cet-pyq-2021-november.json",
  "C:\\Users\\Dr. Yogesh\\Desktop\\mains\\neet and upsc cms\\ini cet\\ini-cet-pyq-2025-may.json"
];

async function updateSupabase() {
  let totalUpdated = 0;
  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.error(`File not found: ${file}`);
      continue;
    }
    console.log(`Processing ${file}...`);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const questions = data.questions;
    if (!questions || !Array.isArray(questions)) {
      console.error(`No questions array in ${file}`);
      continue;
    }

    for (const q of questions) {
      if (!q.id) continue;
      
      const updateData = {
        question_text: q.questionText,
        options: q.options,
        explanation_markdown: q.explanationMarkdown
      };

      const { error } = await supabase
        .from('questions')
        .update(updateData)
        .eq('id', q.id);

      if (error) {
        console.error(`Error updating ${q.id}:`, error.message);
      } else {
        totalUpdated++;
      }
    }
    console.log(`Finished processing ${file}.`);
  }
  console.log(`Total questions successfully updated in Supabase: ${totalUpdated}`);
}

updateSupabase();
