import { useState, useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ProfileProvider } from '../src/context/ProfileContext';
import { NetworkProvider } from '../src/context/NetworkContext';
import { CourseProvider } from '../src/context/CourseContext';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useOfflineBootstrap } from '../src/hooks/useOfflineBootstrap';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { DownloadManagerProvider } from '../src/context/DownloadManagerContext';
import { AccessControlProvider } from '../src/context/AccessControlContext';
import { DownloadManager } from '../src/components/pyq/DownloadManager';
import SubscriptionSheet from '../src/components/SubscriptionSheet';
import { onShowSubscription } from '../src/utils/subscriptionEvents';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ProfileProviderWrapper>
            <NetworkProvider>
              <CourseProvider>
                <ThemeProvider>
                  <DownloadManagerProvider>
                    <AccessControlProvider>
                      <RootStack />
                    </AccessControlProvider>
                  </DownloadManagerProvider>
                </ThemeProvider>
              </CourseProvider>
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
  const { isDark, colors } = useTheme();
  const [showSubscription, setShowSubscription] = useState(false);

  // Listen for global "show subscription" events from FeatureGate
  useEffect(() => onShowSubscription(setShowSubscription), []);
  // Wire offline-first behaviour: auto-sync on login, background queue drain.
  useOfflineBootstrap();
  
  // Use the luminance-based isDark flag from ThemeContext
  const statusBarStyle = isDark ? 'light' : 'dark';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <LinearGradient
        colors={(colors?.bgGradient || ['#f8fafc', '#f1f5f9']) as [string, ...string[]]}
        style={StyleSheet.absoluteFill}
        locations={[0, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <StatusBar style={statusBarStyle} translucent backgroundColor="transparent" />
      {/* Global subscription sheet — accessible from any screen */}
      <SubscriptionSheet visible={showSubscription} onClose={() => setShowSubscription(false)} />
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
        <Stack.Screen name="search" options={{ animation: 'slide_from_right', gestureEnabled: true, fullScreenGestureEnabled: false }} />
        <Stack.Screen name="notes" options={{ animation: 'slide_from_right', gestureEnabled: true, fullScreenGestureEnabled: false }} />
      </Stack>
      <DownloadManager />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
