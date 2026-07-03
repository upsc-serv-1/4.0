const url = 'https://ngwsuqzkndlxfoantnlf.supabase.co/rest/v1/mains_questions?id=like.forum-mgp%25&limit=3';
const apikey = 'sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa';

async function run() {
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': apikey,
        'Authorization': `Bearer ${apikey}`
      }
    });
    if (!res.ok) {
      console.error('Error status:', res.status);
      return;
    }
    const data = await res.json();
    console.log(`Fetched ${data.length} Forum questions:`);
    console.log(JSON.stringify(data.map(q => ({
      id: q.id,
      is_pyq: q.is_pyq,
      is_upsc_cse: q.is_upsc_cse,
      exam_category: q.exam_category,
      exam: q.exam,
      exam_group: q.exam_group,
      source_attribution_label: q.source_attribution_label
    })), null, 2));
  } catch (err) {
    console.error(err);
  }
}

run();
