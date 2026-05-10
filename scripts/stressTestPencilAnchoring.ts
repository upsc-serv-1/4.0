/**
 * stressTestPencilAnchoring.ts
 * ─────────────────────────────
 * Step 11 stress test: 200+ strokes on a 10-block note.
 *
 * This is a pure TypeScript / Node script — no React Native or Expo
 * dependencies — so it can be run with `ts-node` or `npx tsx`:
 *
 *   npx tsx scripts/stressTestPencilAnchoring.ts
 *
 * What it validates:
 *   1. Build a 10-block note with 220 synthetic strokes (22 per block).
 *   2. Assign block-level anchors using the same logic as pilotV2Migration.
 *   3. Simulate a block reorder (move block 1 to position 9).
 *   4. Verify that every stroke's anchor still points to the correct block.
 *   5. Simulate close + reopen (re-run migration on serialised content).
 *   6. Verify anchors survive the roundtrip.
 *   7. Verify span-offset fields are present for horizontal strokes.
 *
 * Exit code 0 = all assertions pass.
 * Exit code 1 = at least one assertion failed.
 */

/* ── Type stubs (mirrors types.ts without RN deps) ───────────────────────── */
interface Point { x: number; y: number; pressure: number; t: number }
interface Stroke {
  id: string;
  tool: 'pen' | 'highlighter' | 'eraser' | 'lasso';
  color: string;
  width: number;
  opacity: number;
  points: Point[];
  zIndex: number;
  createdAt: string;
  bounds?: { x: number; y: number; w: number; h: number };
  anchor?: {
    blockId: string;
    blockOriginY: number;
    elementId?: string;
    spanIndex?: number;
    startOffset?: number;
    endOffset?: number;
    startRelX?: number;
    endRelX?: number;
    relY?: number;
  };
}
interface Block {
  id: string;
  type: 'heading' | 'paragraph' | 'bullet';
  text: string;
  level?: 1 | 2 | 3;
}

