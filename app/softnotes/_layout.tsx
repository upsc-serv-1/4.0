import { Stack } from 'expo-router';

export default function SoftNotesLayout() {
  return (
    <Stack screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
      animationDuration: 320,
      gestureEnabled: true,
      fullScreenGestureEnabled: false,
    }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[notebookId]" />
    </Stack>
  );
}
