/**
 * Capsule Tab — type definitions
 *
 * Hierarchy: Subject -> Topic -> Subtopic -> Notebook
 *
 * Notebooks contain block-based content (CapsuleBlock[]) so we can append from
 * the Quiz Engine / Add-to-Notebook flow without breaking formatting.
 */

export type CapsuleNodeType = 'subject' | 'topic' | 'subtopic' | 'notebook';

export interface CapsuleNode {
  id: string;
  user_id: string;
  parent_id: string | null;
  type: CapsuleNodeType;
  title: string;
  /** Linked user_notes row (only for type === 'notebook'). */
  note_id: string | null;
  is_pinned?: boolean;
  is_archived?: boolean;
  color?: string | null;
  icon?: string | null;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export type CapsuleBlockType =
  | 'heading'
  | 'paragraph'
  | 'bullet'
  | 'numbered'
  | 'checklist'
  | 'highlight'
  | 'quote'
  | 'attachment'
  | 'ai'
  | 'voice';

export interface CapsuleBlock {
  id: string;
  type: CapsuleBlockType;
  text: string;
  /** Optional formatting hints. */
  level?: 1 | 2 | 3;
  checked?: boolean;
  highlightColor?: string;
  /** Free-form metadata: source attribution, AI prompt, etc. */
  meta?: Record<string, any>;
  created_at?: string;
}

export interface CapsuleHighlight {
  id: string;
  block_id: string;
  start: number;
  end: number;
  color: string;
  note?: string;
  created_at?: string;
}

export interface CapsuleNotebookContent {
  blocks: CapsuleBlock[];
  highlights?: CapsuleHighlight[];
  version?: number;
}

/** Helper subject palette — kept in sync with the bible/screenshots. */
export const CAPSULE_SUBJECT_PALETTE: Record<string, string> = {
  Polity:        '#7F77DD',
  Economy:       '#FF9500',
  History:       '#D1654B',
  Geography:     '#4CAF50',
  Ethics:        '#5B7ADB',
  Environment:   '#52A884',
  'Science & Tech': '#F5A623',
  default:       '#7F77DD',
};

export const CAPSULE_SURFACE_KEY = 'capsule';
