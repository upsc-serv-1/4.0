/**
 * pilotV2Export — bridges Pilot V2 notes into the existing
 * `src/lib/unifiedExportEngine.ts` so PDF / Image / Markdown exports include
 * both the rich block content AND the page-level pencil annotations.
 */

import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform, Share as RNShare } from 'react-native';
import {
  exportToPdf,
  defaultExportOptions,
  ExportHardnote,
  ExportHardnoteStroke,
  buildHardnoteHtml,
} from '../../lib/unifiedExportEngine';
import { PilotV2Block, PilotV2PencilStroke } from './types';

interface ExportArgs {
  title: string;
  blocks: PilotV2Block[];
  strokes: PilotV2PencilStroke[];
  pageWidth: number;
  pageHeight: number;
  format: 'pdf' | 'image' | 'markdown';
}

const blocksToMarkdown = (blocks: PilotV2Block[]): string => {
  return blocks.map((b) => {
    const t = (b.text || '').trim();
    switch (b.type) {
      case 'heading': {
        const lvl = b.level ?? 2;
        return `${'#'.repeat(lvl)} ${t}`;
      }
      case 'bullet':    return `- ${t}`;
      case 'numbered':  return `1. ${t}`;
      case 'checklist': return `- [${b.checked ? 'x' : ' '}] ${t}`;
      case 'quote':     return `> ${t}`;
      case 'code':      return '```\n' + t + '\n```';
      case 'highlight': return `==${t}==`;
      default:          return t;
    }
  }).join('\n\n');
};

const blocksToBaseLayerMarkdown = (blocks: PilotV2Block[]): string => {
  return blocks.map((b) => {
    let text = (b.text || '').trim();
    if (b.bold)      text = `**${text}**`;
    if (b.italic)    text = `*${text}*`;
    if (b.underline) text = `__${text}__`;
    switch (b.type) {
      case 'heading': {
        const lvl = b.level ?? 2;
        return `${'#'.repeat(lvl)} ${text}`;
      }
      case 'bullet':    return `* ${text}`;
      case 'numbered':  return `1. ${text}`;
      case 'checklist': return `- [${b.checked ? 'x' : ' '}] ${text}`;
      case 'quote':     return `> ${text}`;
      case 'code':      return '```\n' + text + '\n```';
      case 'highlight': return `==${text}==`;
      default:          return text;
    }
  }).join('\n\n');
};

const toExportStrokes = (
  strokes: PilotV2PencilStroke[],
  pageWidth: number,
  pageHeight: number,
): ExportHardnoteStroke[] => {
  return strokes
    .filter((s) => s.tool !== 'lasso')
    .map((s) => ({
      id: s.id,
      tool: s.tool === 'lasso' ? 'pen' : (s.tool as 'pen' | 'highlighter' | 'eraser'),
      color: s.color,
      width: s.width,
      opacity: s.opacity,
      points: s.points.map((p) => ({
        x: Math.round(p.x * pageWidth * 100) / 100,
        y: Math.round(p.y * pageHeight * 100) / 100,
        p: p.pressure,
      })),
    }));
};

export async function exportPilotV2Note(args: ExportArgs): Promise<void> {
  const {
    title, blocks, strokes,
    pageWidth, pageHeight,
    format,
  } = args;

  if (format === 'markdown') {
    const md = blocksToMarkdown(blocks);
    const annotationsLine = strokes.length
      ? `\n\n---\n_${strokes.length} pencil annotation${strokes.length === 1 ? '' : 's'} preserved as vectors._`
      : '';
    const safeName = title.replace(/[^a-z0-9-_ ]/gi, '_').slice(0, 48) || 'pilot-v2-note';
    const dest = `${FileSystem.cacheDirectory}${safeName}.md`;
    await FileSystem.writeAsStringAsync(dest, `# ${title}\n\n${md}${annotationsLine}`);
    if (Platform.OS === 'web') {
      await RNShare.share({ title, message: `${title}\n\n${md}${annotationsLine}` });
    } else {
      Sharing.shareAsync(dest, { mimeType: 'text/markdown', dialogTitle: 'Share Markdown' })
        .catch(() => null);
    }
    return;
  }

  const hardnote: ExportHardnote = {
    title,
    baseLayerMarkdown: blocksToBaseLayerMarkdown(blocks),
    strokes: toExportStrokes(strokes, pageWidth, pageHeight),
    canvasWidth:  Math.max(1, Math.round(pageWidth)),
    canvasHeight: Math.max(1, Math.round(pageHeight)),
    updatedAt: new Date().toISOString(),
  };

  const options = defaultExportOptions({
    title,
    fontSize: 11,
    paperStyle: 'plain',
    theme: 'modern',
    headerText: 'Pilot V2 Notes',
  });

  if (format === 'pdf') {
    await exportToPdf({ kind: 'hardnote', note: hardnote }, options);
    return;
  }

  // image — fall through to PDF render & share
  const html = buildHardnoteHtml(hardnote, options);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Pilot V2 export' })
    .catch(() => null);
}
