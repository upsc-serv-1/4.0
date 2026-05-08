import { Stack } from 'expo-router';

export default function SoftNotesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[notebookId]" />
    </Stack>
  );
}
