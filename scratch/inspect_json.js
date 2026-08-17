const fs = require('fs');
const file1 = 'C:\\Users\\Dr. Yogesh\\Downloads\\compass antrho\\final 3\\mains-upsc_anthro_paper_1_2012-2025_compass_updated_v3.json';
const data = JSON.parse(fs.readFileSync(file1, 'utf8'));
console.log('Subject:', data.questions[0].subject);
console.log('Paper:', data.questions[0].paper);
const qWithAnswers = data.questions.find(q => q.answers && q.answers.length > 0);
if (qWithAnswers) {
  console.log('Answer Institute:', qWithAnswers.answers[0].institute);
  console.log('Sample answer ID:', qWithAnswers.answers[0].id);
} else {
  console.log('No answers found in any question.');
}
console.log('Total questions:', data.questions.length);