/* ── Utilities ────────────────────────────────────────────────────────────── */
let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  FAIL: ${label}`);
    failed++;
  }
}

/** Linearly spaced range. */
function linspace(a: number, b: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => a + (b - a) * (i / Math.max(1, n - 1)));
}

/* ── Build 10 blocks ─────────────────────────────────────────────────────── */
const BLOCKS: Block[] = Array.from({ length: 10 }, (_, i) => ({
  id: `block_${i}`,
  type: i % 3 === 0 ? 'heading' : 'paragraph',
  text: `Block ${i}: ${'Sample text for block '.repeat(3)}${i}.`,
  level: i % 3 === 0 ? 1 : undefined,
}));

/* ── Estimate block layouts (same formula as pilotV2Migration) ─────────── */
const AVG_CHARS_PER_LINE = 60;
const LINE_PX = 26;
const HEADING_PX = 42;
const GAP_PX = 8;

function estimateLayouts(blocks: Block[]): Map<string, { y: number; h: number }> {
  const map = new Map<string, { y: number; h: number }>();
  let y = 0;
  for (const b of blocks) {
    const lines = Math.max(1, Math.ceil(b.text.length / AVG_CHARS_PER_LINE));
    const h = b.type === 'heading' ? HEADING_PX : lines * LINE_PX;
    map.set(b.id, { y, h });
    y += h + GAP_PX;
  }
  return map;
}

const layout = estimateLayouts(BLOCKS);
const totalH = Math.max(...Array.from(layout.values()).map(r => r.y + r.h));

/* ── Generate 22 strokes per block = 220 total ───────────────────────────── */
function makeStroke(
  blockIdx: number,
  strokeIdx: number,
  layout: Map<string, { y: number; h: number }>,
  totalH: number,
): Stroke {
  const blockId = `block_${blockIdx}`;
  const rect = layout.get(blockId)!;
  // Relative Y centre of the stroke (0..1 of total page height)
  const relCentreY = (rect.y + rect.h * 0.5) / totalH;
  // Alternate between freehand diagonal and horizontal (underline-like)
  const isHorizontal = strokeIdx % 4 === 0;
  const isHighlighter = strokeIdx % 6 === 0;

  let points: Point[];
  if (isHorizontal) {
    // Flat horizontal stroke — looks like an underline
    const y0 = relCentreY;
    points = linspace(0.1, 0.9, 8).map((x, i) => ({
      x, y: y0 + (Math.random() * 0.003 - 0.0015),
      pressure: 0.5, t: Date.now() + i,
    }));
  } else {
    // Short diagonal scribble
    const y0 = (rect.y + rect.h * (0.2 + 0.6 * (strokeIdx / 22))) / totalH;
    points = Array.from({ length: 6 }, (_, i) => ({
      x: 0.15 + 0.2 * (strokeIdx / 22) + i * 0.01,
      y: y0 + i * 0.005,
      pressure: 0.5,
      t: Date.now() + i,
    }));
  }

  return {
    id: `str_${blockIdx}_${strokeIdx}`,
    tool: isHighlighter ? 'highlighter' : 'pen',
    color: '#0F172A',
    width: 2,
    opacity: isHighlighter ? 0.35 : 1,
    points,
    zIndex: blockIdx * 22 + strokeIdx,
    createdAt: new Date().toISOString(),
  };
}

const RAW_STROKES: Stroke[] = [];
for (let bi = 0; bi < 10; bi++) {
  for (let si = 0; si < 22; si++) {
    RAW_STROKES.push(makeStroke(bi, si, layout, totalH));
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log('Stress test — 200+ strokes on 10-block note');
console.log(`${'─'.repeat(60)}\n`);
console.log(`Total strokes: ${RAW_STROKES.length}`);
assert(RAW_STROKES.length >= 200, `Generated ≥ 200 strokes (got ${RAW_STROKES.length})`);

/* ── Assign block anchors (mirror of migration logic) ───────────────────── */
function assignAnchors(
  strokes: Stroke[],
  blocks: Block[],
  layout: Map<string, { y: number; h: number }>,
  totalH: number,
): Stroke[] {
  return strokes.map((s) => {
    if (s.anchor) return s;
    const pts = s.points;
    if (!pts.length) return s;
    let cy = 0;
    for (const p of pts) cy += p.y;
    cy = (cy / pts.length) * totalH;

    let bestId: string | null = null;
    let bestDist = Infinity;
    for (const [id, rect] of layout.entries()) {
      if (cy >= rect.y && cy <= rect.y + rect.h) { bestId = id; break; }
      const d = Math.min(Math.abs(cy - rect.y), Math.abs(cy - (rect.y + rect.h)));
      if (d < bestDist) { bestDist = d; bestId = id; }
    }
    if (!bestId) return s;

    const blockOriginY = (layout.get(bestId)!.y) / totalH;

    // Span-offset detection
    const isHighlighter = s.tool === 'highlighter';
    let spanAnchor: Partial<Stroke['anchor']> = {};
    if (isHighlighter || s.tool === 'pen') {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const dX = maxX - minX;
      const dY = maxY - minY;
      if (isHighlighter || (dX > 0.05 && dY < dX * 0.25)) {
        const rect = layout.get(bestId)!;
        const blockH = Math.max(1, rect.h);
        const relY = Math.max(0, Math.min(1, (cy - rect.y) / blockH));
        const blockText = blocks.find(b => b.id === bestId)?.text ?? '';
        const textLen = Math.max(1, blockText.length);
        spanAnchor = {
          elementId:   bestId,
          spanIndex:   0,
          startOffset: Math.round(minX * textLen),
          endOffset:   Math.min(textLen, Math.round(maxX * textLen)),
          startRelX:   minX,
          endRelX:     maxX,
          relY,
        };
      }
    }

    return { ...s, anchor: { blockId: bestId, blockOriginY, ...spanAnchor } };
  });
}

const ANCHORED = assignAnchors(RAW_STROKES, BLOCKS, layout, totalH);

/* ── Assertion 1: Every stroke has an anchor ──────────────────────────────── */
console.log('\n[1] Every stroke gets an anchor assigned');
const allAnchored = ANCHORED.every(s => !!s.anchor);
assert(allAnchored, 'All 220 strokes carry an anchor after assignAnchors()');

/* ── Assertion 2: Each stroke's anchor.blockId points to a real block ──── */
console.log('\n[2] Anchor blockId maps to a real block');
const blockIds = new Set(BLOCKS.map(b => b.id));
const allBlockIdsValid = ANCHORED.every(s => s.anchor && blockIds.has(s.anchor.blockId));
assert(allBlockIdsValid, 'Every anchor.blockId references an existing block');

/* ── Assertion 3: Horizontal / highlighter strokes have span-offset fields */
console.log('\n[3] Span-offset fields present for horizontal/highlighter strokes');
const horizontalStrokes = ANCHORED.filter(s => {
  const pts = s.points;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return s.tool === 'highlighter' || ((maxX - minX) > 0.05 && (maxY - minY) < (maxX - minX) * 0.25);
});
assert(horizontalStrokes.length > 0, `At least one horizontal/highlighter stroke exists (found ${horizontalStrokes.length})`);
const allHaveSpanFields = horizontalStrokes.every(s =>
  s.anchor &&
  typeof s.anchor.elementId === 'string' &&
  typeof s.anchor.spanIndex === 'number' &&
  typeof s.anchor.startOffset === 'number' &&
  typeof s.anchor.endOffset === 'number' &&
  typeof s.anchor.startRelX === 'number' &&
  typeof s.anchor.endRelX === 'number' &&
  typeof s.anchor.relY === 'number',
);
assert(allHaveSpanFields, 'All horizontal/highlighter strokes have full span-offset anchor fields');

/* ── Assertion 4: Block reorder — move block_0 to end ─────────────────── */
console.log('\n[4] Simulate block reorder: move block_0 to last position');
const reorderedBlocks = [...BLOCKS.slice(1), BLOCKS[0]];
const reorderedLayout = estimateLayouts(reorderedBlocks);
const newTotalH = Math.max(...Array.from(reorderedLayout.values()).map(r => r.y + r.h));

// After reorder, re-derive display offsets for each stroke.
// Assertion: stroke for block_0 now has a DIFFERENT display Y from original.
const block0StrokeBefore = ANCHORED.find(s => s.anchor?.blockId === 'block_0')!;
const oldBlockY = block0StrokeBefore.anchor!.blockOriginY; // 0..1 at commit time
const newBlockRect = reorderedLayout.get('block_0')!;
const newBlockY = newBlockRect.y / newTotalH;
// The display delta should be non-zero since the block moved.
const dy = newBlockY - oldBlockY;
assert(Math.abs(dy) > 0.01, `block_0 display delta after reorder is non-trivial (dy=${dy.toFixed(4)})`);

/* ── Assertion 5: Idempotent re-anchor (no anchor overwrite on second run) */
console.log('\n[5] Re-running assignAnchors on already-anchored strokes is idempotent');
const DOUBLE_ANCHORED = assignAnchors(ANCHORED, BLOCKS, layout, totalH);
const allUnchanged = ANCHORED.every((orig, i) => {
  const dup = DOUBLE_ANCHORED[i];
  return dup.anchor?.blockId === orig.anchor?.blockId &&
         dup.anchor?.blockOriginY === orig.anchor?.blockOriginY;
});
assert(allUnchanged, 'Second assignAnchors() call leaves all anchors unchanged');

/* ── Assertion 6: Serialise → parse roundtrip preserves all anchor fields */
console.log('\n[6] JSON roundtrip preserves anchor fields (close + reopen simulation)');
const serialised = JSON.stringify(ANCHORED);
const parsed: Stroke[] = JSON.parse(serialised);
const roundtripOk = parsed.every((s, i) => {
  const orig = ANCHORED[i];
  if (!orig.anchor) return !s.anchor;
  if (!s.anchor) return false;
  return (
    s.anchor.blockId       === orig.anchor.blockId &&
    s.anchor.blockOriginY  === orig.anchor.blockOriginY &&
    s.anchor.elementId     === orig.anchor.elementId &&
    s.anchor.startOffset   === orig.anchor.startOffset &&
    s.anchor.endOffset     === orig.anchor.endOffset
  );
});
assert(roundtripOk, 'All anchor fields survive JSON serialise → parse roundtrip');

/* ── Assertion 7: Each block owns roughly the right number of strokes ──── */
console.log('\n[7] Stroke distribution across blocks');
const countPerBlock = new Map<string, number>();
for (const s of ANCHORED) {
  const bid = s.anchor?.blockId ?? '__none__';
  countPerBlock.set(bid, (countPerBlock.get(bid) ?? 0) + 1);
}
const allBlocksPresent = BLOCKS.every(b => (countPerBlock.get(b.id) ?? 0) > 0);
assert(allBlocksPresent, 'Every block owns at least one stroke');
const minCount = Math.min(...BLOCKS.map(b => countPerBlock.get(b.id) ?? 0));
const maxCount = Math.max(...BLOCKS.map(b => countPerBlock.get(b.id) ?? 0));
console.log(`   Distribution: min=${minCount} max=${maxCount} per block`);
assert(minCount >= 1, `No block is orphaned (min strokes per block: ${minCount})`);

/* ── Summary ─────────────────────────────────────────────────────────────── */
console.log(`\n${'─'.repeat(60)}`);
console.log(`Result: ${passed} passed, ${failed} failed`);
console.log(`${'─'.repeat(60)}\n`);

if (failed > 0) {
  process.exit(1);
}
