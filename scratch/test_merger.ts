import { mergeQuestions } from './src/utils/merger';

const questions = [
  {
    id: '1',
    question_text: 'The Rowlatt Act was based on',
    options: { a: '1 only', b: '1 and 2 only', c: '2 and 3 only', d: '1, 2 and 3' },
    correct_answer: 'b',
    explanation_markdown: '220. Solution (b)',
    tests: { institute: 'PMF IAS' },
  },
  {
    id: '2',
    question_text: 'The Rowlatt Act was based on',
    options: { a: '1 only', b: '1 and 2 only', c: '2 and 3 only', d: '1, 2 and 3' },
    correct_answer: 'b',
    explanation_markdown: '220. Solution (b)',
    tests: { institute: 'X-IAS' },
  }
];

const { mergedQs } = mergeQuestions(questions);

console.log(JSON.stringify(mergedQs, null, 2));
