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
import { useTheme } from '../../src/context/ThemeContext';

export default function PilotV2Layout() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      />
    </View>
  );
}
