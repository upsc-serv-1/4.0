import { Stack } from 'expo-router';

export default function HardnotesStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 320,
        gestureEnabled: true,
        fullScreenGestureEnabled: false,
      }}
    >
      <Stack.Screen
        name="editor"
        options={{ animation: 'slide_from_bottom', animationDuration: 320 }}
      />
    </Stack>
  );
}
