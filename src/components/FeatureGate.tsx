/**
 * FeatureGate — Wraps a feature screen and shows an upsell banner if the user
 * doesn't have access.
 *
 * Usage:
 *   <FeatureGate feature="pyq">
 *     <PYQScreen />
 *   </FeatureGate>
 *
 *   // With a custom fallback:
 *   <FeatureGate feature="flashcards" fallback={<CustomUpgrade />}>
 *     <FlashcardsScreen />
 *   </FeatureGate>
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAccessControl, FeatureKey } from '../context/AccessControlContext';
import { useTheme } from '../context/ThemeContext';
import { Lock, Sparkles, Crown, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { emitShowSubscription } from '../utils/subscriptionEvents';

interface FeatureGateProps {
  feature: FeatureKey | string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Label shown in the upsell (e.g. "PYQs", "Flashcards") */
  featureLabel?: string;
  /** If true, still render children but show a banner at the top */
  softGate?: boolean;
  /** Hide the back button on the upsell screen */
  hideBack?: boolean;
  /** If true, always show the plan picker sheet on mount */
  showPlansOnMount?: boolean;  // not used, for future
}

export default function FeatureGate({
  feature,
  children,
  fallback,
  featureLabel,
  softGate = false,
  hideBack = false,
}: FeatureGateProps) {
  const { hasAccess, loading } = useAccessControl();
  const { colors } = useTheme();
  const router = useRouter();

  // While loading permissions, show a simple placeholder
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <View style={[styles.loadingPulse, { backgroundColor: colors.surface }]} />
      </View>
    );
  }

  const granted = hasAccess(feature);

  // Soft gate: show a banner at the top but still render children
  if (!granted && softGate) {
    return (
      <View style={{ flex: 1 }}>
        <View style={[styles.softBanner, { backgroundColor: colors.primary + '15' }]}>
          <Lock size={14} color={colors.primary} />
          <Text style={[styles.softBannerText, { color: colors.primary }]}>
            {featureLabel || feature} is locked —{' '}
            <Text style={{ fontWeight: 'bold' }}>Upgrade</Text> to access
          </Text>
        </View>
        {children}
      </View>
    );
  }

  if (!granted) {
    // Show custom fallback or default upgrade screen
    if (fallback) return <>{fallback}</>;

    const label = featureLabel || feature.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    return (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.bg }]}
        contentContainerStyle={styles.content}
      >
        {!hideBack && (
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: colors.surface }]}
          >
            <ArrowLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        )}

        <View style={styles.iconWrap}>
          <Crown size={48} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Unlock {label}
        </Text>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          This feature is available on Pro and Premium plans. Upgrade to get full
          access to all features including {label}, analytics, AI tools, and more.
        </Text>

        <View style={[styles.featureList, { backgroundColor: colors.surface }]}>
          <FeatureRow icon={Sparkles} label="Full access to all PYQs" color={colors} />
          <FeatureRow icon={Sparkles} label="Advanced analytics & insights" color={colors} />
          <FeatureRow icon={Sparkles} label="AI-powered search & tools" color={colors} />
          <FeatureRow icon={Sparkles} label="Spaced repetition flashcards" color={colors} />
          <FeatureRow icon={Sparkles} label="Unlimited note-taking" color={colors} />
        </View>

        <TouchableOpacity
          style={[styles.upgradeButton, { backgroundColor: colors.primary }]}
          onPress={emitShowSubscription}
        >
          <Crown size={18} color={colors.buttonText} />
          <Text style={[styles.upgradeButtonText, { color: colors.buttonText }]}>
            View Plans
          </Text>
        </TouchableOpacity>

        <Text style={[styles.footer, { color: colors.textTertiary }]}>
          Already subscribed? Pull down to refresh
        </Text>
      </ScrollView>
    );
  }

  // User has access — render children
  // SubscriptionSheet is rendered at this level so it's available to all branches
  return <>{children}</>;
}

function FeatureRow({
  icon: Icon,
  label,
  color,
}: {
  icon: any;
  label: string;
  color: any;
}) {
  return (
    <View style={styles.featureRow}>
      <Icon size={16} color={color.primary} />
      <Text style={[styles.featureRowText, { color: color.textPrimary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingPulse: {
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.3,
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  featureList: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    gap: 14,
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureRowText: {
    fontSize: 14,
    fontWeight: '600',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 14,
    marginBottom: 16,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
  },
  softBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  softBannerText: {
    fontSize: 13,
    flex: 1,
  },
});
