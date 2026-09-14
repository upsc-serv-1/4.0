/**
 * Adversarial Empirical Test Suite for Milestone 1 (src/utils/topperHelpers.ts)
 * 
 * Tests:
 * 1. False positive filtering on deceptive test series titles & institutes
 * 2. Genuine topper variations (spacing, casing, missing years, rank formats)
 * 3. Question key normalization (numbering styles, punctuation, quotes, collisions)
 * 4. Paper normalization edge cases (GS1-4, Essay, Optionals)
 * 5. Null, undefined, malformed, and boundary inputs across all exports
 * 6. Attachment map collision and deduplication behavior
 */

import {
  isGenuineTopperAnswer,
  isTopperAnswer,
  isTopperQuestion,
  getTopperName,
  getAir,
  getTopperPageUrls,
  normalizePaper,
  normalizeQuestionKey,
  getAllTopperQuestions,
  buildTopperAttachmentMap,
  NON_TOPPER_INSTITUTES,
  TEST_SERIES_FALSE_POSITIVES,
} from '../topperHelpers';

interface TestCaseResult {
  suite: string;
  name: string;
  passed: boolean;
  expected: any;
  actual: any;
  details?: string;
}

const results: TestCaseResult[] = [];

function assert(suite: string, name: string, condition: boolean, expected: any, actual: any, details?: string) {
  results.push({
    suite,
    name,
    passed: condition,
    expected,
    actual,
    details,
  });
}

console.log('===============================================================');
console.log('  STARTING ADVERSARIAL EMPIRICAL TESTS FOR topperHelpers.ts    ');
console.log('===============================================================\n');

// ============================================================================
// SUITE 1: False Positive Filtering on Deceptive Inputs
// ============================================================================
console.log('--- SUITE 1: False Positive & Deceptive Inputs ---');

// Test deceptive institutes with "topper" or test series phrases
const deceptiveCases = [
  { input: { institute: 'GS Mains Test Series Toppers Batch' }, shouldBeTopper: false, desc: 'GS Mains Test Series Toppers Batch' },
  { input: { institute: 'Daily Topper Answer Practice 2024' }, shouldBeTopper: false, desc: 'Daily Topper Answer Practice 2024' },
  { input: { institute: 'Vision IAS Mains Test Series 2024' }, shouldBeTopper: false, desc: 'Vision IAS Mains Test Series 2024' },
  { input: { institute: 'ForumIAS Open Test Topper Discussion' }, shouldBeTopper: false, desc: 'ForumIAS Open Test Topper Discussion' },
  { input: { institute: 'Level Up IAS Model Answer' }, shouldBeTopper: false, desc: 'Level Up IAS Model Answer' },
  { input: { institute: 'PW OnlyIAS Sample Answer Batch' }, shouldBeTopper: false, desc: 'PW OnlyIAS Sample Answer Batch' },
  { input: { institute: 'Mock Test 3 Synopsis' }, shouldBeTopper: false, desc: 'Mock Test 3 Synopsis' },
  { input: { institute: 'Full Length Test FLT 01' }, shouldBeTopper: false, desc: 'Full Length Test FLT 01' },
  { input: { institute: 'Daily Answer Practice - Course Assignment' }, shouldBeTopper: false, desc: 'Daily Answer Practice - Course Assignment' },
  { input: { topper: 'GS Mains Test Series Toppers Batch' }, shouldBeTopper: false, desc: 'topper field: GS Mains Test Series Toppers Batch' },
  { input: { topper: 'Daily Topper Answer Practice 2024' }, shouldBeTopper: false, desc: 'topper field: Daily Topper Answer Practice 2024' },
  { input: { topper: 'Level Up IAS' }, shouldBeTopper: false, desc: 'topper field: Level Up IAS' },
  { input: { topper: 'Vision IAS' }, shouldBeTopper: false, desc: 'topper field: Vision IAS' },
  { input: { topper: 'Batch 2024 Test Series' }, shouldBeTopper: false, desc: 'topper field: Batch 2024 Test Series' },
  { input: { institute: 'AIR 2024 Mains Test Series' }, shouldBeTopper: false, desc: 'Year 2024 following AIR in institute name' },
];

for (const tc of deceptiveCases) {
  const actual = isGenuineTopperAnswer(tc.input);
  assert('Suite 1: False Positives', tc.desc, actual === tc.shouldBeTopper, tc.shouldBeTopper, actual);
}

