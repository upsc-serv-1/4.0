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
import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, useWindowDimensions, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Menu, ChevronRight } from 'lucide-react-native';
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

function PilotV2Inner() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user?.id;
  const { state, dispatch } = usePilotV2();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // Initial load — fetch real notes from Supabase if a user is signed in.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!userId) return;
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const notes = await fetchPilotV2NotesForUser(userId);
        if (!cancelled) dispatch({ type: 'SET_NOTES', payload: notes });
      } catch (e) {
        if (!cancelled) {
          dispatch({ type: 'SET_ERROR', payload: (e as Error).message });
        }
      } finally {
        if (!cancelled) dispatch({ type: 'SET_LOADING', payload: false });
      }
    };
    load();
    return () => { cancelled = true; };
  }, [userId, dispatch]);

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
          {!showSidebar && (
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
                backgroundColor: '#5B4EFA',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#5B4EFA',
                shadowOpacity: 0.3,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 5,
                zIndex: 9999,
              }}
            >
              <ChevronRight size={20} color="#fff" />
            </TouchableOpacity>
          )}
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
