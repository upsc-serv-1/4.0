/**
 * pilotV2StrokeRemap.test.ts (Step 22)
 * -------------------------------------
 * Anchor-stability spec for the stroke-remap helper.  Covers the three
 * cases called out in the task plan:
 *
 *   (a) anchored-stroke remap math
 *   (b) excluded-block stroke drop
 *   (c) unanchored-stroke fallback scaling
 *
 * The tests are written against the public API of
 * `src/lib/pilotV2StrokeRemap.ts` and use plain `assert` so they can run
 * either under `node --test` (no extra deps) OR under any jest-style
 * runner the project may add later (the `describe` / `it` shims below
 * fall back to direct invocation when jest globals are absent).
 */
import * as assert from 'assert';
import {
  estimateExportBlockLayouts,
  remapStrokeForExport,
  remapStrokesForExport,
} from '../src/lib/pilotV2StrokeRemap';
import { PilotV2Block, PilotV2PencilStroke } from '../src/components/pilot-v2/types';

// ── tiny describe/it shim so this file works under node --test AND jest ──
const _describe: (name: string, fn: () => void) => void =
  (globalThis as any).describe ?? ((name, fn) => { console.log(`# ${name}`); fn(); });
const _it: (name: string, fn: () => void) => void =
  (globalThis as any).it ?? ((name, fn) => { try { fn(); console.log(`  ✓ ${name}`); }
                                              catch (e) { console.error(`  ✗ ${name}`); throw e; } });

const blocks: PilotV2Block[] = [
  { id: 'b1', type: 'paragraph', text: 'The constitution of India is the supreme law of the land.' },
  { id: 'b2', type: 'paragraph', text: 'It establishes the framework of government.' },
  { id: 'b3', type: 'heading',   text: 'Constitutional bodies', level: 2 },
];

const layoutOpts = {
  canvasWidth:  800,
  canvasHeight: 1200,
  fontSize:     11,
  columns:      1,
};

const ctxBase = {
  exportCanvasWidth:  800,
  exportCanvasHeight: 1200,
  editorCanvasWidth:  800,
  editorCanvasHeight: 1200,
};

_describe('pilotV2StrokeRemap — anchored stroke math', () => {
  _it('re-projects an underline stroke onto the host block bounding box', () => {
    const layouts = estimateExportBlockLayouts(blocks, layoutOpts);
    const rect = layouts.get('b1');
    assert.ok(rect, 'expected a layout rect for b1');

    // An underline stroke under the word "constitution" — drawn at relative
    // page coords with anchor span across the word.
    const stroke: PilotV2PencilStroke = {
      id: 'stroke-1', tool: 'pen', color: '#000', width: 2, opacity: 1,
      points: [
        { x: 0.10, y: 0.05, pressure: 0.5, t: 1 },
        { x: 0.20, y: 0.06, pressure: 0.5, t: 2 },
        { x: 0.30, y: 0.05, pressure: 0.5, t: 3 },
      ],
      zIndex: 0, createdAt: '2024-01-01',
      anchor: {
        blockId: 'b1', blockOriginY: 0,
        elementId: 'b1', spanIndex: 0,
        startOffset: 4, endOffset: 16,
        startRelX: 0.10, endRelX: 0.30, relY: 0.5,
      },
    };

    const out = remapStrokeForExport(stroke, { layouts, ...ctxBase });
    assert.ok(out, 'expected a remapped stroke');
    assert.strictEqual(out!.points.length, 3);

    const expectedY = rect!.y + 0.5 * rect!.h;
    const expectedX0 = rect!.x + 0.10 * rect!.w;
    const expectedX1 = rect!.x + 0.30 * rect!.w;

    // First point must land at startRelX, last point at endRelX, all on the
    // same Y line (within rounding).
    assert.ok(Math.abs(out!.points[0].x - expectedX0) < 0.01,
      `first point x=${out!.points[0].x}, expected ${expectedX0}`);
    assert.ok(Math.abs(out!.points[2].x - expectedX1) < 0.01,
      `last point x=${out!.points[2].x}, expected ${expectedX1}`);
    for (const p of out!.points) {
      assert.ok(Math.abs(p.y - expectedY) < 0.01,
        `point y=${p.y}, expected ${expectedY}`);
    }
  });

  _it('preserves the relative position of mid-points (curves not collapsed)', () => {
    const layouts = estimateExportBlockLayouts(blocks, layoutOpts);
    const rect = layouts.get('b1')!;
    const stroke: PilotV2PencilStroke = {
      id: 's2', tool: 'highlighter', color: '#FDE68A', width: 12, opacity: 0.35,
      // Original stroke spans x ∈ [0.10, 0.30] in editor space, mid-point at 0.15
      points: [
        { x: 0.10, y: 0.04, pressure: 0.5, t: 1 },
        { x: 0.15, y: 0.05, pressure: 0.5, t: 2 },
        { x: 0.30, y: 0.04, pressure: 0.5, t: 3 },
      ],
      zIndex: 1, createdAt: '2024-01-01',
      anchor: {
        blockId: 'b1', blockOriginY: 0,
        startRelX: 0.10, endRelX: 0.30, relY: 0.5,
      },
    };
    const out = remapStrokeForExport(stroke, { layouts, ...ctxBase })!;
    // Mid point fraction along original = (0.15-0.10)/(0.30-0.10) = 0.25
    const expectedMid = rect.x + (0.10 + 0.25 * (0.30 - 0.10)) * rect.w;
    assert.ok(Math.abs(out.points[1].x - expectedMid) < 0.01,
      `mid point x=${out.points[1].x}, expected ${expectedMid}`);
  });
});