// Check candidate name extraction does not return deceptive institutes
const deceptiveNameCases = [
  { input: { institute: 'GS Mains Test Series Toppers Batch' }, expected: 'Topper' },
  { input: { institute: 'Daily Topper Answer Practice 2024' }, expected: 'Topper' },
  { input: { topper: 'Level Up IAS' }, expected: 'Topper' },
  { input: { topper: 'Vision IAS' }, expected: 'Topper' },
  { input: { institute: 'Vision IAS (AIR 59)' }, expected: 'Vision IAS' }, // Name cleaned
];

for (const tc of deceptiveNameCases) {
  const actual = getTopperName(tc.input);
  assert('Suite 1: Deceptive Names', `getTopperName for: ${JSON.stringify(tc.input)}`, actual === tc.expected, tc.expected, actual);
}

// ============================================================================
// SUITE 2: Genuine Topper Variations
// ============================================================================
console.log('--- SUITE 2: Genuine Topper Variations ---');

const genuineCases = [
  { input: { topper: 'Shruti Sharma', air: 1 }, expectedAir: 1, expectedName: 'Shruti Sharma', desc: 'Standard topper with numeric AIR' },
  { input: { topper: 'Aditya Srivastava', air: 'AIR 1' }, expectedAir: 1, expectedName: 'Aditya Srivastava', desc: 'String AIR prefix' },
  { input: { topper: 'Uma Harathi N (AIR 3)' }, expectedAir: 3, expectedName: 'Uma Harathi N', desc: 'Topper string with embedded AIR' },
  { input: { institute: 'ForumIAS (AIR 59)' }, expectedAir: 59, expectedName: 'ForumIAS', desc: 'Institute with AIR in parentheses' },
  { input: { topper_name: 'Ananya Sharma', air_rank: 42 }, expectedAir: 42, expectedName: 'Ananya Sharma', desc: 'topper_name and air_rank fields' },
  { input: { is_topper: true, topper: 'Ishita Kishore' }, expectedAir: undefined, expectedName: 'Ishita Kishore', desc: 'is_topper flag without rank' },
  { input: { topper: '  Garima   Lohia  ' }, expectedAir: undefined, expectedName: 'Garima   Lohia', desc: 'Whitespace trimmed' },
  { input: { topper: 'KANISHAK KATARIA' }, expectedAir: undefined, expectedName: 'KANISHAK KATARIA', desc: 'All uppercase name' },
  { input: { topper: 'tinadabi' }, expectedAir: undefined, expectedName: 'tinadabi', desc: 'All lowercase name' },
];

for (const tc of genuineCases) {
  const isTopper = isGenuineTopperAnswer(tc.input);
  assert('Suite 2: Genuine Detection', `isGenuineTopper: ${tc.desc}`, isTopper === true, true, isTopper);

  const actualAir = getAir(tc.input);
  assert('Suite 2: AIR Extraction', `getAir: ${tc.desc}`, actualAir === tc.expectedAir, tc.expectedAir, actualAir);

  const actualName = getTopperName(tc.input);
  assert('Suite 2: Name Extraction', `getTopperName: ${tc.desc}`, actualName === tc.expectedName, tc.expectedName, actualName);
}

// Test edge case AIR inputs
const airEdgeCases = [
  { a: { air: '01' }, expected: 1, desc: 'Leading zero in rank "01"' },
  { a: { air: 0 }, expected: 0, desc: 'Rank 0' },
  { a: { air: 'AIR-5' }, expected: 5, desc: 'AIR-5 with hyphen' },
  { a: { air: 'AIR: 10' }, expected: 10, desc: 'AIR: 10 with colon' },
  { a: { air: 'air 99' }, expected: 99, desc: 'lowercase air 99' },
  { a: { air: 'Rank 59' }, expected: 59, desc: 'Rank 59' },
  { a: { air: 'N/A' }, expected: 'N/A', isGenuine: false, desc: 'AIR "N/A" should not be genuine topper' },
  { a: { air: '' }, expected: undefined, isGenuine: false, desc: 'Empty AIR string' },
  { a: { air: '   ' }, expected: undefined, isGenuine: false, desc: 'Whitespace AIR string' },
  { a: { air: null }, expected: undefined, isGenuine: false, desc: 'null AIR' },
  { a: { air: undefined }, expected: undefined, isGenuine: false, desc: 'undefined AIR' },
];

for (const tc of airEdgeCases) {
  const actualAir = getAir(tc.a);
  assert('Suite 2: AIR Edge Cases', `getAir: ${tc.desc}`, actualAir === tc.expected, tc.expected, actualAir);
  if (tc.isGenuine !== undefined) {
    const genuine = isGenuineTopperAnswer(tc.a);
    assert('Suite 2: AIR Non-Genuine Edge Cases', `isGenuineTopperAnswer for ${tc.desc}`, genuine === tc.isGenuine, tc.isGenuine, genuine);
  }
}

