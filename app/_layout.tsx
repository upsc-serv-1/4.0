import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ProfileProvider } from '../src/context/ProfileContext';
import { NetworkProvider } from '../src/context/NetworkContext';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useOfflineBootstrap } from '../src/hooks/useOfflineBootstrap';
import { useFirstLoginWelcome } from '../src/hooks/useFirstLoginWelcome';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { FirstLoginWelcomeModal } from '../src/components/FirstLoginWelcomeModal';
import { DownloadManagerProvider } from '../src/context/DownloadManagerContext';
import { DownloadManager } from '../src/components/pyq/DownloadManager';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ProfileProviderWrapper>
            <NetworkProvider>
              <ThemeProvider>
                <DownloadManagerProvider>
                  <RootStack />
                </DownloadManagerProvider>
              </ThemeProvider>
            </NetworkProvider>
          </ProfileProviderWrapper>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ProfileProviderWrapper({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  return <ProfileProvider session={session}>{children}</ProfileProvider>;
}

function RootStack() {
  const { theme, colors } = useTheme();
  // Wire offline-first behaviour: auto-sync on login, background queue drain.
  useOfflineBootstrap();
  
  // Track first login and show welcome modal
  const { showWelcome, syncInProgress, syncProgress, onCloseWelcome } = useFirstLoginWelcome();
  
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
        animation: 'none',
        gestureEnabled: true,
        fullScreenGestureEnabled: false,
      }}>
        <Stack.Screen name="index" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="notes" options={{ animation: 'slide_from_right', gestureEnabled: true, fullScreenGestureEnabled: false }} />
      </Stack>
      <DownloadManager />
      <FirstLoginWelcomeModal
        visible={showWelcome}
        onClose={onCloseWelcome}
        syncInProgress={syncInProgress}
        syncProgress={syncProgress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
