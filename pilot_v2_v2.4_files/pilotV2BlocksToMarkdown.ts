/**
 * pilotV2BlocksToMarkdown (re-introduced for Step 21)
 * ----------------------------------------------------
 * Adapter that turns a list of Pilot V2 flat blocks into a single Markdown
 * string suitable for `ExportHardnote.baseLayerMarkdown`.  This was the
 * inline `blocksToBaseLayerMarkdown` function inside the now-deleted
 * `pilotV2Export.ts`; it has been split out as a standalone module so the
 * unified export entry-point can keep using it without re-introducing the
 * legacy export sheet.
 *
 * The output mirrors common Markdown conventions:
 *   ΓÇó headings ΓåÆ `#` / `##` / `###`
 *   ΓÇó bullets  ΓåÆ `* `
 *   ΓÇó numbered ΓåÆ `1. `
 *   ΓÇó checklist ΓåÆ `- [x] ` / `- [ ] `
 *   ΓÇó quote    ΓåÆ `> `
 *   ΓÇó code     ΓåÆ fenced ```` ``` ```` block
 *   ΓÇó highlight ΓåÆ `==text==` (rendered as <mark> by `renderInline`)
 *   ΓÇó inline marks: `**bold**`, `*italic*`, `__underline__` (renderInline
 *     handles these via simple regex replacements).
 */
import { PilotV2Block } from './types';

export function blocksToBaseLayerMarkdown(blocks: PilotV2Block[]): string {
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
}