// ============================================================================
// SUITE 3: Question Key Normalization & Matching
// ============================================================================
console.log('--- SUITE 3: normalizeQuestionKey Edge Cases ---');

// Two versions of the same question that MUST generate identical keys for attachment
const matchingPairs = [
  {
    name: '1. vs (1) indexing',
    q1: { year: 2023, paper: 'GS1', questionText: '1. Discuss the impact of globalization on Indian society.' },
    q2: { year: 2023, paper: 'GS1', questionText: '(1) Discuss the impact of globalization on Indian society.' },
  },
  {
    name: 'Q1. vs Question 1: indexing',
    q1: { year: 2023, paper: 'GS1', questionText: 'Q1. Discuss the impact of globalization on Indian society.' },
    q2: { year: 2023, paper: 'GS1', questionText: 'Question 1: Discuss the impact of globalization on Indian society.' },
  },
  {
    name: '1(a) vs 1. (a) indexing',
    q1: { year: 2022, paper: 'GS2', questionText: '1(a) Examine the role of the Election Commission in ensuring free and fair elections.' },
    q2: { year: 2022, paper: 'GS2', questionText: '1. (a) Examine the role of the Election Commission in ensuring free and fair elections.' },
  },
  {
    name: 'Trailing question mark vs period',
    q1: { year: 2021, paper: 'GS3', questionText: 'What are the major challenges of agricultural marketing in India?' },
    q2: { year: 2021, paper: 'GS3', questionText: 'What are the major challenges of agricultural marketing in India.' },
  },
  {
    name: 'Double quotes vs curly quotes vs single quotes',
    q1: { year: 2020, paper: 'GS4', questionText: 'Explain the term "moral attitude" with examples.' },
    q2: { year: 2020, paper: 'GS4', questionText: 'Explain the term “moral attitude” with examples.' },
  },
  {
    name: 'Year as number vs string vs topper_year',
    q1: { year: 2023, paper: 'GS1', questionText: 'Evaluate the role of women in the freedom struggle.' },
    q2: { topper_year: '2023', paper: 'GS1', questionText: 'Evaluate the role of women in the freedom struggle.' },
  },
  {
    name: 'Paper variations (GS-1 vs GS 1 vs Paper 1)',
    q1: { year: 2023, paper: 'GS1', questionText: 'Describe the salient features of Indian society.' },
    q2: { year: 2023, paper: 'GS-1', questionText: 'Describe the salient features of Indian society.' },
  },
  {
    name: 'Anthropology paper variations',
    q1: { year: 2022, paper: 'Optional', questionText: 'Discuss the concept of cultural relativism.' },
    q2: { year: 2022, paper: 'ANTHRO 1', questionText: 'Discuss the concept of cultural relativism.' },
  },
];

for (const pair of matchingPairs) {
  const k1 = normalizeQuestionKey(pair.q1);
  const k2 = normalizeQuestionKey(pair.q2);
  assert(
    'Suite 3: Question Key Matching',
    pair.name,
    k1 === k2 && k1 !== '',
    k1,
    k2,
    `k1="${k1}", k2="${k2}"`
  );
}

// Test question key collision on empty/missing inputs
const emptyKey1 = normalizeQuestionKey({});
const emptyKey2 = normalizeQuestionKey({ questionText: '' });
const emptyKeyNull = normalizeQuestionKey(null);
assert('Suite 3: Empty Key Handling', 'null input returns empty string', emptyKeyNull === '', '', emptyKeyNull);
assert('Suite 3: Empty Key Handling', '{} should not match unrelated empty question', emptyKey1 === '', '', emptyKey1);

// Test question beginning with a year or number in content (not an index)
const numberContentQ1 = { year: 2023, paper: 'GS1', questionText: '1. 1991 economic reforms transformed India.' };
const numberContentQ2 = { year: 2023, paper: 'GS1', questionText: '1991 economic reforms transformed India.' };
const kNum1 = normalizeQuestionKey(numberContentQ1);
const kNum2 = normalizeQuestionKey(numberContentQ2);
assert(
  'Suite 3: Number in Question Content',
  'Preserving content numbers like "1991 reforms" when stripped of index',
  kNum1 === kNum2,
  kNum1,
  kNum2,
  `kNum1="${kNum1}", kNum2="${kNum2}"`
);

