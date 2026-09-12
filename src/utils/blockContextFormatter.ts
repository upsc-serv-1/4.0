import { PilotV2Block } from '../components/pilot-v2/types';

export interface BlockContext {
  blocks: PilotV2Block[];
  mode: 'single' | 'multiple' | 'section' | 'all';
  noteTitle?: string;
  plainText: string;
  summary: string;
}

/**
 * Format selected blocks into context for AI operations
 */
export function formatBlockContext(
  selectedBlocks: PilotV2Block[],
  mode: 'single' | 'multiple' | 'section' | 'all',
  noteTitle = 'Note'
): BlockContext {
  const plainText = blocksToPlainText(selectedBlocks);
  const summary = generateContextSummary(selectedBlocks, mode, noteTitle);

  return {
    blocks: selectedBlocks,
    mode,
    noteTitle,
    plainText,
    summary,
  };
}

/**
 * Convert blocks to plain text with structure preserved
 */
export function blocksToPlainText(blocks: PilotV2Block[]): string {
  return blocks
    .map(block => {
      switch (block.type) {
        case 'heading':
          return `# ${block.text || ''}`;
        case 'paragraph':
          return block.text || '';
        case 'bullet':
          return `• ${block.text || ''}`;
        case 'numbered':
          return `${block.meta?.order || '1'}. ${block.text || ''}`;
        case 'quote':
          return `"${block.text || ''}"`;
        case 'code':
          return `\`\`\`\n${block.text || ''}\n\`\`\``;
        default:
          return block.text || '';
      }
    })
    .filter(line => line.trim())
    .join('\n\n');
}

/**
 * Generate AI-friendly context summary
 */
function generateContextSummary(
  blocks: PilotV2Block[],
  mode: 'single' | 'multiple' | 'section' | 'all',
  noteTitle: string
): string {
  const blockCount = blocks.length;
  const wordCount = blocks.reduce((sum, b) => sum + (b.text?.split(/\s+/).length || 0), 0);
  const typeBreakdown = blocks.reduce(
    (acc, b) => {
      acc[b.type] = (acc[b.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const typeStr = Object.entries(typeBreakdown)
    .map(([type, count]) => `${count} ${type}`)
    .join(', ');

  let modeStr = '';
  switch (mode) {
    case 'single':
      modeStr = 'single block selected';
      break;
    case 'multiple':
      modeStr = `${blockCount} specific blocks selected`;
      break;
    case 'section':
      modeStr = `entire section (${blockCount} blocks)`;
      break;
    case 'all':
      modeStr = `full note (${blockCount} blocks)`;
      break;
  }

  return `
CONTEXT METADATA:
- Note: "${noteTitle}"
- Context Mode: ${modeStr}
- Total Blocks: ${blockCount}
- Total Words: ~${wordCount}
- Block Types: ${typeStr}

CONTEXT CONTENT:
`;
}

/**
 * Create AI system prompt with context awareness
 */
export function createContextAwarePrompt(
  basePrompt: string,
  context: BlockContext,
  placeholder = '{{context}}'
): string {
  const contextSection = `${context.summary}${context.plainText}`;
  return basePrompt.replace(placeholder, contextSection);
}

/**
 * Validate block context before sending to AI
 */
export function validateBlockContext(context: BlockContext): { valid: boolean; error?: string } {
  if (!context.blocks || context.blocks.length === 0) {
    return { valid: false, error: 'No blocks selected' };
  }

  const wordCount = context.plainText.split(/\s+/).length;
  if (wordCount > 5000) {
    return {
      valid: false,
      error: `Context too large (${wordCount} words). Maximum is 5000. Please select fewer blocks.`,
    };
  }

  if (wordCount < 10) {
    return { valid: false, error: 'Context too small (< 10 words). Please select more content.' };
  }

  return { valid: true };
}

/**
 * Get context-aware AI system message
 */
export function getContextSystemMessage(context: BlockContext): string {
  return `You are an expert AI assistant helping with note analysis and content enhancement.

The user has provided context from "${context.noteTitle}" using a ${context.mode} block selection mode.

Context Information:
- Blocks: ${context.blocks.length}
- Mode: ${context.mode}
- Content length: ~${context.plainText.split(/\s+/).length} words

Always:
1. Reference the provided context when making suggestions
2. Preserve the original structure and formatting
3. Be specific to the selected blocks' content
4. Explain how your suggestions relate to the provided context`;
}
