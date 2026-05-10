/**
 * PilotV2UnifiedExport
 * --------------------
 * The single, unified export entry-point for the Pilot V2 surface.
 *
 * It wraps the app-wide `UnifiedExportSheet` (pastel backgrounds, sort-by,
 * font-size, paper / theme picker, headings TOC, etc.) and adds Pilot-V2
 * specific injections that the rest of the app does not need:
 *
 *   1. Pilot-V2 blocks → `ExportNoteBlock[]` adapter (heading levels, bullets,
 *      numbered, checklist, quote, code, highlight all map cleanly).
 *   2. A "Block types" chip-row filter — toggle Headings / Bullets / Numbered /
 *      Checklist / Quote / Code / Paragraph / Highlight on/off in one tap.
 *   3. A "Choose blocks to export" tag-chip selector — every block becomes a
 *      chip you can flip on/off; "Select all" / "Select none" shortcuts. By
 *      default ALL blocks are included.
 *   4. Pencil-stroke pass-through — annotations are preserved as vectors via
 *      the engine's existing `hardnote` path when the user opts in.
 *   5. Forces the PDF-friendly defaults (pastel "Cyan / Mist / Cream" headings,
 *      handwriting-friendly font scale, plain paper).
 *
 * All three legacy export buttons in Pilot V2 (Editor → More menu → PDF /
 * Image / Markdown, GlanceView → Upload icon, the unused PilotV2ExportSheet)
 * are routed through this single component.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { UnifiedExportSheet } from '../export/UnifiedExportSheet';
import {
  ExportNoteBlock,
  ExportPayload,
  ExportOptions,
} from '../../lib/unifiedExportEngine';
import { PilotV2Block, PilotV2BlockType, PilotV2PencilStroke } from './types';
import { useTheme } from '../../context/ThemeContext';
import { assignLegacyAnchors } from './pilotV2Migration';
import { blocksToBaseLayerMarkdown } from './pilotV2BlocksToMarkdown';
import {
  estimateExportBlockLayouts,
  remapStrokesForExport,
} from '../../lib/pilotV2StrokeRemap';

// ---------- Block-type chip catalogue ------------------------------------

const BLOCK_TYPE_CHIPS: Array<{ id: PilotV2BlockType; label: string }> = [
  { id: 'heading',   label: 'Headings' },
  { id: 'paragraph', label: 'Paragraph' },
  { id: 'bullet',    label: 'Bullets' },
  { id: 'numbered',  label: 'Numbered' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'quote',     label: 'Quotes' },
  { id: 'highlight', label: 'Highlights' },
  { id: 'code',      label: 'Code' },
];

// ---------- Pilot V2 → ExportNoteBlock adapter ---------------------------

const BLOCK_PASTEL_BY_TYPE: Record<PilotV2BlockType, string> = {
  heading:   '#6A5BFF20',
  paragraph: '#f3f4f6',
  bullet:    '#4FC3F720',
  numbered:  '#FFB74D20',
  checklist: '#81C78420',
  quote:     '#FF6A8820',
  highlight: '#FDE68A60',
  code:      '#0b0f1710',
};

const blockToText = (b: PilotV2Block): string => {
  if (b.type === 'checklist') return `${b.checked ? '☑' : '☐'}  ${b.text || ''}`.trim();
  if (b.type === 'numbered')  return `1. ${b.text || ''}`.trim();
  if (b.type === 'bullet')    return `• ${b.text || ''}`.trim();
  if (b.type === 'quote')     return `❝ ${b.text || ''} ❞`.trim();
  if (b.type === 'code')      return b.text || '';
  return (b.text || '').trim();
};

const adaptToExportNoteBlocks = (blocks: PilotV2Block[]): ExportNoteBlock[] => {
  return blocks.map((b) => {
    const baseText = blockToText(b);
    if (b.type === 'heading') {
      return {
        id: b.id,
        type: 'microTopicHeading',
        text: baseText || 'Untitled section',
      };
    }
    if (b.type === 'checklist') {
      return {
        id: b.id,
        type: 'checklist',
        text: b.text || '',
        checked: !!b.checked,
        color: BLOCK_PASTEL_BY_TYPE[b.type],
      };
    }
    if (b.type === 'highlight') {
      return {
        id: b.id,
        type: 'highlight',
        text: baseText,
        color: b.highlightColor || BLOCK_PASTEL_BY_TYPE.highlight,
      };
    }
    return {
      id: b.id,
      type: 'point',
      text: baseText,
      color: BLOCK_PASTEL_BY_TYPE[b.type] ?? '#f3f4f6',
    };
  });
};

// ---------- Component ----------------------------------------------------

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Document title — also seeds export title input. */
  title: string;
  /** Pilot V2 source blocks (will be adapted + filtered by chips/selection). */
  blocks: PilotV2Block[];
  /** Pilot V2 pencil strokes captured on top of the page (Step 18). */
  strokes?: PilotV2PencilStroke[];
  /** Editor page width in CSS pixels (used for stroke remap). */
  pageWidth?: number;
  /** Editor page height in CSS pixels (used for stroke remap). */
  pageHeight?: number;
}

