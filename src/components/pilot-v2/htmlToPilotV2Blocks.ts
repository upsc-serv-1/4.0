/**
 * HTML → Pilot V2 Blocks converter.
 * Preserves line breaks, bullets, numbering, and headings when saving
 * rich HTML content into Pilot V2 notes.
 */
import { PilotV2Block } from './types';

const newId = () =>
  (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID()
    : `pv2_b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export function htmlToPilotV2Blocks(html: string): PilotV2Block[] {
  const trimmed = (html || '').trim();
  if (!trimmed) return [];

  const hasHtml = /<[a-z][\s\S]*>/i.test(trimmed);
  if (!hasHtml) return textToBlocks(trimmed);

  const blocks: PilotV2Block[] = [];

  // Normalize <br> → paragraph separators
  let processed = trimmed
    .replace(/<p[^>]*>/gi, '<p>')
    .replace(/<\/p>/gi, '</p>')
    .replace(/<p>([^<]*?)<br\s*\/?>([^<]*?)<\/p>/gi, '<p>$1</p><p>$2</p>')
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '</p><p>')
    .replace(/<br\s*\/?>/gi, '</p><p>');

  // Extract headings
  processed = processed.replace(/<h([1-3])[^>]*>(.*?)<\/h\1>/gis, (_: any, level: string, content: string) => {
    const clean = content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (clean) blocks.push({ id: newId(), type: 'heading', level: parseInt(level) as 1 | 2 | 3, text: clean });
    return '';
  });

  // Extract list items with context awareness (ordered vs unordered)
  const liRegex = /<li[^>]*>(.*?)<\/li>/gis;
  let liMatch;
  const liMatches: Array<{ text: string; index: number }> = [];
  while ((liMatch = liRegex.exec(processed)) !== null) {
    const clean = liMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (clean) liMatches.push({ text: clean, index: liMatch.index });
  }

  for (let i = 0; i < liMatches.length; i++) {
    const { text: clean, index } = liMatches[i];
    const before = processed.substring(Math.max(0, index - 20), index).toLowerCase();
    blocks.push({ id: newId(), type: before.includes('<ol') ? 'numbered' : 'bullet', text: clean });
  }

  // Remove already-processed list items
  let noList = processed.replace(/<li[^>]*>.*?<\/li>/gis, '');
  noList = noList.replace(/<[uo]l[^>]*>/gi, '').replace(/<\/[uo]l>/gi, '');

  // Extract standalone paragraphs
  const pRegex = /<p[^>]*>(.*?)<\/p>/gis;
  let pMatch;
  while ((pMatch = pRegex.exec(noList)) !== null) {
    const clean = pMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    blocks.push({ id: newId(), type: 'paragraph', text: clean });
  }

  // Fallback: if nothing extracted, treat as plain text
  if (blocks.length === 0) {
    return textToBlocks(noList.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim());
  }

  return blocks;
}

function textToBlocks(text: string): PilotV2Block[] {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];

  const normalized = trimmed.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
  if (!normalized) return [];

  const lines = normalized.split(/\r?\n/);
  const blocks: PilotV2Block[] = [];
  for (const line of lines) {
    const cleanLine = line.trim();
    if (cleanLine.startsWith('# ')) {
      blocks.push({ id: newId(), type: 'heading', level: 1, text: cleanLine.slice(2).trim() });
    } else if (cleanLine.startsWith('## ')) {
      blocks.push({ id: newId(), type: 'heading', level: 2, text: cleanLine.slice(3).trim() });
    } else if (cleanLine.startsWith('- ') || cleanLine.startsWith('* ')) {
      blocks.push({ id: newId(), type: 'bullet', text: cleanLine.slice(2).trim() });
    } else if (/^\d+\.\s+/.test(cleanLine)) {
      blocks.push({ id: newId(), type: 'numbered', text: cleanLine.replace(/^\d+\.\s+/, '').trim() });
    } else {
      blocks.push({ id: newId(), type: 'paragraph', text: cleanLine });
    }
  }
  return blocks;
}