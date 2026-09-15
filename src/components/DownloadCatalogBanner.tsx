/**
 * DownloadCatalogBanner — the single "Download questions" call to action.
 *
 * Every study screen reads the question bank locally. When no bank exists yet
 * the screens correctly return empty results, but an empty list with no
 * explanation looks like a bug. This banner is the one place that explains
 * *why* it's empty and gives the user the fix.
 *
 * Renders nothing as soon as a local bank exists, so it is safe to drop into a
 * screen's layout unconditionally.
 *
 * Usage:
 *   <DownloadCatalogBanner course={selectedCourse} onPress={...} />
 *
 * Leave `onPress` off to route to Profile (where Download / Refresh / Clear
 * live). Pass one to trigger a download inline instead.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Download } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { isCatalogLocalReady } from '../services/CatalogSource';

export interface DownloadCatalogBannerProps {
  /** Course to check. When omitted, any downloaded course counts. */
  course?: string;
  /** Optional inline action. Defaults to navigating to Profile. */
  onPress?: () => void;
  /** Force-hide even when the bank is missing (e.g. an inline prompt exists). */
  hidden?: boolean;
  /** Override the explanatory line. */
  message?: string;
}

export function DownloadCatalogBanner({
  course,
  onPress,
  hidden = false,
  message,
}: DownloadCatalogBannerProps) {
  const { colors } = useTheme();
  const router = useRouter();

  if (hidden) return null;
  if (isCatalogLocalReady(course)) return null;

  const handlePress = () => {
    if (onPress) { onPress(); return; }
    router.push('/profile');
  };

  return (
    <TouchableOpacity
      testID="download-catalog-banner"
      activeOpacity={0.85}
      onPress={handlePress}
      style={[
        styles.container,
        { backgroundColor: colors.primary + '12', borderColor: colors.primary + '40' },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.primary + '22' }]}>
        <Download size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Download questions
        </Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          {message || 'Get the full question bank and answer images for offline study.'}
        </Text>
      </View>
      <Text style={[styles.cta, { color: colors.primary }]}>Go</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '800' },
  sub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  cta: { fontSize: 13, fontWeight: '800' },
});

export default DownloadCatalogBanner;