export const PilotV2UnifiedExport: React.FC<Props> = ({
  visible,
  onClose,
  title,
  blocks,
  strokes = [],
  pageWidth = 0,
  pageHeight = 0,
}) => {
  // Block-type filter — all on by default
  const [activeTypes, setActiveTypes] = useState<Record<PilotV2BlockType, boolean>>(
    () => BLOCK_TYPE_CHIPS.reduce((acc, c) => { acc[c.id] = true; return acc; },
      {} as Record<PilotV2BlockType, boolean>),
  );

  // Per-block selection — all selected by default
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(
    () => new Set(blocks.map((b) => b.id)),
  );

  // Step 18 — toggle for "Include pencil annotations". Default ON when there
  // is at least one stroke captured on this page.
  const hasStrokes = strokes.length > 0;
  const [includeAnnotations, setIncludeAnnotations] = useState<boolean>(hasStrokes);

  // Re-seed when sheet opens or blocks change
  useEffect(() => {
    if (!visible) return;
    setActiveTypes(BLOCK_TYPE_CHIPS.reduce((acc, c) => { acc[c.id] = true; return acc; },
      {} as Record<PilotV2BlockType, boolean>));
    setSelectedBlockIds(new Set(blocks.map((b) => b.id)));
    setIncludeAnnotations(hasStrokes);
  }, [visible, blocks, hasStrokes]);

  // Filter blocks → adapted ExportNoteBlock[] for the engine
  const filteredBlocks = useMemo(
    () => blocks.filter((b) => activeTypes[b.type] && selectedBlockIds.has(b.id)),
    [blocks, activeTypes, selectedBlockIds],
  );

  // Step 19 — re-anchor any legacy unanchored strokes against the CURRENT
  // (full) block list (not the filtered one — we need the original order +
  // ids to back-fill correctly), then drop strokes whose anchor block was
  // filtered out by chip / per-block selection.
  const survivingStrokes = useMemo(() => {
    if (!includeAnnotations || !strokes.length) return [];
    const reAnchored = assignLegacyAnchors(strokes, blocks);
    const survivingIds = new Set(filteredBlocks.map((b) => b.id));
    return reAnchored.filter((s) => {
      const anchorId = s.anchor?.elementId ?? s.anchor?.blockId;
      // Strokes WITHOUT an anchor (e.g., free washi-tape canvas drawings) are
      // page-level — they have no host block, so they survive unconditionally.
      if (!anchorId) return true;
      return survivingIds.has(anchorId);
    });
  }, [includeAnnotations, strokes, blocks, filteredBlocks]);

  // Page dims used for hardnote canvas (Step 21).  Fall back to A4 @ 96dpi
  // when the parent did not pass paperSize (e.g., very early mount).
  const exportCanvasWidth  = pageWidth  > 1 ? pageWidth  : 794;
  const exportCanvasHeight = pageHeight > 1 ? pageHeight : 1123;
  const editorCanvasWidth  = pageWidth  > 1 ? pageWidth  : exportCanvasWidth;
  const editorCanvasHeight = pageHeight > 1 ? pageHeight : exportCanvasHeight;

  // Pilot V2 sensible defaults — pastel cyan headings, plain paper, PDF.
  // Declared BEFORE the payload memo so the layout estimator can read the
  // engine-default font-size + columns without TDZ issues.
  const initialOptions: Partial<ExportOptions> = useMemo(() => ({
    title,
    moduleName: 'Pilot V2',
    headerText: 'Pilot V2 · Notes',
    footerText: title,
    theme: 'modern',
    paperStyle: 'plain',
    fontFamily: 'sans',
    fontSize: 11,
    notesSubheadingColor: '#4FC3F720',
    notesChecklistMode: false,
    showTOC: false,
  }), [title]);

  // Step 21 — hybrid payload.  When the toggle is ON and at least one
  // surviving stroke exists, switch to the engine's `hardnote` path so the
  // strokes are pre-rendered as SVG vectors anchored to their host block's
  // re-projected bounding box.  Otherwise, keep the simple `notes` path.
  const payload: ExportPayload = useMemo(() => {
    if (includeAnnotations && survivingStrokes.length > 0) {
      // Estimate where each surviving block lands inside the export canvas
      // using the engine defaults (see `defaultExportOptions`).  Anchored
      // strokes then re-project onto these layouts so font / theme / paper
      // changes never desync them from their host word/line.
      const layouts = estimateExportBlockLayouts(filteredBlocks, {
        canvasWidth:  exportCanvasWidth,
        canvasHeight: exportCanvasHeight,
        fontSize:     initialOptions.fontSize ?? 11,
        columns:      initialOptions.columns  ?? 1,
      });
      const exportStrokes = remapStrokesForExport(survivingStrokes, {
        layouts,
        exportCanvasWidth,
        exportCanvasHeight,
        editorCanvasWidth,
        editorCanvasHeight,
      });
      return {
        kind: 'hardnote',
        note: {
          title,
          baseLayerMarkdown: blocksToBaseLayerMarkdown(filteredBlocks),
          strokes: exportStrokes,
          canvasWidth:  exportCanvasWidth,
          canvasHeight: exportCanvasHeight,
        },
      };
    }
    return {
      kind: 'notes',
      blocks: adaptToExportNoteBlocks(filteredBlocks),
    };
  }, [
    includeAnnotations, survivingStrokes, filteredBlocks, title,
    exportCanvasWidth, exportCanvasHeight, editorCanvasWidth, editorCanvasHeight,
    initialOptions,
  ]);

  return (
    <UnifiedExportSheet
      visible={visible}
      onClose={onClose}
      payload={payload}
      title={title || 'Pilot V2 Export'}
      initialOptions={initialOptions}
      hideSections={['content', 'answer', 'sort']}
      renderExtraFilters={() => (
        <PilotV2ExtraFilters
          blocks={blocks}
          activeTypes={activeTypes}
          setActiveTypes={setActiveTypes}
          selectedBlockIds={selectedBlockIds}
          setSelectedBlockIds={setSelectedBlockIds}
          hasStrokes={hasStrokes}
          includeAnnotations={includeAnnotations}
          setIncludeAnnotations={setIncludeAnnotations}
        />
      )}
    />
  );
};

