import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, SafeAreaView, StyleSheet, Alert, StatusBar } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { PilotProvider, usePilot, PilotNote } from '../../src/context/PilotContext';
import { fetchPilotNotes, savePilotNote, deletePilotNote } from '../../src/repositories/pilotRepo';

// Import adapted native components
import { PilotDashboard } from '../../src/components/pilot/PilotDashboard';
import { PilotGlanceView } from '../../src/components/pilot/PilotGlanceView';
import { PilotEditorView } from '../../src/components/pilot/PilotEditorView';

function PilotContent() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { state, dispatch } = usePilot();
  const userId = session?.user?.id;
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      loadNotes();
    }
  }, [userId]);

  const loadNotes = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      if (userId) {
        const dbNotes = await fetchPilotNotes(userId);
        dispatch({ type: 'SET_NOTES', payload: dbNotes });
      }
    } catch (err: any) {
      console.error('Error fetching notes:', err);
      dispatch({ type: 'SET_ERROR', payload: err?.message || 'Failed to load notes' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleCreateNote = async (title: string, subject: string) => {
    if (!userId) return;
    setLocalLoading(true);
    try {
      const newNoteTemplate: Partial<PilotNote> = {
        title,
        subject,
        content: {
          blocks: [
            { id: `b_init_${Date.now()}`, type: 'paragraph', text: 'Start writing your notes here...' }
          ]
        }
      };
      const created = await savePilotNote(userId, newNoteTemplate);
      
      // Refresh list
      const dbNotes = await fetchPilotNotes(userId);
      dispatch({ type: 'SET_NOTES', payload: dbNotes });
      
      // Open in editor directly
      dispatch({ type: 'SET_CURRENT_NOTE', payload: created });
      dispatch({ type: 'SET_VIEW_MODE', payload: 'editor' });
      
      Alert.alert('Success', `Created note: "${title}"`);
    } catch (err: any) {
      console.error('Create note failed:', err);
      Alert.alert('Error', 'Failed to create note: ' + err.message);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleSaveNote = async (updatedFields: Partial<PilotNote>) => {
    if (!userId || !state.currentNote) return;
    setLocalLoading(true);
    try {
      const fullNoteUpdates = {
        ...state.currentNote,
        ...updatedFields
      };
      const saved = await savePilotNote(userId, fullNoteUpdates);
      
      // Refresh list
      const dbNotes = await fetchPilotNotes(userId);
      dispatch({ type: 'SET_NOTES', payload: dbNotes });
      
      // Go to preview/glance mode
      dispatch({ type: 'SET_CURRENT_NOTE', payload: saved });
      dispatch({ type: 'SET_VIEW_MODE', payload: 'glance' });
      
    } catch (err: any) {
      console.error('Save note failed:', err);
      Alert.alert('Error', 'Failed to save note: ' + err.message);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLocalLoading(true);
            try {
              await deletePilotNote(noteId);
              // Refresh list
              if (userId) {
                const dbNotes = await fetchPilotNotes(userId);
                dispatch({ type: 'SET_NOTES', payload: dbNotes });
              }
            } catch (err: any) {
              console.error('Delete failed:', err);
              Alert.alert('Error', 'Failed to delete note');
            } finally {
              setLocalLoading(false);
            }
          }
        }
      ]
    );
  };

  if (state.loading || localLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.bg === '#fff' ? 'dark-content' : 'light-content'} />
      {(() => {
        switch (state.viewMode) {
          case 'dashboard':
            return (
              <PilotDashboard
                notes={state.notes}
                onSelectNote={(note) => {
                  dispatch({ type: 'SET_CURRENT_NOTE', payload: note });
                  dispatch({ type: 'SET_VIEW_MODE', payload: 'glance' });
                }}
                onCreateNote={handleCreateNote}
                onDeleteNote={handleDeleteNote}
              />
            );

          case 'glance':
            return (
              <PilotGlanceView
                onBack={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'dashboard' })}
                onOpenEditor={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'editor' })}
              />
            );

          case 'editor':
            return (
              <PilotEditorView
                onClose={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'glance' })}
                onSave={handleSaveNote}
              />
            );

          default:
            return (
              <PilotDashboard
                notes={state.notes}
                onSelectNote={(note) => {
                  dispatch({ type: 'SET_CURRENT_NOTE', payload: note });
                  dispatch({ type: 'SET_VIEW_MODE', payload: 'glance' });
                }}
                onCreateNote={handleCreateNote}
                onDeleteNote={handleDeleteNote}
              />
            );
        }
      })()}
    </SafeAreaView>
  );
}

export default function PilotWebViewScreen() {
  return (
    <PilotProvider>
      <PilotContent />
    </PilotProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
