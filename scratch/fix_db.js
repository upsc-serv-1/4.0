const apikey = 'sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa';
const baseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co/rest/v1';

async function updateQuestions(subject, wrongPaper, correctPaper) {
  const url = `${baseUrl}/mains_questions?subject=eq.${encodeURIComponent(subject)}&paper=eq.${wrongPaper}`;
  console.log(`Updating ${subject} questions from ${wrongPaper} to ${correctPaper}...`);
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': apikey,
        'Authorization': `Bearer ${apikey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        paper: correctPaper
      })
    });
    
    if (!res.ok) {
      console.error(`Failed to update ${subject}. Status: ${res.status}`);
      const text = await res.text();
      console.error(text);
      return;
    }
    
    const data = await res.json();
    console.log(`Successfully updated ${data.length} questions for ${subject} to ${correctPaper}`);
  } catch (err) {
    console.error(`Error updating ${subject}:`, err);
  }
}

async function run() {
  // Update Indian Economy from GS1 to GS3
  await updateQuestions('INDIAN ECONOMY', 'GS1', 'GS3');
  // Update Social Justice from GS1 to GS2
  await updateQuestions('SOCIAL JUSTICE', 'GS1', 'GS2');
}

run();
