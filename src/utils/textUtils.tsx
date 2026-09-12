import React from 'react';
import { Text } from 'react-native';

// Regex for Years: 
// 1. BC/AD/BCE/CE patterns (1-4 digits)
// 2. Standalone 3-4 digit numbers NOT followed by units (to avoid "100 questions")
// 3. MYA (Million Years Ago)
const YEAR_PATTERN = '(?:\\d{1,4}\\s*(?:BC|BCE|AD|CE)|\\d{3,4}(?!\\s*(?:questions?|marks?|items?|kg|km|m|cm|%|percent|min|sec|hours?|days?|weeks?|months?))|\\d+(?:\\.\\d+)?\\s*(?:mya|million years ago))';

// Case-insensitive regex for finding all matches in a string
const YEAR_REGEX = new RegExp(`\\b${YEAR_PATTERN}\\b`, 'gi');

// Case-insensitive regex for checking if a split part is exactly a year pattern
const STANDALONE_YEAR_REGEX = new RegExp(`^${YEAR_PATTERN}$`, 'i');

/**
 * Renders text with "Smart Detection" for years and optional search query highlighting.
 * Automatically identifies years (3-4 digits, BC/AD, MYA) and applies a heavier font weight.
 */
export const renderSmartText = (
  text: string, 
  colors: any, 
  query?: string, 
  baseStyle?: any
) => {
  if (!text) return null;

  // 2. Combine with Search Query if provided
  let combinedRegex: RegExp;
  if (query && query.trim()) {
    const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Combine both into a single capturing group for splitting
    combinedRegex = new RegExp(`(${escapedQuery}|\\b${YEAR_PATTERN}\\b)`, 'gi');
  } else {
    combinedRegex = new RegExp(`(\\b${YEAR_PATTERN}\\b)`, 'gi');
  }

  const parts = text.split(combinedRegex);
  const queryLower = query?.trim().toLowerCase();

  return (
    <Text style={baseStyle}>
      {parts.map((part, i) => {
        if (!part) return null;
        
        const partLower = part.toLowerCase();
        
        // Match Search Query (Highest priority)
        if (queryLower && partLower === queryLower) {
          return (
            <Text key={i} style={{ fontWeight: '900', color: colors.primaryDark || colors.primary }}>
              {part}
            </Text>
          );
        }
        
        // Match Year/MYA
        if (STANDALONE_YEAR_REGEX.test(part)) {
          return (
            <Text key={i} style={{ fontWeight: '800', color: colors.textPrimary }}>
              {part}
            </Text>
          );
        }
        
        // Normal text
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
};

/**
 * Pre-processes markdown text to bold years so they stand out when rendered by a Markdown component.
 */
export const boldYearsMarkdown = (text: string) => {
  if (!text) return "";
  // Avoid double-bolding if already surrounded by ** or __
  return text.replace(YEAR_REGEX, (match, offset, fullText) => {
    const before = fullText.slice(Math.max(0, offset - 2), offset);
    const after = fullText.slice(offset + match.length, offset + match.length + 2);
    if ((before === '**' && after === '**') || (before === '__' && after === '__')) {
      return match;
    }
    return `**${match}**`;
  });
};

/**
 * Markdown → HTML converter for Notebook editor.
 * The RichNoteEditor (react-native-pell-rich-editor) renders HTML, not markdown.
 * When AI explanations (markdown) are copied to the Notebook, we must convert first.
 */
export function markdownToHtml(text: string): string {
  // Already HTML — normalise newlines only
  if (/^\s*<(p|div|ul|ol|h[1-6]|table|blockquote)/i.test(text.trim())) {
    return text.replace(/\n/g, '<br/>');
  }

  // Handle GFM tables: | col | col | → <table>
  const lines = text.split('\n');
  const htmlLines: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Detect table: starts with |, has |, separator row is next line
    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\s*\|[\s\-|:]+\|\s*$/.test(lines[i + 1])) {
      const headers = line.split('|').filter(c => c.trim()).map(c => `<th style="padding:4px 8px;border:1px solid #d1d5db;background:#f3f4f6"><div style="page-break-inside:avoid;break-inside:avoid;height:100%;width:100%">${c.trim()}</div></th>`);
      htmlLines.push(`<table style="border-collapse:collapse;width:100%;margin:8px 0"><thead><tr>${headers.join('')}</tr></thead><tbody>`);
      i += 2; // skip separator
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].split('|').filter(c => c.trim()).map(c => `<td style="padding:4px 8px;border:1px solid #d1d5db"><div style="page-break-inside:avoid;break-inside:avoid;height:100%;width:100%">${c.trim()}</div></td>`);
        htmlLines.push(`<tr>${cells.join('')}</tr>`);
        i++;
      }
      htmlLines.push('</tbody></table>');
      continue;
    }
    htmlLines.push(line);
    i++;
  }

  let html = htmlLines.join('\n')
    // Headings
    .replace(/^### (.+)$/gm, '<h3 style="margin:6px 0;font-size:15px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="margin:8px 0;font-size:17px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="margin:10px 0;font-size:19px">$1</h1>')
    // Bold + underline (AI convention: __term__)
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/__(.*?)__/g, '<u>$1</u>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>')
    // Bullet lists
    .replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)(\n(?!<li>)|$)/g, '<ul style="padding-left:18px;margin:4px 0">$1</ul>')
    // Numbered lists
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)(\n(?!<li>)|$)/g, '<ol style="padding-left:18px;margin:4px 0">$1</ol>')
    // Newlines
    .replace(/\n/g, '<br/>');

  return html;
}