// ============================================================================
// SUITE 4: Paper Normalization
// ============================================================================
console.log('--- SUITE 4: Paper Normalization ---');

const paperCases = [
  { in: 'GS1', out: 'GS1' },
  { in: 'gs 1', out: 'GS1' },
  { in: 'GS-1', out: 'GS1' },
  { in: 'PAPER 1', out: 'GS1' },
  { in: 'GENERAL STUDIES 1', out: 'GS1' },
  { in: 'GS2', out: 'GS2' },
  { in: 'GS-II', out: 'GS2' },
  { in: 'PAPER-2', out: 'GS2' },
  { in: 'GS3', out: 'GS3' },
  { in: 'GS 3', out: 'GS3' },
  { in: 'GS4', out: 'GS4' },
  { in: 'GS-IV', out: 'GS4' },
  { in: 'Essay', out: 'Essay' },
  { in: 'ESSAY PAPER', out: 'Essay' },
  { in: 'Optional', out: 'Optional' },
  { in: 'Anthropology Paper 1', out: 'Optional' },
  { in: 'ANTHRO2', out: 'Optional' },
  { in: 'SOCIOLOGY PAPER 2', out: 'Optional' },
  { in: 'PSIR PAPER 1', out: 'Optional' },
  { in: 'GEOGRAPHY PAPER 2', out: 'Optional' },
  { in: 'HISTORY PAPER 1', out: 'Optional' },
  { in: 'PUBLIC ADMINISTRATION PAPER 2', out: 'Optional' },
  { in: 'POLITICAL SCIENCE PAPER 1', out: 'Optional' },
  // What about other optionals that have "Paper 1" or "Paper 2" in their name?
  { in: 'Economics Paper 1', out: 'Optional', desc: 'Economics Paper 1 (Optional)' },
  { in: 'Philosophy Paper 2', out: 'Optional', desc: 'Philosophy Paper 2 (Optional)' },
  { in: 'Mathematics Paper 1', out: 'Optional', desc: 'Mathematics Paper 1 (Optional)' },
  { in: '', out: '' },
  { in: null as any, out: '' },
  { in: undefined as any, out: '' },
];

for (const pc of paperCases) {
  const actual = normalizePaper(pc.in);
  assert(
    'Suite 4: Paper Normalization',
    pc.desc || `normalizePaper("${pc.in}")`,
    actual === pc.out,
    pc.out,
    actual
  );
}

// ============================================================================
// SUITE 5: Page URLs and Image Parsing
// ============================================================================
console.log('--- SUITE 5: getTopperPageUrls ---');

const pageUrlCases = [
  {
    input: { page_urls: ['https://example.com/p1.jpg', 'https://example.com/p2.jpg'] },
    expectedLen: 2,
    desc: 'Standard page_urls array',
  },
  {
    input: { image_urls: ['https://example.com/p1.jpg'] },
    expectedLen: 1,
    desc: 'image_urls fallback',
  },
  {
    input: { page_urls: '["https://example.com/p1.jpg", "https://example.com/p2.jpg"]' },
    expectedLen: 2,
    desc: 'JSON string page_urls',
  },
  {
    input: { page_urls: 'https://example.com/p1.jpg ||| https://example.com/p2.jpg' },
    expectedLen: 2,
    desc: 'Delimiter separated page_urls',
  },
  {
    input: { answerText: 'Look at the diagram: ![diagram](https://example.com/markdown_img.jpg)' },
    expectedLen: 1,
    desc: 'Markdown image fallback in answerText',
  },
  {
    input: { page_urls: [null, undefined, '', '   ', 'https://example.com/valid.jpg'] },
    expectedLen: 1,
    desc: 'Dirty array with nulls, empties, whitespaces',
  },
  {
    input: null,
    expectedLen: 0,
    desc: 'null input',
  },
  {
    input: {},
    expectedLen: 0,
    desc: 'empty object',
  },
  {
    input: { page_urls: [] },
    expectedLen: 0,
    desc: 'empty array',
  },
];

for (const puc of pageUrlCases) {
  const actual = getTopperPageUrls(puc.input);
  assert(
    'Suite 5: Page URLs',
    puc.desc,
    actual.length === puc.expectedLen,
    puc.expectedLen,
    actual.length,
    `got: ${JSON.stringify(actual)}`
  );
}

// ============================================================================
// SUITE 6: Dataset Filter & Attachment Map
// ============================================================================
console.log('--- SUITE 6: getAllTopperQuestions & buildTopperAttachmentMap ---');

