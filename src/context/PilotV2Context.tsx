/**
 * Pilot V2 — context + reducer
 *
 * Single source of truth for the Pilot V2 surface (notes list, current
 * selection, view-mode, sidebar state, loading/error). The reducer keeps the
 * state machine explicit so the seven screens (Sidebar Home / Sidebar Subject
 * / Dashboard / Note List / Glance / Editor / Empty) share one cohesive
 * navigation model.
 */
import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import {
  PilotV2Note,
  PilotV2Block,
  PILOT_V2_INITIAL_VIEW,
  PilotV2ViewState,
  PilotV2ViewMode,
} from '../components/pilot-v2/types';

interface PilotV2State {
  notes: PilotV2Note[];
  view: PilotV2ViewState;
  loading: boolean;
  error: string | null;
}

type PilotV2Action =
  | { type: 'SET_NOTES'; payload: PilotV2Note[] }
  | { type: 'UPSERT_NOTE'; payload: PilotV2Note }
  | { type: 'REMOVE_NOTE'; payload: string }
  | { type: 'SET_CURRENT_NOTE_ID'; payload: string | null }
  | { type: 'SET_VIEW_MODE'; payload: PilotV2ViewMode }
  | { type: 'SET_SELECTED_SUBJECT'; payload: string | null }
  | { type: 'SET_SELECTED_TOPIC'; payload: string | null }
  | { type: 'SET_SELECTED_SUBTOPIC'; payload: string | null }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR_COLLAPSED'; payload: boolean }
  | { type: 'NAVIGATE_HOME' }
  | { type: 'PATCH_CURRENT_NOTE'; payload: { id: string; patch: Partial<PilotV2Note> } }
  | { type: 'PATCH_BLOCKS'; payload: { id: string; blocks: PilotV2Block[] } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

const initialState: PilotV2State = {
  notes: [],
  view: PILOT_V2_INITIAL_VIEW,
  loading: false,
  error: null,
};

function reducer(state: PilotV2State, action: PilotV2Action): PilotV2State {
  switch (action.type) {
    case 'SET_NOTES':
      return { ...state, notes: action.payload };

    case 'UPSERT_NOTE': {
      const idx = state.notes.findIndex(n => n.id === action.payload.id);
      const next = idx === -1
        ? [action.payload, ...state.notes]
        : state.notes.map(n => (n.id === action.payload.id ? action.payload : n));
      return { ...state, notes: next };
    }

    case 'REMOVE_NOTE':
      return { ...state, notes: state.notes.filter(n => n.id !== action.payload) };

    case 'SET_CURRENT_NOTE_ID':
      return { ...state, view: { ...state.view, currentNoteId: action.payload } };

    case 'SET_VIEW_MODE':
      return { ...state, view: { ...state.view, mode: action.payload } };

    case 'SET_SELECTED_SUBJECT':
      return {
        ...state,
        view: {
          ...state.view,
          selectedSubject: action.payload,
          selectedTopic: null,
          selectedSubtopic: null,
        },
      };

    case 'SET_SELECTED_TOPIC':
      return {
        ...state,
        view: { ...state.view, selectedTopic: action.payload, selectedSubtopic: null },
      };

    case 'SET_SELECTED_SUBTOPIC':
      return { ...state, view: { ...state.view, selectedSubtopic: action.payload } };

    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        view: { ...state.view, sidebarCollapsed: !state.view.sidebarCollapsed },
      };

    case 'SET_SIDEBAR_COLLAPSED':
      return { ...state, view: { ...state.view, sidebarCollapsed: action.payload } };

    case 'NAVIGATE_HOME':
      return {
        ...state,
        view: {
          ...PILOT_V2_INITIAL_VIEW,
          sidebarCollapsed: state.view.sidebarCollapsed,
        },
      };

    case 'PATCH_CURRENT_NOTE': {
      const { id, patch } = action.payload;
      return {
        ...state,
        notes: state.notes.map(n => (n.id === id ? { ...n, ...patch } : n)),
      };
    }

    case 'PATCH_BLOCKS': {
      const { id, blocks } = action.payload;
      return {
        ...state,
        notes: state.notes.map(n =>
          n.id === id
            ? { ...n, content: { ...n.content, blocks }, updated_at: new Date().toISOString() }
            : n
        ),
      };
    }

    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    default:
      return state;
  }
}

interface PilotV2ContextValue {
  state: PilotV2State;
  dispatch: React.Dispatch<PilotV2Action>;
  /** Convenience selector: returns the currently focused note or null. */
  currentNote: () => PilotV2Note | null;
}

const PilotV2Context = createContext<PilotV2ContextValue | null>(null);

export function PilotV2Provider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const currentNote = () =>
    state.view.currentNoteId
      ? state.notes.find(n => n.id === state.view.currentNoteId) || null
      : null;

  return (
    <PilotV2Context.Provider value={{ state, dispatch, currentNote }}>
      {children}
    </PilotV2Context.Provider>
  );
}

export function usePilotV2(): PilotV2ContextValue {
  const ctx = useContext(PilotV2Context);
  if (!ctx) throw new Error('usePilotV2 must be used within <PilotV2Provider>');
  return ctx;
}

export type { PilotV2State };
