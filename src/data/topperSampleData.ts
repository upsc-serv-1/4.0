/**
 * Bundled sample topper questions (~205 rows from topperSampleData.json).
 *
 * IMPORTANT: this module must NOT import from mainsConsolidatedLoader at
 * runtime. It previously did `import { ConsolidatedQuestion }` (a type used
 * only in annotations), which created a real module cycle:
 *
 *   mainsConsolidatedLoader → topperSampleData → mainsConsolidatedLoader
 *
 * The loader is also reached from app/mains.tsx, which flashcard screens import
 * for its markdown helpers. With the cycle in place, evaluating either module
 * first could observe the other mid-initialisation and throw at bundle load.
 *
 * The type is now imported with `import type`, so it is erased at compile time
 * and contributes nothing to the runtime module graph.
 */
import type { ConsolidatedQuestion } from './mainsConsolidatedLoader';

let sampleTopperQuestions: ConsolidatedQuestion[] = [];

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  sampleTopperQuestions = require('./topperSampleData.json');
} catch (e) {
  console.log('[TopperSampleData] Failed to load sample topper data:', e);
}

export { sampleTopperQuestions };