// Test getAllTopperQuestions null/empty handling
assert('Suite 6: Dataset Filter', 'null returns []', Array.isArray(getAllTopperQuestions(null)) && getAllTopperQuestions(null).length === 0, 0, getAllTopperQuestions(null).length);
assert('Suite 6: Dataset Filter', 'undefined returns []', Array.isArray(getAllTopperQuestions(undefined)) && getAllTopperQuestions(undefined).length === 0, 0, getAllTopperQuestions(undefined).length);
assert('Suite 6: Dataset Filter', 'empty array returns []', getAllTopperQuestions([]).length === 0, 0, 0);

// Test question with topper answer BUT zero page URLs (must be excluded)
const qWithoutImages = {
  id: 'topper-1',
  answers: [
    {
      is_topper: true,
      topper: 'Test Topper',
      page_urls: [], // No images!
    },
  ],
};
const filteredNoImg = getAllTopperQuestions([qWithoutImages]);
assert('Suite 6: Dataset Filter', 'Excludes topper question with 0 images', filteredNoImg.length === 0, 0, filteredNoImg.length);

// Test question with topper answer AND valid images (must be included)
const qWithImages = {
  id: 'topper-2',
  answers: [
    {
      is_topper: true,
      topper: 'Test Topper',
      page_urls: ['https://example.com/p1.jpg'],
    },
  ],
};
const filteredWithImg = getAllTopperQuestions([qWithImages]);
assert('Suite 6: Dataset Filter', 'Includes topper question with valid images', filteredWithImg.length === 1, 1, filteredWithImg.length);

// Test duplicate question IDs in getAllTopperQuestions (must dedupe by id)
const dupQuestions = [
  { id: 'topper-dup', answers: [{ is_topper: true, page_urls: ['https://example.com/p1.jpg'] }] },
  { id: 'topper-dup', answers: [{ is_topper: true, page_urls: ['https://example.com/p1.jpg'] }] },
];
const deduped = getAllTopperQuestions(dupQuestions);
assert('Suite 6: Dataset Filter', 'Dedupes questions by ID', deduped.length === 1, 1, deduped.length);

// Test buildTopperAttachmentMap
const topperQuestionsForMap = [
  {
    id: 'tq-1',
    year: 2023,
    paper: 'GS1',
    questionText: '1. Discuss the features of Bhakti movement.',
    answers: [
      { id: 'ans-1', is_topper: true, topper: 'Candidate A', air: 10, page_urls: ['https://ex.com/1.jpg'] },
    ],
  },
  {
    id: 'tq-2',
    year: 2023,
    paper: 'GS1',
    questionText: 'Discuss the features of Bhakti movement.', // Same question, different topper
    answers: [
      { id: 'ans-2', is_topper: true, topper: 'Candidate B', air: 25, page_urls: ['https://ex.com/2.jpg'] },
      { id: 'ans-1', is_topper: true, topper: 'Candidate A', air: 10, page_urls: ['https://ex.com/1.jpg'] }, // duplicate answer ID
    ],
  },
];

const attachmentMap = buildTopperAttachmentMap(topperQuestionsForMap);
const qKey = normalizeQuestionKey({ year: 2023, paper: 'GS1', questionText: 'Discuss the features of Bhakti movement.' });
const attached = attachmentMap.get(qKey) || [];

assert(
  'Suite 6: Attachment Map',
  'Attachment map merges multiple toppers and dedupes answers by ID',
  attached.length === 2,
  2,
  attached.length,
  `attached count=${attached.length}, ids=${attached.map(a => a.id).join(', ')}`
);

// ============================================================================
// SUMMARY & PRINT RESULTS
// ============================================================================
console.log('\n===============================================================');
console.log('                    TEST EXECUTION SUMMARY                     ');
console.log('===============================================================');

const passedTests = results.filter(r => r.passed);
const failedTests = results.filter(r => !r.passed);

console.log(`Total tests:  ${results.length}`);
console.log(`Passed tests: ${passedTests.length}`);
console.log(`Failed tests: ${failedTests.length}`);

if (failedTests.length > 0) {
  console.log('\n--- FAILED TEST DETAILS ---');
  for (const f of failedTests) {
    console.log(`\n❌ [${f.suite}] ${f.name}`);
    console.log(`   Expected: ${JSON.stringify(f.expected)}`);
    console.log(`   Actual:   ${JSON.stringify(f.actual)}`);
    if (f.details) console.log(`   Details:  ${f.details}`);
  }
} else {
  console.log('\n✅ ALL ADVERSARIAL TESTS PASSED!');
}

console.log('\n===============================================================\n');