// ---------- Filter UI ----------------------------------------------------

interface ExtraProps {
  blocks: PilotV2Block[];
  activeTypes: Record<PilotV2BlockType, boolean>;
  setActiveTypes: React.Dispatch<React.SetStateAction<Record<PilotV2BlockType, boolean>>>;
  selectedBlockIds: Set<string>;
  setSelectedBlockIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  hasStrokes: boolean;
  includeAnnotations: boolean;
  setIncludeAnnotations: React.Dispatch<React.SetStateAction<boolean>>;
}

const PilotV2ExtraFilters: React.FC<ExtraProps> = ({
  blocks,
  activeTypes,
  setActiveTypes,
  selectedBlockIds,
  setSelectedBlockIds,
  hasStrokes,
  includeAnnotations,
  setIncludeAnnotations,
}) => {
  const { colors } = useTheme();

  // Friendly "block summary" — first 32 chars of text (or fallback label)
  const summarize = (b: PilotV2Block): string => {
    const t = (b.text || '').trim().replace(/\s+/g, ' ');
    if (t) return t.length > 32 ? `${t.slice(0, 32)}…` : t;
    if (b.imageBase64 || b.imageUri) return '[Image]';
    if (b.attachment?.name) return `📎 ${b.attachment.name}`;
    if (b.tableRows?.length) return '[Table]';
    return `[${b.type}]`;
  };

  const allSelected = selectedBlockIds.size === blocks.length;

  return (
    <View style={{ marginTop: 6 }}>
      {/* ── Pencil annotations toggle (Step 18) ──────────────────────── */}
      {hasStrokes ? (
        <View
          testID="pilot-v2-export-include-strokes-row"
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1,
            backgroundColor: colors.surfaceStrong, borderColor: colors.border,
            marginBottom: 12,
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800' }}>
              Include pencil annotations
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2 }}>
              Underlines, highlights & free strokes follow the words they were drawn on.
            </Text>
          </View>
          <Switch
            testID="pilot-v2-export-include-strokes"
            value={includeAnnotations}
            onValueChange={setIncludeAnnotations}
            trackColor={{ false: colors.border, true: colors.primary + '88' }}
            thumbColor={includeAnnotations ? colors.primary : '#fff'}
          />
        </View>
      ) : null}

      {/* ── Block-type chips ─────────────────────────────────────────── */}
      <Text
        style={{
          fontSize: 10, fontWeight: '900', color: colors.textTertiary,
          letterSpacing: 1.2, marginTop: 6, marginBottom: 8, textTransform: 'uppercase',
        }}
        testID="pilot-v2-export-types-label"
      >
        Block Types
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {BLOCK_TYPE_CHIPS.map((c) => {
          const active = !!activeTypes[c.id];
          return (
            <TouchableOpacity
              key={`pv2-type-${c.id}`}
              testID={`pilot-v2-export-type-${c.id}`}
              onPress={() => setActiveTypes((p) => ({ ...p, [c.id]: !p[c.id] }))}
              style={{
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
                backgroundColor: active ? colors.primary : colors.surfaceStrong,
                borderColor: active ? colors.primary : colors.border,
              }}
            >
              <Text
                style={{
                  color: active ? '#fff' : colors.textPrimary,
                  fontWeight: active ? '900' : '700', fontSize: 12.5,
                }}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Per-block selection chips ────────────────────────────────── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <Text
          style={{
            fontSize: 10, fontWeight: '900', color: colors.textTertiary,
            letterSpacing: 1.2, textTransform: 'uppercase',
          }}
          testID="pilot-v2-export-blocks-label"
        >
          Choose Blocks To Export
        </Text>
        <TouchableOpacity
          testID="pilot-v2-export-blocks-toggle-all"
          onPress={() => {
            if (allSelected) setSelectedBlockIds(new Set());
            else setSelectedBlockIds(new Set(blocks.map((b) => b.id)));
          }}
          style={{
            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
            backgroundColor: colors.primary + '14',
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800' }}>
            {allSelected ? 'DESELECT ALL' : 'SELECT ALL'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingTop: 10, paddingBottom: 4 }}
      >
        {blocks.length === 0 ? (
          <Text style={{ color: colors.textTertiary, fontSize: 12, fontStyle: 'italic' }}>
            No blocks in this note yet.
          </Text>
        ) : (
          blocks.map((b) => {
            const active = selectedBlockIds.has(b.id);
            return (
              <TouchableOpacity
                key={`pv2-block-${b.id}`}
                testID={`pilot-v2-export-block-${b.id}`}
                onPress={() => setSelectedBlockIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(b.id)) next.delete(b.id);
                  else next.add(b.id);
                  return next;
                })}
                style={{
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1,
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: active ? colors.primary + '14' : colors.surfaceStrong,
                  borderColor: active ? colors.primary : colors.border,
                  maxWidth: 220,
                }}
              >
                <View
                  style={{
                    width: 16, height: 16, borderRadius: 5, borderWidth: 1.5,
                    alignItems: 'center', justifyContent: 'center',
                    borderColor: active ? colors.primary : colors.textTertiary,
                    backgroundColor: active ? colors.primary : 'transparent',
                  }}
                >
                  {active ? <Check size={11} color="#fff" /> : null}
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    color: active ? colors.primary : colors.textPrimary,
                    fontWeight: '700', fontSize: 12, flexShrink: 1,
                  }}
                >
                  {summarize(b)}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

export default PilotV2UnifiedExport;
