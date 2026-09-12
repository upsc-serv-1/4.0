/**
 * Parse AI responses for flashcard format
 * Expected format: "front - [content] - back - [content] -"
 */

export interface ParsedFlashcard {
  front: string;
  back: string;
}

/**
 * Parse flashcard response from AI
 * Handles multiple format variations with fallback patterns
 */
export function parseFlashcardResponse(response: string): ParsedFlashcard | null {
  if (!response || typeof response !== 'string') {
    return null;
  }

  const trimmed = response.trim();

  // Pattern 1: Standard format with "front - ... - back - ... -"
  // This is case-insensitive and handles variations of dashes (-, –, —)
  const pattern1 = /front\s*[-–—]\s*([\s\S]*?)\s*[-–—]\s*back\s*[-–—]\s*([\s\S]*?)\s*[-–—]\s*$/i;
  const match1 = trimmed.match(pattern1);

  if (match1) {
    const front = match1[1].trim();
    const back = match1[2].trim();
    
    if (front && back) {
      return { front, back };
    }
  }

  // Pattern 2: "FRONT: [content] BACK: [content]"
  const pattern2 = /front:\s*([\s\S]*?)\s+back:\s*([\s\S]*?)$/i;
  const match2 = trimmed.match(pattern2);

  if (match2) {
    const front = match2[1].trim();
    const back = match2[2].trim();
    
    if (front && back) {
      return { front, back };
    }
  }

  // Pattern 3: "Front: [content] Back: [content]"
  const pattern3 = /Front:\s*([\s\S]*?)\s+Back:\s*([\s\S]*?)$/;
  const match3 = trimmed.match(pattern3);

  if (match3) {
    const front = match3[1].trim();
    const back = match3[2].trim();
    
    if (front && back) {
      return { front, back };
    }
  }

  // Pattern 4: Simple split on first " - " (fallback)
  // This handles: "Question here - Answer here"
  if (trimmed.includes(' - ')) {
    const parts = trimmed.split(' - ');
    if (parts.length >= 2) {
      const front = parts[0].trim();
      const back = parts.slice(1).join(' - ').trim();
      
      if (front && back) {
        return { front, back };
      }
    }
  }

  // Pattern 5: Split on newline followed by dash
  // Handles multiline format: "Question\n- Answer"
  if (trimmed.includes('\n-') || trimmed.includes('\n –')) {
    const parts = trimmed.split(/\n\s*[-–—]\s*/);
    if (parts.length >= 2) {
      const front = parts[0].trim();
      const back = parts.slice(1).join('\n').trim();
      
      if (front && back) {
        return { front, back };
      }
    }
  }

  // If nothing matched, return null to indicate parse failure
  return null;
}

/**
 * Validate flashcard content
 */
export interface FlashcardValidation {
  valid: boolean;
  frontLength: number;
  backLength: number;
  frontTooLong: boolean;
  backTooLong: boolean;
  frontEmpty: boolean;
  backEmpty: boolean;
}

export function validateFlashcard(
  front: string,
  back: string,
  maxFrontLength: number = 500,
  maxBackLength: number = 1000
): FlashcardValidation {
  const frontLength = front.trim().length;
  const backLength = back.trim().length;

  return {
    valid:
      frontLength > 0 &&
      backLength > 0 &&
      frontLength <= maxFrontLength &&
      backLength <= maxBackLength,
    frontLength,
    backLength,
    frontTooLong: frontLength > maxFrontLength,
    backTooLong: backLength > maxBackLength,
    frontEmpty: frontLength === 0,
    backEmpty: backLength === 0,
  };
}

/**
 * Sanitize flashcard content
 * Removes extra whitespace, normalizes newlines
 */
export function sanitizeFlashcardContent(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .replace(/^\s+|\s+$/gm, ''); // Trim each line
}