_describe('pilotV2StrokeRemap — excluded-block drop', () => {
  _it('returns null when the anchor block is not in the layout map', () => {
    // Pretend block b1 was filtered out — its rect is missing from layouts.
    const layouts = estimateExportBlockLayouts(
      blocks.filter(b => b.id !== 'b1'),
      layoutOpts,
    );
    assert.strictEqual(layouts.has('b1'), false);
    const stroke: PilotV2PencilStroke = {
      id: 's3', tool: 'pen', color: '#000', width: 2, opacity: 1,
      points: [{ x: 0.1, y: 0.05, pressure: 0.5, t: 1 }],
      zIndex: 0, createdAt: '2024-01-01',
      anchor: {
        blockId: 'b1', blockOriginY: 0,
        startRelX: 0.10, endRelX: 0.30, relY: 0.5,
      },
    };
    const out = remapStrokeForExport(stroke, { layouts, ...ctxBase });
    assert.strictEqual(out, null);
  });

  _it('remapStrokesForExport drops anchored strokes whose host vanished but keeps survivors', () => {
    const layouts = estimateExportBlockLayouts(
      blocks.filter(b => b.id !== 'b1'),
      layoutOpts,
    );
    const survivor: PilotV2PencilStroke = {
      id: 's-keep', tool: 'pen', color: '#000', width: 2, opacity: 1,
      points: [{ x: 0.1, y: 0.05, pressure: 0.5, t: 1 }, { x: 0.3, y: 0.05, pressure: 0.5, t: 2 }],
      zIndex: 0, createdAt: '2024-01-01',
      anchor: { blockId: 'b2', blockOriginY: 0, startRelX: 0.10, endRelX: 0.30, relY: 0.5 },
    };
    const dropped: PilotV2PencilStroke = { ...survivor, id: 's-drop',
      anchor: { blockId: 'b1', blockOriginY: 0, startRelX: 0.10, endRelX: 0.30, relY: 0.5 } };
    const out = remapStrokesForExport([survivor, dropped], { layouts, ...ctxBase });
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].id, 's-keep');
  });
});

