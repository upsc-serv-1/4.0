import { Stack } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { View } from 'react-native';

export default function CapsuleLayout() {
  const { colors } = useTheme();
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
