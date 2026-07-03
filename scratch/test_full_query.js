const url = 'https://ngwsuqzkndlxfoantnlf.supabase.co/rest/v1/mains_questions?paper=eq.GS1&select=id,question_number,question_text,marks,exam_year,subject,section_group,microtopic,subtopic,macrotag,microtag,hierarchy_path,paper,is_pyq,source_attribution_label,exam_info,stage,exam,exam_group,is_upsc_cse,is_allied,is_others,exam_category,answers:mains_answers(id,institute)';
const apikey = 'sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa';

async function run() {
  console.time('full_query');
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': apikey,
        'Authorization': `Bearer ${apikey}`
      }
    });
    console.timeEnd('full_query');
    if (!res.ok) {
      console.error('Error status:', res.status);
      const text = await res.text();
      console.error(text);
      return;
    }
    const data = await res.json();
    console.log(`Full query returned ${data.length} rows`);
  } catch (err) {
    console.timeEnd('full_query');
    console.error(err);
  }
}

run();
