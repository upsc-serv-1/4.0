import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { SkeletonDashboard } from '../src/components/common/SkeletonLoader';

export default function Index() {
  const { session, loading } = useAuth();
  const { colors } = useTheme();

  console.log("[Route: index] Session:", !!session, "Loading:", loading);
  if (loading) {
    return <SkeletonDashboard colors={colors} />;
  }
  return session ? <Redirect href="/(tabs)" /> : <Redirect href="/(auth)/login" />;
}
