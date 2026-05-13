/**
 * Pilot V2 — main entry route
 *
 * Mirrors the App.tsx of the Knowledge Management Vite app: a single page that
 * switches between five view modes via context, while the Sidebar (Home /
 * Subject mode) and the main pane render side-by-side on tablets.
 *
 * Steps 4-9 will replace each `<Placeholder>` with the real screen component.
 * For now the route resolves so the bottom-tab bar can navigate here.
 */
import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, useWindowDimensions, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { PilotV2Provider, usePilotV2 } from '../../src/context/PilotV2Context';
import { PilotV2Sidebar } from '../../src/components/pilot-v2/PilotV2Sidebar';
import { PilotV2Dashboard } from '../../src/components/pilot-v2/PilotV2Dashboard';
import { PilotV2NoteList } from '../../src/components/pilot-v2/PilotV2NoteList';
import { PilotV2GlanceView } from '../../src/components/pilot-v2/PilotV2GlanceView';
import { PilotV2EditorView } from '../../src/components/pilot-v2/PilotV2EditorView';
import { PilotV2EmptyState } from '../../src/components/pilot-v2/PilotV2EmptyState';
import { fetchPilotV2NotesForUser } from '../../src/repositories/pilotV2Repo';
import { PilotV2AIChat } from '../../src/components/pilot-v2/PilotV2AIChat';
import { startPilotV2SyncQueue } from '../../src/components/pilot-v2/pilotV2SyncQueue';
import { PilotV2LocalStore } from '../../src/components/pilot-v2/pilotV2LocalStore';
import { hydratePilotV2Note } from '../../src/components/pilot-v2/pilotV2OfflineSave';
import { migratePilotV2Notes } from '../../src/components/pilot-v2/pilotV2Migration';

function PilotV2Inner() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user?.id;
  const { state, dispatch } = usePilotV2();
  const params = useLocalSearchParams<{ noteId?: string }>();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isFirstFocusRef = useRef(true);

  // Start the local-first sync queue once on mount.
  useEffect(() => {
    const stop = startPilotV2SyncQueue();
    return stop;
  }, []);

  // Extract loadNotes into a stable callback so it can be reused on focus.
  const loadNotes = useCallback(async () => {
    if (!userId) return;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const notes = await fetchPilotV2NotesForUser(userId);
      // Crash recovery: hydrate every note from local cache (newer-wins) and
      // run the backward-compat migrator before exposing them to the UI.
      const hydrated = notes.map((n) => {
        const result = hydratePilotV2Note(n.id, {
          content: n.content,
          updatedAt: (n as any).updated_at || new Date().toISOString(),
        });
        return { ...n, content: result.content };
      });
      const migrated = migratePilotV2Notes(hydrated);
      // Also rehydrate notes that exist locally but not in the server response
      // (possible when the user was offline when they were created).
      const knownIds = new Set(migrated.map(n => n.id));
      for (const localId of PilotV2LocalStore.listAll()) {
        if (!knownIds.has(localId)) {
          const cached = PilotV2LocalStore.get(localId);
          if (cached) {
            migrated.push({
              id: localId,
              title: 'Untitled note',
              content: cached.content,
            } as any);
          }
        }
      }
      dispatch({ type: 'SET_NOTES', payload: migrated });
    } catch (e) {
      dispatch({ type: 'SET_ERROR', payload: (e as Error).message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [userId, dispatch]);

  // Initial load — fetch real notes from Supabase if a user is signed in.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadNotes();
    })();
    return () => { cancelled = true; };
  }, [loadNotes]);

  // FIX: Reload notes every time the Pilot V2 tab gains focus.
  // This ensures hierarchy/nodes created externally (e.g. from PilotV2SaveSheet
  // on quiz pages) are visible in the sidebar without a manual refresh.
  useFocusEffect(
    useCallback(() => {
      // Skip the initial mount since the loadNotes call above already fires
      // on mount. We use a ref to track first focus vs subsequent focuses.
      const firstFocus = isFirstFocusRef.current;
      isFirstFocusRef.current = false;
      if (firstFocus) return;

      loadNotes();
    }, [loadNotes])
  );

  // Deep-link support: open a specific Pilot V2 note when coming from Home
  // recent-notes cards.
  useEffect(() => {
    const targetId = params.noteId;
    if (!targetId || !state.notes?.length) return;
    const exists = state.notes.some((n) => n.id === targetId);
    if (!exists) return;
    dispatch({ type: 'SET_CURRENT_NOTE_ID', payload: targetId });
    dispatch({ type: 'SET_VIEW_MODE', payload: 'glance' });
  }, [params.noteId, state.notes, dispatch]);

  const sidebarMode = state.view.mode === 'dashboard' ? 'home' : 'subject';
  const showSidebar = state.view.mode !== 'editor' && !state.view.sidebarCollapsed;

  const main = useMemo(() => {
    if (state.loading) {
      return (
        <View style={[styles.center, { backgroundColor: colors.bg }]}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      );
    }
    switch (state.view.mode) {
      case 'dashboard':
        return <PilotV2Dashboard />;
      case 'subject':
        return state.view.selectedSubtopic ? <PilotV2NoteList /> : <PilotV2Dashboard />;
      case 'noteList':
        return <PilotV2NoteList />;
      case 'glance':
        return <PilotV2GlanceView />;
      case 'editor':
        return <PilotV2EditorView />;
      default:
        return <PilotV2Dashboard />;
    }
  }, [state.loading, state.view, colors]);

  const isEditor = state.view.mode === 'editor';
  return (
    <SafeAreaView edges={isEditor ? [] : ['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.workspace}>
        {showSidebar && (
          <PilotV2Sidebar mode={sidebarMode} />
        )}
        <View style={{ flex: 1 }} testID="pilot-v2-main">
          {main}
          {/* Sidebar toggle — always visible for uniformity.
             When sidebar is collapsed: shows ChevronRight to open.
             When sidebar is open: shows ChevronLeft to close. */}
          <TouchableOpacity
            testID="pilot-v2-show-sidebar"
            onPress={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            style={{
              position: 'absolute',
              bottom: 24,
              left: 24,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: showSidebar ? colors.textSecondary : colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: colors.primary,
              shadowOpacity: 0.3,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 5,
              zIndex: 9999,
            }}
          >
            {showSidebar ? (
              <ChevronLeft size={20} color="#fff" />
            ) : (
              <ChevronRight size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Floating Context-Aware AI Chat Card overlay */}
      <PilotV2AIChat />
    </SafeAreaView>
  );
}

export default function PilotV2Route() {
  return (
    <PilotV2Provider>
      <PilotV2Inner />
    </PilotV2Provider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backLink: { fontSize: 13, fontWeight: '600', minWidth: 60 },
  brand: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  workspace: { flex: 1, flexDirection: 'row' },
});
