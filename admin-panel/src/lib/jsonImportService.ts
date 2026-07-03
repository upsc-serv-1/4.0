import { supabase } from './supabase';
import type { TestFull, QuestionFull } from './types';

export interface ImportResult {
  success: boolean;
  testId: string;
  filename: string;
  questionsUploaded: number;
  error?: string;
  message?: string;
}

// Simple and robust deterministic UUID generator based on content hash
function deterministicUUID(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const hex3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0');
  const hex4 = ((h1 & h2) >>> 0).toString(16).padStart(8, '0');
  
  const part1 = hex1;
  const part2 = hex2.slice(0, 4);
  const part3 = '4' + hex3.slice(1, 4);
  const part4 = ((h2 & 0x3fff) | 0x8000).toString(16);
  const part5 = (hex3 + hex4).slice(0, 12);
  
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

export async function importJsonFile(file: File): Promise<ImportResult> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const fnameLower = file.name.toLowerCase();

    // --------------------------------------------------------------------------
    // CASE A: VALUE ADDITIONS (Array of items)
    // --------------------------------------------------------------------------
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return {
          success: false,
          testId: '',
          filename: file.name,
          questionsUploaded: 0,
          error: 'Empty JSON array'
        };
      }

      // Determine table name based on filename first, then item keys
      let tableName = '';
      let formatName = '';

      if (fnameLower.includes('data_facts')) {
        tableName = 'mains_data_facts';
        formatName = 'Data & Facts';
      } else if (fnameLower.includes('intro_conclusions')) {
        tableName = 'mains_intro_conclusions';
        formatName = 'Introductions & Conclusions';
      } else if (fnameLower.includes('essay_value_add')) {
        tableName = 'mains_essay_value_add';
        formatName = 'Essay Value Add';
      } else if (fnameLower.includes('ethics_value_add')) {
        tableName = 'mains_ethics_value_add';
        formatName = 'Ethics Value Add';
      } else if (fnameLower.includes('mnemonics')) {
        tableName = 'mains_mnemonics';
        formatName = 'Mnemonics';
      } else if (fnameLower.includes('frameworks')) {
        tableName = 'mains_frameworks';
        formatName = 'Frameworks';
      } else {
        // Fallback to key checks on the first item
        const firstItem = data[0];
        if ('mnemonic_keyword' in firstItem) {
          tableName = 'mains_mnemonics';
          formatName = 'Mnemonics';
        } else if ('framework_name' in firstItem) {
          tableName = 'mains_frameworks';
          formatName = 'Frameworks';
        } else if ('entry_type' in firstItem) {
          tableName = 'mains_essay_value_add';
          formatName = 'Essay Value Add';
        } else if ('ethics_type' in firstItem) {
          tableName = 'mains_ethics_value_add';
          formatName = 'Ethics Value Add';
        } else if ('introduction' in firstItem || 'quote_text' in firstItem) {
          tableName = 'mains_intro_conclusions';
          formatName = 'Introductions & Conclusions';
        } else if ('parameter' in firstItem) {
          tableName = 'mains_data_facts';
          formatName = 'Data & Facts';
        } else {
          return {
            success: false,
            testId: '',
            filename: file.name,
            questionsUploaded: 0,
            error: 'Could not detect Value Addition category from file name or keys.'
          };
        }
      }

      // Map raw items to schema properties
      const mappedRows = data.map((item: any) => {
        let rowId = item.id;
        
        if (tableName === 'mains_data_facts') {
          if (!rowId) {
            rowId = deterministicUUID(JSON.stringify([item.paper, item.subject, item.section_group, item.parameter, item.card_title, item.content_markdown]));
          }
          return {
            id: rowId,
            paper: item.paper || null,
            subject: item.subject || null,
            section_group: item.section_group || null,
            microtopic: item.microtopic || null,
            subtopic: item.subtopic || null,
            parameter: item.parameter || '',
            card_title: item.card_title || '',
            content_markdown: item.content_markdown || '',
            source: item.source || null,
            hierarchy_path: item.hierarchy_path || null
          };
        } else if (tableName === 'mains_intro_conclusions') {
          if (!rowId) {
            rowId = deterministicUUID(JSON.stringify([item.paper, item.subject, item.section_group, item.card_title, item.introduction]));
          }
          return {
            id: rowId,
            paper: item.paper || null,
            subject: item.subject || null,
            section_group: item.section_group || null,
            microtopic: item.microtopic || null,
            subtopic: item.subtopic || null,
            card_title: item.card_title || '',
            quote_text: item.quote_text || null,
            quote_author: item.quote_author || null,
            introduction: item.introduction || null,
            examples: item.examples || null,
            conclusion: item.conclusion || null,
            data_points: item.data_points || null,
            hierarchy_path: item.hierarchy_path || null
          };
        } else if (tableName === 'mains_essay_value_add') {
          if (!rowId) {
            rowId = deterministicUUID(JSON.stringify([item.title, item.category, item.entry_type, item.content]));
          }
          return {
            id: rowId,
            paper: item.paper || null,
            subject: item.subject || null,
            section_group: item.section_group || null,
            microtopic: item.microtopic || null,
            subtopic: item.subtopic || null,
            title: item.title || '',
            category: item.category || '',
            entry_type: item.entry_type || 'anecdote',
            content: item.content || '',
            author: item.author || null,
            usage_guide: item.usage_guide || null,
            hierarchy_path: item.hierarchy_path || null
          };
        } else if (tableName === 'mains_ethics_value_add') {
          if (!rowId) {
            rowId = deterministicUUID(JSON.stringify([item.title, item.ethics_type, item.content_markdown]));
          }
          return {
            id: rowId,
            ethics_type: item.ethics_type || 'keyword',
            paper: item.paper || 'GS-IV',
            subject: item.subject || 'ETHICS, INTEGRITY & APTITUDE',
            section_group: item.section_group || null,
            microtopic: item.microtopic || null,
            subtopic: item.subtopic || null,
            title: item.title || '',
            content_markdown: item.content_markdown || '',
            diagram_image_path: item.diagram_image_path || null,
            officer_name: item.officer_name || null,
            initiative: item.initiative || null,
            impact: item.impact || null,
            core_values: item.core_values || null,
            pyqs: Array.isArray(item.pyqs) ? item.pyqs.map(String) : null,
            hierarchy_path: item.hierarchy_path || null
          };
        } else if (tableName === 'mains_mnemonics') {
          if (!rowId) {
            rowId = deterministicUUID(JSON.stringify([item.mnemonic_number_title, item.mnemonic_keyword, item.explanation_examples]));
          }
          return {
            id: rowId,
            paper: item.paper || null,
            subject: item.subject || null,
            section_group: item.section_group || null,
            microtopic: item.microtopic || null,
            subtopic: item.subtopic || null,
            mnemonic_number_title: item.mnemonic_number_title || '',
            mnemonic_keyword: item.mnemonic_keyword || '',
            formula_expansion: item.formula_expansion || [],
            explanation_examples: item.explanation_examples || '',
            hierarchy_path: item.hierarchy_path || null
          };
        } else {
          // mains_frameworks
          if (!rowId) {
            rowId = deterministicUUID(JSON.stringify([item.framework_name, item.breakdown_markdown]));
          }
          return {
            id: rowId,
            framework_name: item.framework_name || '',
            diagram_image_path: item.diagram_image_path || null,
            breakdown_markdown: item.breakdown_markdown || '',
            hierarchies: item.hierarchies || []
          };
        }
      });

      // Batch upsert to the database
      const batchSize = 50;
      let uploadedCount = 0;
      for (let i = 0; i < mappedRows.length; i += batchSize) {
        const batch = mappedRows.slice(i, i + batchSize);
        const { error } = await supabase.from(tableName).upsert(batch);
        if (error) {
          console.error(`Value Addition batch error at index ${i}:`, error);
          return {
            success: false,
            testId: '',
            filename: file.name,
            questionsUploaded: uploadedCount,
            error: `Failed to insert batch to ${tableName}: ${error.message}`
          };
        }
        uploadedCount += batch.length;
      }

      return {
        success: true,
        testId: tableName,
        filename: file.name,
        questionsUploaded: 0,
        message: `✓ Value Add: ${formatName} • ${uploadedCount} items imported/updated successfully`
      };
    }

    // --------------------------------------------------------------------------
    // CASE B: MAINS QUESTIONS & ANSWERS (Nested questions format with answers)
    // --------------------------------------------------------------------------
    const isMains = (data.id && String(data.id).startsWith('mains')) || 
                    fnameLower.includes('mains') || 
                    (data.questions && data.questions[0] && Array.isArray(data.questions[0].answers));

    if (isMains) {
      if (!data.questions || !Array.isArray(data.questions)) {
        return {
          success: false,
          testId: '',
          filename: file.name,
          questionsUploaded: 0,
          error: 'Mains JSON missing questions array'
        };
      }

      const paperName = data.paper || '';
      const questions: any[] = [];
      const answers: any[] = [];
      const seenAnswerIds = new Set<string>();

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

        questions.push({
          id: qId,
          question_number: q.questionNumber || null,
          question_text: q.questionText || '',
          marks: q.marks || null,
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

            // Ensure uniqueness within the batch
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

      // Batch upsert questions
      const batchSize = 50;
      for (let i = 0; i < questions.length; i += batchSize) {
        const batch = questions.slice(i, i + batchSize);
        const { error } = await supabase.from('mains_questions').upsert(batch);
        if (error) {
          return {
            success: false,
            testId: data.id || '',
            filename: file.name,
            questionsUploaded: 0,
            error: `Failed to insert Mains Questions: ${error.message}`
          };
        }
      }

      // Batch upsert answers
      for (let i = 0; i < answers.length; i += batchSize) {
        const batch = answers.slice(i, i + batchSize);
        const { error } = await supabase.from('mains_answers').upsert(batch);
        if (error) {
          return {
            success: false,
            testId: data.id || '',
            filename: file.name,
            questionsUploaded: 0,
            error: `Failed to insert Mains Answers: ${error.message}`
          };
        }
      }

      return {
        success: true,
        testId: data.id || file.name.replace('.json', ''),
        filename: file.name,
        questionsUploaded: questions.length,
        message: `✓ Mains Q&A: ${data.title || file.name} • ${questions.length} questions & ${answers.length} model answers uploaded`
      };
    }

    // --------------------------------------------------------------------------
    // CASE C: PRELIMS TESTS (Original import logic)
    // --------------------------------------------------------------------------
    if (!data.questions || !Array.isArray(data.questions)) {
      return {
        success: false,
        testId: '',
        filename: file.name,
        questionsUploaded: 0,
        error: 'Invalid JSON: missing questions array'
      };
    }

    const testId = data.id || file.name.replace('.json', '');
    
    let inferredCourse = 'Civil Services';
    if (data.course) {
      inferredCourse = data.course;
    } else {
      const progId = (data.program_id || '').toLowerCase();
      const progName = (data.program_name || '').toLowerCase();
      if (['medical', 'neet', 'cms', 'inicet'].some(k => progId.includes(k) || progName.includes(k))) {
        inferredCourse = 'Medical Science';
      }
    }
    
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
      exam_year: data.launch_year,
      course: inferredCourse
    };

    console.log('Uploading test:', testId, testPayload);
    const { error: testError } = await supabase
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

    const questionRows: Partial<QuestionFull>[] = [];

    for (const q of data.questions) {
      const qId = q.id || `${testId}-q${q.questionNumber}`;
      
      const ei = q.exam_info || {};
      const isUpscCse = ei.is_upsc_cse || ei.is_upsc_csc || false;
      const isUpscCms = ei.is_upsc_cms || false;
      const isNeetPg = ei.is_neetpg || ei.is_neet_pg || false;
      const isIniCet = ei.is_inicet || ei.is_ini_cet || false;
      const isAllied = ei.is_allied || false;
      const isOthers = ei.is_others || false;
      const isPyq = q.isPyq || q.is_pyq || ei.isPyq || ei.is_pyq || false;
      
      const isNcert = q.is_ncert || q.isNcert || ei.is_ncert || (q.source_attribution_label?.includes('NCERT') ?? false);
      
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
        sub_topic: q.subtopic,
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
        exam_paper: q.exam_paper || ei.paper,
        course: q.course || ((isUpscCms || isNeetPg || isIniCet) ? 'Medical Science' : inferredCourse)
      };

      questionRows.push(questionRow);
    }

    const batchSize = 50;
    let uploadedCount = 0;
    
    for (let i = 0; i < questionRows.length; i += batchSize) {
      const batch = questionRows.slice(i, i + batchSize);
      console.log(`Uploading question batch ${i / batchSize + 1} (${batch.length} questions)`);
      
      const { error: questionsError } = await supabase
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

