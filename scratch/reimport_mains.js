const fs = require('fs');
const path = require('path');

const apikey = 'sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa';
const baseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co/rest/v1';

const filesToImport = [
  'mains_gs1_consolidated.json',
  'mains_gs2_consolidated.json',
  'mains_gs3_consolidated.json',
  'mains_gs4_consolidated.json'
];

const mainsJsonDir = path.join(__dirname, '..', 'mains json files');

async function dbRequest(endpoint, method, body = null, preferHeader = null) {
  const url = `${baseUrl}/${endpoint}`;
  const headers = {
    'apikey': apikey,
    'Authorization': `Bearer ${apikey}`,
    'Content-Type': 'application/json'
  };
  if (preferHeader) {
    headers['Prefer'] = preferHeader;
  }
  
  const options = {
    method,
    headers
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function run() {
  try {
    console.log('Step 1: Deleting existing mains_answers and mains_questions for GS1-GS4 paper-by-paper...');
    
    for (const paper of ['GS1', 'GS2', 'GS3', 'GS4']) {
      console.log(`\nClearing database for ${paper}...`);
      
      // Fetch question IDs for this paper
      const questions = await dbRequest(`mains_questions?paper=eq.${paper}&select=id`, 'GET');
      const questionIds = questions.map(q => q.id);
      console.log(`  Found ${questionIds.length} questions in ${paper} to clear.`);
      
      if (questionIds.length > 0) {
        // Delete answers in batches of 100 to avoid long query times or URL limits
        const deleteBatchSize = 100;
        for (let i = 0; i < questionIds.length; i += deleteBatchSize) {
          const batch = questionIds.slice(i, i + deleteBatchSize);
          const filter = `in.(${batch.map(id => `"${id}"`).join(',')})`;
          await dbRequest(`mains_answers?question_id=${filter}`, 'DELETE');
        }
        console.log(`  Deleted mains_answers for ${paper}`);
        
        // Delete questions
        await dbRequest(`mains_questions?paper=eq.${paper}`, 'DELETE');
        console.log(`  Deleted mains_questions for ${paper}`);
      }
    }

    // 2. Parse and load each file
    for (const filename of filesToImport) {
      const filepath = path.join(mainsJsonDir, filename);
      console.log(`\nProcessing file: ${filename}...`);
      if (!fs.existsSync(filepath)) {
        console.error(`File not found: ${filepath}`);
        continue;
      }
      
      const fileContent = fs.readFileSync(filepath, 'utf8');
      const data = JSON.parse(fileContent);
      
      if (!data.questions || !Array.isArray(data.questions)) {
        console.error(`Invalid JSON in ${filename}: missing questions array`);
        continue;
      }
      
      const paperName = data.paper || '';
      const questions = [];
      const answers = [];
      const seenAnswerIds = new Set();
      
      console.log(`Parsing ${data.questions.length} questions from ${filename} for paper ${paperName}...`);
      
      for (const q of data.questions) {
        const qId = q.id || `mains-${paperName.toLowerCase()}-q${q.questionNumber}`;
        
        const examInfoVal = q.exam_info || null;
        let isPyqVal = true;
        let stageVal = "mains";
        let examVal = "Mains";
        let groupVal = "UPSC CSE";
        let isUpscCseVal = true;
        let isAlliedVal = false;
        let isOthersVal = false;
        let examCategoryVal = "cse";

        if (examInfoVal && typeof examInfoVal === 'object') {
          if ('isPyq' in examInfoVal) isPyqVal = Boolean(examInfoVal.isPyq);
          if ('stage' in examInfoVal) stageVal = String(examInfoVal.stage);
          if ('exam' in examInfoVal) examVal = String(examInfoVal.exam);
          if ('group' in examInfoVal) groupVal = String(examInfoVal.group);
          if ('is_upsc_cse' in examInfoVal) isUpscCseVal = Boolean(examInfoVal.is_upsc_cse);
          if ('is_allied' in examInfoVal) isAlliedVal = Boolean(examInfoVal.is_allied);
          if ('is_others' in examInfoVal) isOthersVal = Boolean(examInfoVal.is_others);
          if ('exam_category' in examInfoVal) examCategoryVal = String(examInfoVal.exam_category);
        }

        // Round marks to nearest integer since database expects integer (prevents 12.5 type error)
        let marksVal = null;
        if (q.marks != null) {
          const parsedMarks = Number(q.marks);
          marksVal = Number.isFinite(parsedMarks) ? Math.round(parsedMarks) : null;
        }

        questions.push({
          id: qId,
          question_number: q.questionNumber || null,
          question_text: q.questionText || '',
          marks: marksVal,
          exam_year: q.year || null,
          paper: paperName,
          subject: q.subject || null,
          section_group: q.sectionGroup || null,
          microtopic: q.microTopic || null,
          subtopic: q.subTopic || null,
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
          exam_category: examCategoryVal
        });

        if (q.answers && Array.isArray(q.answers)) {
          for (const ans of q.answers) {
            const institute = (ans.institute || '').trim();
            const instClean = institute.toLowerCase().replace(/\s+/g, '_');
            let ansId = ans.id || `${qId}-${instClean}`;

            const baseAnsId = ansId;
            let counter = 1;
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

      // Upsert questions in batches
      console.log(`Uploading ${questions.length} questions in batches of 50...`);
      const batchSize = 50;
      for (let i = 0; i < questions.length; i += batchSize) {
        const batch = questions.slice(i, i + batchSize);
        await dbRequest('mains_questions', 'POST', batch, 'resolution=merge-duplicates');
      }
      console.log(`Uploaded all questions for ${filename}`);

      // Upsert answers in batches
      console.log(`Uploading ${answers.length} answers in batches of 50...`);
      for (let i = 0; i < answers.length; i += batchSize) {
        const batch = answers.slice(i, i + batchSize);
        await dbRequest('mains_answers', 'POST', batch, 'resolution=merge-duplicates');
      }
      console.log(`Uploaded all answers for ${filename}`);
    }
    
    console.log('\nConsolidated mains re-import completed successfully!');
  } catch (err) {
    console.error('\nError during re-import:', err);
  }
}

run();
