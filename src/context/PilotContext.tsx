import React, { createContext, useContext, useReducer, ReactNode } from 'react';

// ============ TYPES ============

export interface PilotBlock {
  id: string;
  type: 'paragraph' | 'heading' | 'bullet' | 'numbered' | 'checklist' | 'quote' | 'highlight';
  text: string;
  level?: number;
  checked?: boolean;
  highlightColor?: string;
}

export interface PilotNote {
  id: string;
  title: string;
  subject: string;
  topic: string;
  subtopic: string;
  content: {
    blocks: PilotBlock[];
  };
  created_at: string;
  updated_at: string;
}

export interface PilotState {
  notes: PilotNote[];
  currentNote: PilotNote | null;
  viewMode: 'dashboard' | 'noteList' | 'glance' | 'editor';
  selectedSubject: string | null;
  selectedTopic: string | null;
  selectedSubtopic: string | null;
  sidebarCollapsed: boolean;
  loading: boolean;
  error: string | null;
}

// ============ ACTIONS ============

export type PilotAction =
  | { type: 'SET_NOTES'; payload: PilotNote[] }
  | { type: 'SET_CURRENT_NOTE'; payload: PilotNote | null }
  | { type: 'SET_VIEW_MODE'; payload: PilotState['viewMode'] }
  | { type: 'SET_SELECTED_SUBJECT'; payload: string | null }
  | { type: 'SET_SELECTED_TOPIC'; payload: string | null }
  | { type: 'SET_SELECTED_SUBTOPIC'; payload: string | null }
  | { type: 'SET_SIDEBAR_COLLAPSED'; payload: boolean }
  | { type: 'UPDATE_CURRENT_NOTE'; payload: Partial<PilotNote> }
  | { type: 'UPDATE_NOTE'; payload: Partial<PilotNote> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' };

// ============ REDUCER ============

const initialState: PilotState = {
  notes: [],
  currentNote: null,
  viewMode: 'dashboard',
  selectedSubject: null,
  selectedTopic: null,
  selectedSubtopic: null,
  sidebarCollapsed: false,
  loading: false,
  error: null,
};

function pilotReducer(state: PilotState, action: PilotAction): PilotState {
  switch (action.type) {
    case 'SET_NOTES':
      return { ...state, notes: action.payload };

    case 'SET_CURRENT_NOTE':
      return { ...state, currentNote: action.payload };

    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };

    case 'SET_SELECTED_SUBJECT':
      return {
        ...state,
        selectedSubject: action.payload,
        selectedTopic: null,
        selectedSubtopic: null,
      };

    case 'SET_SELECTED_TOPIC':
      return {
        ...state,
        selectedTopic: action.payload,
        selectedSubtopic: null,
      };

    case 'SET_SELECTED_SUBTOPIC':
      return {
        ...state,
        selectedSubtopic: action.payload,
      };

    case 'SET_SIDEBAR_COLLAPSED':
      return { ...state, sidebarCollapsed: action.payload };

    case 'UPDATE_CURRENT_NOTE':
      return {
        ...state,
        currentNote: state.currentNote
          ? { ...state.currentNote, ...action.payload }
          : null,
        notes: state.notes.map((n) =>
          n.id === state.currentNote?.id ? { ...n, ...action.payload } : n
        ),
      };

    case 'UPDATE_NOTE':
      return {
        ...state,
        currentNote: state.currentNote
          ? { ...state.currentNote, ...action.payload }
          : null,
        notes: state.notes.map((n) =>
          n.id === state.currentNote?.id ? { ...n, ...action.payload } : n
        ),
      };

    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ============ CONTEXT & PROVIDER ============

const PilotContext = createContext<{
  state: PilotState;
  dispatch: React.Dispatch<PilotAction>;
} | null>(null);

export function PilotProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(pilotReducer, initialState);

  return (
    <PilotContext.Provider value={{ state, dispatch }}>
      {children}
    </PilotContext.Provider>
  );
}

export function usePilot() {
  const context = useContext(PilotContext);
  if (!context) {
    throw new Error('usePilot must be used within PilotProvider');
  }
  return context;
}
