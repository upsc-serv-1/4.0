import React from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';

/**
 * renderAIText
 * ─────────────────────────────────────────────────────────────────────────
 * Tiny inline-markdown renderer used wherever AI text is shown in the app
 * (AI Explain, Key Points, Best Answer, Modify-and-Save edit preview,
 *  Notebook bullets, Flashcard front/back, Hardnotes etc.).
 *
 * Why not full Markdown? — because:
 *   • react-native-markdown-display is already used for prose blocks but
 *     it cannot be embedded inline next to other components, swallows
 *     bullets oddly, and adds 80kb. For inline emphasis we only need three
 *     things:
 *
 *       **word**   → bold      (fontWeight 800)
 *       __word__   → underline  (textDecorationLine 'underline')
 *       *word*     → italic     (fontStyle 'italic')
 *
 *   • The AI prompts only emit those three. Bullets / line breaks are
 *     already plain text, so they pass through untouched.
 *
 * Apply this utility on every surface so the same `**foo**` from the AI
 * renders the same way everywhere — engine, flashcards, notebook etc.
 */

type Span = { text: string; bold: boolean; underline: boolean; italic: boolean };

// Single-pass tokenizer with bold > underline > italic precedence.
const tokenize = (input: string): Span[] => {
  const out: Span[] = [];
  let buf = '';
  let bold = false;
  let underline = false;
  let italic = false;
  let i = 0;

  const flush = () => {
    if (!buf) return;
    out.push({ text: buf, bold, underline, italic });
    buf = '';
  };

  while (i < input.length) {
    const two = input.slice(i, i + 2);
    const ch  = input[i];

    if (two === '**') { flush(); bold = !bold;  i += 2; continue; }
    if (two === '__') { flush(); underline = !underline; i += 2; continue; }
    // Single * is italic, BUT only when surrounded by non-space and not at
    // the start of a bullet line ("• " or "- " or "* "). We're forgiving:
    // we toggle italic on a bare `*` only when the next char is non-space
    // and not another asterisk, otherwise pass through as a bullet glyph.
    if (ch === '*') {
      const next = input[i + 1];
      const prev = input[i - 1];
      const opensItalic = !italic && next && next !== ' ' && next !== '*' && next !== '\n';
      const closesItalic =  italic && prev && prev !== ' ' && prev !== '*';
      if (opensItalic || closesItalic) { flush(); italic = !italic; i += 1; continue; }
    }
    buf += ch;
    i += 1;
  }
  flush();
  return out;
};

export const renderAIText = (
  text: string | null | undefined,
  baseStyle?: StyleProp<TextStyle>,
): React.ReactNode => {
  if (!text) return null;
  const spans = tokenize(String(text));
  return spans.map((s, idx) => {
    const style: TextStyle = {};
    if (s.bold)      style.fontWeight = '800';
    if (s.underline) style.textDecorationLine = 'underline';
    if (s.italic)    style.fontStyle = 'italic';
    return (
      <Text key={idx} style={[baseStyle, style]}>
        {s.text}
      </Text>
    );
  });
};

/**
 * For places that need real HTML (PDF export, notebook RichEditor, etc.):
 * convert the same markdown to an HTML string with <strong>, <u>, <em>.
 * Single source of truth so AI bold appears bold in every surface.
 */
export const renderAITextToHtml = (text: string | null | undefined): string => {
  if (!text) return '';
  return String(text)
    // bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // underline
    .replace(/__([^_]+)__/g, '<u>$1</u>')
    // italic (single * not followed by space and not at line start)
    .replace(/(^|[^*\n])\*([^\s*][^*\n]*?)\*(?!\*)/g, '$1<em>$2</em>');
};

export default renderAIText;
