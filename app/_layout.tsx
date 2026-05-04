import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { AuthProvider } from '../src/context/AuthContext';
import { NetworkProvider } from '../src/context/NetworkContext';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useOfflineBootstrap } from '../src/hooks/useOfflineBootstrap';
import { OfflineBanner } from '../src/components/OfflineBanner';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <NetworkProvider>
            <ThemeProvider>
              <RootStack />
            </ThemeProvider>
          </NetworkProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const { theme, colors } = useTheme();
  // Wire offline-first behaviour: auto-sync on login, background queue drain.
  useOfflineBootstrap();
  
  // Decide if status bar should be light or dark based on theme brightness
  // Themes like 'ivory', 'sage', 'lavender', 'child_of_light' are light
  const isDarkTheme = theme.includes('dark') || theme.includes('midnight') || theme.includes('nebula') || theme.includes('night') || theme.includes('navy') || theme.includes('fuchsia') || theme.includes('emerald') || theme === 'modern';
  const statusBarStyle = isDarkTheme ? 'light' : 'dark';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <LinearGradient
        colors={colors?.bgGradient || ['#f8fafc', '#f1f5f9']}
        style={StyleSheet.absoluteFill}
        locations={[0, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <StatusBar style={statusBarStyle} translucent backgroundColor="transparent" />
      <OfflineBanner />
      <Stack screenOptions={{ 
        headerShown: false, 
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'slide_from_right',
        animationDuration: 400,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="notes" options={{ animation: 'slide_from_right', gestureEnabled: true, fullScreenGestureEnabled: true }} />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
