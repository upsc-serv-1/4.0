/**
 * Pilot V2 ΓÇö Active Recall Washi-Tape System (Item 11)
 * ----------------------------------------------------
 * Premium paper-tape masking tool inspired by Notability / Goodnotes /
 * Japanese stationery aesthetics. Lets users place soft pastel "tape"
 * over text or pencil strokes to hide content for active-recall revision,
 * then tap to reveal (translucent + slight blur).
 *
 * Tapes are stored in `note.content.washiTapes` (relative 0..1 coords just
 * like pencil strokes) so they survive zoom / pan / device changes.
 *
 * The tape is rendered as a `View` *above* the pencil canvas but *below*
 * the toolbar, so it visually masks both text blocks and pencil strokes
 * while staying user-interactive (tap to toggle reveal state).
 */
import { PilotV2NoteContent } from './types';

/** Pastel washi-tape color palette (soft matte, no glossy/neon). */
export const WASHI_TAPE_COLORS = [
  { name: 'Yellow',  bg: '#FFE88A', edge: '#F7E27C' },
  { name: 'Yellow2', bg: '#F7E27C', edge: '#EBD269' },
  { name: 'Green',   bg: '#BEECC4', edge: '#A8DDB0' },
  { name: 'Green2',  bg: '#C8F2D0', edge: '#B0E1B7' },
  { name: 'Blue',    bg: '#B7DCFF', edge: '#A0CDF6' },
  { name: 'Blue2',   bg: '#C8E6FF', edge: '#A8D4F4' },
  { name: 'Pink',    bg: '#FFD1DC', edge: '#F2BBC9' },
  { name: 'Pink2',   bg: '#FFC7D1', edge: '#EFAFBA' },
  { name: 'Gray',    bg: '#D9D9D9', edge: '#C2C2C2' },
  { name: 'Gray2',   bg: '#E6E6E6', edge: '#CFCFCF' },
] as const;

export type WashiTapeColor = typeof WASHI_TAPE_COLORS[number]['name'];

export interface PilotV2WashiTape {
  id: string;
  /** Relative 0..1 coordinates inside the page bounds. */
  x: number;
  y: number;
  w: number;
  h: number;
  color: WashiTapeColor;
  /** Persisted reveal state ΓÇö when true, content under the tape is shown
   *  with a translucent blur so it remains readable. */
  revealed: boolean;
  /** Optional rotation in degrees (handmade-paper feel). */
  rotation?: number;
  createdAt: string;
}

const newId = () => `pv2_tape_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

/** Add a new tape at the given relative-rect. */
export function createWashiTape(
  x: number, y: number, w: number, h: number,
  color: WashiTapeColor = 'Yellow',
): PilotV2WashiTape {
  return {
    id: newId(),
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    w: Math.max(0.02, Math.min(1, w)),
    h: Math.max(0.02, Math.min(1, h)),
    color,
    revealed: false,
    rotation: (Math.random() - 0.5) * 4, // ┬▒2┬░ handmade tilt
    createdAt: new Date().toISOString(),
  };
}

/** Toggle reveal state for a single tape. */
export function toggleWashiReveal(
  tapes: PilotV2WashiTape[],
  tapeId: string,
): PilotV2WashiTape[] {
  return tapes.map((t) => t.id === tapeId ? { ...t, revealed: !t.revealed } : t);
}

/** Show all / hide all controls. */
export function setAllRevealed(
  tapes: PilotV2WashiTape[],
  revealed: boolean,
): PilotV2WashiTape[] {
  return tapes.map((t) => ({ ...t, revealed }));
}

/** Remove a tape entirely. */
export function removeWashiTape(
  tapes: PilotV2WashiTape[],
  tapeId: string,
): PilotV2WashiTape[] {
  return tapes.filter((t) => t.id !== tapeId);
}

/** Hex color helper used by the renderer. */
export function washiBg(name: WashiTapeColor): string {
  return WASHI_TAPE_COLORS.find((c) => c.name === name)?.bg ?? '#FFE88A';
}
export function washiEdge(name: WashiTapeColor): string {
  return WASHI_TAPE_COLORS.find((c) => c.name === name)?.edge ?? '#F7E27C';
}

/** Type augmentation ΓÇö add `washiTapes` to PilotV2NoteContent. */
declare module './types' {
  interface PilotV2NoteContent {
    washiTapes?: PilotV2WashiTape[];
  }
}
export type { PilotV2NoteContent };
