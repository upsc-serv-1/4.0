import { supabase } from './supabase';
import type { TestFull, QuestionFull } from './types';

export interface ImportResult {
  success: boolean;
  testId: string;
  filename: string;
  questionsUploaded: number;
  error?: string;
}

export async function importJsonFile(file: File): Promise<ImportResult> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.questions || !Array.isArray(data.questions)) {
      return {
        success: false,
        testId: '',
        filename: file.name,
        questionsUploaded: 0,
        error: 'Invalid JSON: missing questions array'
      };
    }

    // 1. PREPARE TEST METADATA (aligned with Supabase schema)
    const testId = data.id || file.name.replace('.json', '');
    
    const testPayload: Partial<TestFull> = {
      id: testId,
      title: data.title || testId,
      provider: data.institute || 'Unknown',
      institute: data.institute || 'Unknown',
      program_id: data.program_id,
      program_name: data.program_name,
      launch_year: data.launch_year,
      series: data.series,
      level: data.level,
      year: data.launch_year,
      subject: data.subject || (data.questions[0]?.subject),
      subject_test: data.subject_test,
      section_group: data.sectionGroup,
      paper_type: data.paperType,
      question_count: data.questions.length,
      default_minutes: data.defaultMinutes,
      source_mode: data.sourceMode,
      is_demo_available: data.is_demo_available || false,
      exam_year: data.launch_year
    };

    // Insert/upsert test via Supabase client
    console.log('Uploading test:', testId, testPayload);
    const { error: testError, data: testData } = await supabase
      .from('tests')
      .upsert([testPayload]);

    if (testError) {
      console.error('Test upsert error:', testError);
      return {
        success: false,
        testId,
        filename: file.name,
        questionsUploaded: 0,
        error: `Failed to insert test: ${testError.message}`
      };
    }
    console.log('Test uploaded successfully:', testData);

    // 2. PREPARE QUESTIONS
    const questionRows: Partial<QuestionFull>[] = [];

    for (const q of data.questions) {
      const qId = q.id || `${testId}-q${q.questionNumber}`;
      
      // Extract exam info
      const ei = q.exam_info || {};
      const isUpscCse = ei.is_upsc_cse || ei.is_upsc_csc || false;
      const isUpscCms = ei.is_upsc_cms || false;
      const isNeetPg = ei.is_neetpg || ei.is_neet_pg || false;
      const isIniCet = ei.is_inicet || ei.is_ini_cet || false;
      const isAllied = ei.is_allied || false;
      const isOthers = ei.is_others || false;
      const isPyq = q.isPyq || q.is_pyq || ei.isPyq || ei.is_pyq || false;
      
      // NCERT detection
      const isNcert = q.is_ncert || q.isNcert || ei.is_ncert || (q.source_attribution_label?.includes('NCERT') ?? false);
      
      // Question text extraction
      let qText = '';
      const stmtLines = q.statementLines || q.statement_lines;
      if (Array.isArray(stmtLines)) {
        qText = stmtLines.join('\n\n');
      } else if (typeof stmtLines === 'string') {
        qText = stmtLines;
      } else {
        qText = q.questionText || q.question_text || '';
      }

      const questionRow: Partial<QuestionFull> = {
        id: qId,
        test_id: testId,
        question_number: q.questionNumber,
        question_text: qText,
        statement_lines: q.statementLines,
        question_blocks: q.questionBlocks,
        options: q.options,
        correct_answer: q.correctAnswer,
        explanation_markdown: q.explanationMarkdown,
        source_attribution_label: q.source_attribution_label,
        source: ei,
        subject: q.subject,
        section_group: q.sectionGroup,
        micro_topic: q.microTopic,
        is_pyq: isPyq,
        is_ncert: isNcert,
        is_upsc_cse: isUpscCse,
        is_upsc_cms: isUpscCms,
        is_neetpg: isNeetPg,
        is_inicet: isIniCet,
        is_allied: isAllied,
        is_others: isOthers,
        is_cancelled: q.is_cancelled || false,
        exam: q.exam || ei.exam,
        exam_group: q.exam_group || ei.group,
        exam_year: q.exam_year || ei.year,
        exam_category: q.exam_category || ei.exam_category,
        specific_exam: q.specific_exam || ei.specific_exam,
        exam_stage: q.exam_stage || ei.stage || data.exam_stage || 'Prelims',
        exam_paper: q.exam_paper || ei.paper
      };

      questionRows.push(questionRow);
    }

    // 3. BATCH UPSERT QUESTIONS
    const batchSize = 50;
    let uploadedCount = 0;
    
    for (let i = 0; i < questionRows.length; i += batchSize) {
      const batch = questionRows.slice(i, i + batchSize);
      console.log(`Uploading question batch ${i / batchSize + 1} (${batch.length} questions)`);
      
      const { error: questionsError, data: questionsData } = await supabase
        .from('questions')
        .upsert(batch as any[]);

      if (questionsError) {
        console.error(`Questions batch error at index ${i}:`, questionsError);
        return {
          success: false,
          testId,
          filename: file.name,
          questionsUploaded: uploadedCount,
          error: `Failed to insert questions batch: ${questionsError.message}`
        };
      }
      
      uploadedCount += batch.length;
      console.log(`Batch uploaded successfully. Total: ${uploadedCount}/${questionRows.length}`);
    }

    return {
      success: true,
      testId,
      filename: file.name,
      questionsUploaded: uploadedCount
    };
  } catch (error) {
    return {
      success: false,
      testId: '',
      filename: file.name,
      questionsUploaded: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