_describe('pilotV2StrokeRemap — unanchored fallback scaling', () => {
  _it('scales relative point coords to the export canvas dims', () => {
    const layouts = estimateExportBlockLayouts(blocks, layoutOpts);
    const stroke: PilotV2PencilStroke = {
      id: 'free', tool: 'pen', color: '#0F172A', width: 3, opacity: 1,
      points: [
        { x: 0.0, y: 0.0, pressure: 0.5, t: 1 },
        { x: 0.5, y: 0.5, pressure: 0.5, t: 2 },
        { x: 1.0, y: 1.0, pressure: 0.5, t: 3 },
      ],
      zIndex: 0, createdAt: '2024-01-01',
      // No anchor → free canvas drawing (e.g. washi-tape area).
    };
    const out = remapStrokeForExport(stroke, { layouts, ...ctxBase })!;
    assert.ok(out, 'expected a remapped stroke');
    assert.strictEqual(out.points.length, 3);
    assert.ok(Math.abs(out.points[0].x - 0)    < 0.01);
    assert.ok(Math.abs(out.points[0].y - 0)    < 0.01);
    assert.ok(Math.abs(out.points[1].x - 400)  < 0.01); // 0.5 * 800
    assert.ok(Math.abs(out.points[1].y - 600)  < 0.01); // 0.5 * 1200
    assert.ok(Math.abs(out.points[2].x - 800)  < 0.01);
    assert.ok(Math.abs(out.points[2].y - 1200) < 0.01);
  });

  _it('uses different canvas dims correctly (export scales independently)', () => {
    const layouts = estimateExportBlockLayouts(blocks, {
      ...layoutOpts, canvasWidth: 1200, canvasHeight: 1600,
    });
    const stroke: PilotV2PencilStroke = {
      id: 'free2', tool: 'pen', color: '#000', width: 2, opacity: 1,
      points: [{ x: 0.5, y: 0.5, pressure: 0.5, t: 1 }],
      zIndex: 0, createdAt: '2024-01-01',
    };
    const out = remapStrokeForExport(stroke, {
      layouts,
      exportCanvasWidth:  1200,
      exportCanvasHeight: 1600,
      editorCanvasWidth:  800,
      editorCanvasHeight: 1200,
    })!;
    assert.ok(Math.abs(out.points[0].x - 600) < 0.01); // 0.5 * 1200
    assert.ok(Math.abs(out.points[0].y - 800) < 0.01); // 0.5 * 1600
  });
});

_describe('pilotV2StrokeRemap — anchor stability across font-size changes', () => {
  _it('underline stays bounded inside its host block when font size changes', () => {
    const stroke: PilotV2PencilStroke = {
      id: 'underline', tool: 'pen', color: '#000', width: 2, opacity: 1,
      points: [
        { x: 0.05, y: 0.07, pressure: 0.5, t: 1 },
        { x: 0.20, y: 0.07, pressure: 0.5, t: 2 },
      ],
      zIndex: 0, createdAt: '2024-01-01',
      anchor: { blockId: 'b1', blockOriginY: 0,
        startRelX: 0.05, endRelX: 0.20, relY: 0.5 },
    };

    for (const fs of [8, 11, 16, 18]) {
      const layouts = estimateExportBlockLayouts(blocks, { ...layoutOpts, fontSize: fs });
      const rect = layouts.get('b1')!;
      const out = remapStrokeForExport(stroke, { layouts, ...ctxBase })!;
      // Stroke must lie strictly inside the block's rect at every font size.
      for (const p of out.points) {
        assert.ok(p.x >= rect.x - 0.01 && p.x <= rect.x + rect.w + 0.01,
          `font ${fs}: x=${p.x} outside [${rect.x}, ${rect.x + rect.w}]`);
        assert.ok(p.y >= rect.y - 0.01 && p.y <= rect.y + rect.h + 0.01,
          `font ${fs}: y=${p.y} outside [${rect.y}, ${rect.y + rect.h}]`);
      }
    }
  });
});

console.log('\nAll pilotV2StrokeRemap specs passed.');
