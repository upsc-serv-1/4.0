/**
 * Pilot V2 — route layout
 *
 * The Pilot V2 surface lives under /pilot-v2 and uses an internal view-mode
 * router (Dashboard ↔ NoteList ↔ Glance ↔ Editor) instead of separate routes
 * to mirror the seven-screen design from the KM app and keep Sidebar state
 * stable across screen transitions.
 */
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { useEffect } from 'react';
import { useTheme } from '../../src/context/ThemeContext';
import { startPilotV2SyncQueue } from '../../src/components/pilot-v2/pilotV2SyncQueue';

export default function PilotV2Layout() {
  const { colors } = useTheme();
  useEffect(() => {
    const stop = startPilotV2SyncQueue();
    return stop;
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
          animationDuration: 320,
          gestureEnabled: true,
          fullScreenGestureEnabled: false,
        }}
      />
    </View>
  );
}
