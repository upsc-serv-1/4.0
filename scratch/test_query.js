const url = 'https://ngwsuqzkndlxfoantnlf.supabase.co/rest/v1/mains_questions?paper=eq.GS1&select=id,exam_year,subject,section_group,paper';
const apikey = 'sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa';

async function run() {
  console.time('query');
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': apikey,
        'Authorization': `Bearer ${apikey}`
      }
    });
    console.timeEnd('query');
    if (!res.ok) {
      console.error('Error status:', res.status);
      const text = await res.text();
      console.error(text);
      return;
    }
    const data = await res.json();
    console.log(`Query returned ${data.length} rows`);
  } catch (err) {
    console.timeEnd('query');
    console.error(err);
  }
}

run();
