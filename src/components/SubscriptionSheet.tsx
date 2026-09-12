/**
 * SubscriptionSheet — Shows available plans and current subscription status.
 * Can be triggered from FeatureGate's "View Plans" button or from Profile.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator,
} from 'react-native';
import { Crown, Check, X, RefreshCw, Sparkles, BookOpen, BarChart2, Layers, Search, FileText } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAccessControl } from '../context/AccessControlContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
}

const FEATURE_ICONS: Record<string, any> = {
  pyq: BookOpen,
  analytics: BarChart2,
  flashcards: Layers,
  ai_search: Search,
  notes: FileText,
};

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function SubscriptionSheet({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { refresh, hasAccess, loading: permLoading } = useAccessControl();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSub, setCurrentSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!visible) return;
    loadPlans();
    loadSubscription();
  }, [visible]);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const { data: plansData } = await supabase
        .from('access_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      // Load features per plan
      const plansWithFeatures: Plan[] = [];
      for (const plan of (plansData || []) as any[]) {
        const { data: pfs } = await supabase
          .from('plan_features')
          .select('access_features!inner(name, key)')
          .eq('plan_id', plan.id)
          .eq('is_granted', true);

        plansWithFeatures.push({
          id: plan.id,
          name: plan.name,
          description: plan.description || '',
          price: plan.price,
          currency: plan.currency,
          interval: plan.interval,
          features: (pfs || []).map((pf: any) => pf.access_features?.name || pf.access_features?.key),
        });
      }
      setPlans(plansWithFeatures);
    } catch (err) {
      console.error('Failed to load plans:', err);
    }
    setLoading(false);
  };

  const loadSubscription = async () => {
    if (!session?.user?.id) return;
    try {
      const { data } = await supabase
        .from('user_subscriptions')
        .select('*, access_plans(name)')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .maybeSingle();
      setCurrentSub(data);
    } catch {}
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    await loadSubscription();
    setRefreshing(false);
  };

  const formatCurrency = (n: number, c: string) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);

  const currentPlanName = currentSub?.access_plans?.name || 'Free';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.bg }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Crown size={22} color={colors.primary} />
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Subscription</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.surface }]}>
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {/* Current Plan Status */}
            <View style={[styles.currentPlanCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.currentPlanRow}>
                <View>
                  <Text style={[styles.currentPlanLabel, { color: colors.textTertiary }]}>Current Plan</Text>
                  <Text style={[styles.currentPlanName, { color: colors.textPrimary }]}>{currentPlanName}</Text>
                </View>
                <View style={[styles.statusBadge, {
                  backgroundColor: currentSub ? colors.primary + '20' : colors.surfaceStrong,
                }]}>
                  <Text style={[styles.statusText, {
                    color: currentSub ? colors.primary : colors.textTertiary,
                  }]}>
                    {currentSub ? 'Active' : 'Free'}
                  </Text>
                </View>
              </View>
              {currentSub?.expires_at && (
                <Text style={[styles.expiryText, { color: colors.textTertiary }]}>
                  Expires: {new Date(currentSub.expires_at).toLocaleDateString('en-IN')}
                </Text>
              )}
              <TouchableOpacity
                onPress={handleRefresh}
                disabled={refreshing}
                style={[styles.refreshBtn, { backgroundColor: colors.surfaceStrong }]}
              >
                <RefreshCw size={14} color={colors.primary} />
                <Text style={[styles.refreshText, { color: colors.primary }]}>
                  {refreshing ? 'Refreshing...' : 'Refresh & Restore Subscription'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Available Plans */}
            {loading ? (
              <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
            ) : (
              <View style={styles.plansList}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Available Plans</Text>
                {plans.map((plan) => {
                  const isCurrent = currentPlanName === plan.name;
                  return (
                    <View
                      key={plan.id}
                      style={[styles.planCard, {
                        backgroundColor: colors.surface,
                        borderColor: isCurrent ? colors.primary : colors.border,
                        borderWidth: isCurrent ? 2 : 1,
                      }]}
                    >
                      <View style={styles.planHeader}>
                        <View>
                          <Text style={[styles.planName, { color: colors.textPrimary }]}>{plan.name}</Text>
                          <Text style={[styles.planPrice, { color: colors.primary }]}>
                            {plan.price === 0 ? 'Free' : formatCurrency(plan.price, plan.currency)}
                            {plan.price > 0 && (
                              <Text style={[styles.planInterval, { color: colors.textTertiary }]}>
                                {' '}/ {plan.interval}
                              </Text>
                            )}
                          </Text>
                        </View>
                        {isCurrent && (
                          <View style={[styles.currentBadge, { backgroundColor: colors.primary + '20' }]}>
                            <Text style={[styles.currentBadgeText, { color: colors.primary }]}>Active</Text>
                          </View>
                        )}
                      </View>
                      {plan.description ? (
                        <Text style={[styles.planDesc, { color: colors.textSecondary }]}>{plan.description}</Text>
                      ) : null}
                      {/* Features list */}
                      <View style={styles.featureList}>
                        {plan.features.slice(0, 6).map((feat, i) => {
                          const Icon = FEATURE_ICONS[feat.toLowerCase().replace(/\s/g, '_')] || Sparkles;
                          return (
                            <View key={i} style={styles.featureRow}>
                              <Check size={12} color={colors.primary} />
                              <Text style={[styles.featureText, { color: colors.textSecondary }]}>{feat}</Text>
                            </View>
                          );
                        })}
                        {plan.features.length > 6 && (
                          <Text style={[styles.moreFeatures, { color: colors.textTertiary }]}>
                            +{plan.features.length - 6} more features
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    gap: 20,
  },
  currentPlanCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  currentPlanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentPlanLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  currentPlanName: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  expiryText: {
    fontSize: 12,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '700',
  },
  plansList: {
    gap: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  planCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    gap: 10,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planName: {
    fontSize: 16,
    fontWeight: '800',
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  planInterval: {
    fontSize: 12,
    fontWeight: '600',
  },
  planDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  currentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  featureList: {
    gap: 6,
    marginTop: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
  },
  moreFeatures: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
