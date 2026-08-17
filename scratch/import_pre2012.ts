import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://rnelxupyiejsqekmcrcz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Importing Pre-2012 JSON files...');
  const files = [
    'C:\\Users\\Dr. Yogesh\\Downloads\\compass antrho\\final 2 - Copy\\backup\\bk9\\mains_anthro1_pre2012.json',
    'C:\\Users\\Dr. Yogesh\\Downloads\\compass antrho\\final 2 - Copy\\backup\\bk9\\mains_anthro2_pre2012.json'
  ];

  const batchSize = 100;

  for (const file of files) {
    console.log(`Processing file: ${file}`);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      console.error(`Error reading ${file}:`, err);
      continue;
    }
    
    const paperName = data.paper || '';
    const questions = [];
    const answers = [];
    const seenAnswerIds = new Set();
    
    for (const q of data.questions) {
      const qId = q.id || `mains-${paperName.toLowerCase()}-q${q.questionNumber}`;
      
      const examInfoVal = q.exam_info || null;
      const isPyqVal = q.is_pyq ?? (examInfoVal?.isPyq ?? true);
      const stageVal = q.stage || examInfoVal?.stage || "mains";
      const examVal = q.exam || examInfoVal?.exam || "Mains";
      const groupVal = q.exam_group || examInfoVal?.group || "UPSC CSE";
      const isUpscCseVal = q.is_upsc_cse ?? (examInfoVal?.is_upsc_cse ?? true);
      const isAlliedVal = q.is_allied ?? (examInfoVal?.is_allied ?? false);
      const isOthersVal = q.is_others ?? (examInfoVal?.is_others ?? false);
      const examCategoryVal = q.exam_category || examInfoVal?.exam_category || "cse";
      
      questions.push({
        id: qId,
        question_number: q.questionNumber ? String(q.questionNumber) : null,
        question_text: q.questionText || '',
        marks: q.marks || null,
        exam_year: q.year || null,
        paper: q.paper || paperName || 'Optional',
        subject: q.subject || null,
        section_group: q.sectionGroup || null,
        microtopic: q.microTopic || null,
        subtopic: q.subTopic || null,
        nanotopic: q.nanoTopic || null,
        macrotag: q.macrotag || null,
        microtag: q.microtag || null,
        hierarchy_path: q.hierarchy_path || null,
        is_pyq: isPyqVal,
        source_attribution_label: q.source_attribution_label || null,
        exam_info: examInfoVal,
        stage: stageVal,
        exam: examVal,
        exam_group: groupVal,
        is_upsc_cse: isUpscCseVal,
        is_allied: isAlliedVal,
        is_others: isOthersVal,
        exam_category: examCategoryVal,
        course: q.course || data.course || 'Civil Services',
        institute: q.institute || data.institute || 'UPSC',
        program_id: q.program_id || data.program_id || 'cse',
        program_name: q.program_name || data.program_name || 'CSE'
      });
      
      if (q.answers && Array.isArray(q.answers)) {
        for (const ans of q.answers) {
          const institute = (ans.institute || '').trim();
          const instClean = institute.toLowerCase().replace(/\s+/g, '_');
          let ansId = ans.id || `${qId}-${instClean}`;
          
          let counter = 1;
          const baseAnsId = ansId;
          while (seenAnswerIds.has(ansId)) {
            counter++;
            ansId = `${baseAnsId}-${counter}`;
          }
          seenAnswerIds.add(ansId);
          
          answers.push({
            id: ansId,
            question_id: qId,
            institute: institute,
            answer_text: ans.answerText || ''
          });
        }
      }
    }
    
    // Batch upsert questions
    console.log(`Upserting ${questions.length} questions...`);
    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize);
      const { error } = await supabase.from('mains_questions').upsert(batch);
      if (error) {
        console.error(`Error upserting questions:`, error);
        return;
      }
    }
    
    // Batch upsert answers
    console.log(`Upserting ${answers.length} answers...`);
    for (let i = 0; i < answers.length; i += batchSize) {
      const batch = answers.slice(i, i + batchSize);
      const { error } = await supabase.from('mains_answers').upsert(batch);
      if (error) {
        console.error(`Error upserting answers:`, error);
        return;
      }
    }
    console.log(`Successfully imported ${file}`);
  }
}

run().catch(console.error);
