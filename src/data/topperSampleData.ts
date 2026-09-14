import { ConsolidatedQuestion } from './mainsConsolidatedLoader';

let sampleTopperQuestions: ConsolidatedQuestion[] = [];

try {
  sampleTopperQuestions = require('./topperSampleData.json');
} catch (e) {
  console.log('[TopperSampleData] Failed to load sample topper data:', e);
}

export { sampleTopperQuestions };
