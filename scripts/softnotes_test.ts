/**
 * SoftNotes DB Schema & Connection Test
 *
 * Run:  npx tsx scripts/softnotes_test.ts
 */
import { createClient } from '@supabase/supabase-js';

const url = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd3N1cXprbmRseGZvYW50bmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjA0NjAsImV4cCI6MjA5Mjc5NjQ2MH0.u9-dnMmLXr_5fF243uzx6WyE_vR6dzERDuyFuF-HeZk';

const sb = createClient(url, key);

async function main() {
  console.log('── SoftNotes Supabase Table & Connection Test ──\n');

  const tables = [
    'soft_notebooks',
    'soft_pages',
    'soft_strokes',
    'soft_text_boxes'
  ];

  let missingCount = 0;

  for (const table of tables) {
    const { error } = await sb.from(table).select('id').limit(1);
    if (error) {
      if (error.code === '42P01') { // PostgreSQL undefined_table error
        console.log(`✗ Table "${table}" is MISSING from Supabase.`);
      } else {
        console.log(`✗ Table "${table}" returned error: ${error.message} (Code: ${error.code})`);
      }
      missingCount++;
    } else {
      console.log(`✓ Table "${table}" is REACHABLE and active.`);
    }
  }

  console.log('\n── Result Summary ──');
  if (missingCount > 0) {
    console.log(`\n❌ TEST FAILED: ${missingCount} table(s) are missing or inaccessible.`);
    console.log('👉 ACTION REQUIRED: Please apply the SQL statements in "supabase/SOFTNOTES_MIGRATION.sql" in your Supabase SQL Editor.');
  } else {
    console.log('\n✅ TEST PASSED: All SoftNotes tables are fully set up and reachable in Supabase!');
  }
}

main().catch(e => { console.error('Fatal error running test:', e); process.exit(1); });
