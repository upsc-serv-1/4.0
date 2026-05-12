import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { BookOpen, Download, Zap, Target } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { height } = Dimensions.get('window');

export interface FirstLoginWelcomeModalProps {
  visible: boolean;
  onClose: () => void;
  syncInProgress: boolean;
  syncProgress?: { phase: string; detail: string; current: number; total: number };
}

const PHASE_LABELS: Record<string, string> = {
  tests: 'Downloading test catalogue',
  questions: 'Downloading questions',
  states: 'Syncing your tags & bookmarks',
  notes: 'Syncing your notebooks',
  attempts: 'Syncing test attempts',
  cards: 'Syncing flashcards',
  done: 'Finalizing',
};

export function FirstLoginWelcomeModal({
  visible,
  onClose,
  syncInProgress,
  syncProgress,
}: FirstLoginWelcomeModalProps) {
  const { colors } = useTheme();
  const [showAutoClose, setShowAutoClose] = useState(false);

  // Auto-dismiss 1.5s after sync completes
  useEffect(() => {
    if (visible && !syncInProgress && showAutoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [visible, syncInProgress, showAutoClose]);

  // Set flag once sync completes first time
  useEffect(() => {
    if (visible && !syncInProgress) {
      setShowAutoClose(true);
    }
  }, [visible, syncInProgress]);

  const progressPercent = syncProgress && syncProgress.total > 0
    ? Math.min(100, Math.round((syncProgress.current / syncProgress.total) * 100))
    : 0;
  const phaseLabel = syncProgress
    ? (PHASE_LABELS[syncProgress.phase] || syncProgress.detail || 'Syncing...')
    : 'Preparing download...';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LinearGradient
            colors={[colors.primary + '15', colors.primary + '08']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.header}>
              <View style={[styles.iconBox, { backgroundColor: colors.primary }]}>
                <BookOpen size={32} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  Welcome to Pilot Pro
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {syncInProgress ? 'Setting up your workspace...' : 'Ready to study!'}
                </Text>
              </View>
            </View>
          </LinearGradient>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <View style={styles.featureList}>
              <FeatureItem
                icon={<Target size={24} color={colors.primary} />}
                title="Focused Learning"
                description="Targeted questions from UPSC exams and resources"
                colors={colors}
              />
              <FeatureItem
                icon={<Zap size={24} color={colors.primary} />}
                title="Smart Study"
                description="AI-powered explanations and performance tracking"
                colors={colors}
              />
              <FeatureItem
                icon={<Download size={24} color={colors.primary} />}
                title="Offline Ready"
                description="Access all questions anytime, anywhere"
                colors={colors}
              />
            </View>

            {syncInProgress && (
              <View style={styles.syncSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, justifyContent: 'space-between' }}>
                  <Text style={[styles.syncLabel, { color: colors.textSecondary }]}>
                    {phaseLabel}
                  </Text>
                  {syncProgress && syncProgress.total > 0 && (
                    <Text style={[styles.syncPercent, { color: colors.primary, fontWeight: '900' }]}>
                      {progressPercent}%
                    </Text>
                  )}
                </View>
                <View style={[styles.progressBar, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: colors.primary,
                        width: `${progressPercent}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.syncInfo, { color: colors.textTertiary }]}>
                  {syncProgress ? syncProgress.detail : 'Starting...'}
                </Text>
              </View>
            )}

            {!syncInProgress && (
              <View style={[styles.completeBox, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <View style={[styles.checkmark, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>✓</Text>
                  </View>
                  <Text style={[styles.completeTitle, { color: colors.primary }]}>
                    All Set!
                  </Text>
                </View>
                <Text style={[styles.completeText, { color: colors.textSecondary }]}>
                  Your question database is ready. Let's get started with your studies!
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            {syncInProgress && (
              <View style={styles.syncSpinner}>
                <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.syncingText, { color: colors.textSecondary }]}>
                  Syncing in background...
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={onClose}
              disabled={syncInProgress}
              style={[
                styles.button,
                {
                  backgroundColor: syncInProgress ? colors.surfaceStrong : colors.primary,
                  opacity: syncInProgress ? 0.6 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.buttonText,
                  { color: syncInProgress ? colors.textSecondary : '#fff' },
                ]}
              >
                {syncInProgress ? 'Continue with Sync...' : "Let's Begin"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FeatureItem({
  icon,
  title,
  description,
  colors,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  colors: any;
}) {
  return (
    <View style={styles.featureItem}>
      <View style={[styles.featureIcon, { backgroundColor: colors.primary + '15' }]}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>
          {title}
        </Text>
        <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
          {description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  container: {
    borderRadius: 24,
    borderWidth: 1,
    maxHeight: height * 0.85,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  featureList: {
    gap: 16,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  syncSection: {
    marginVertical: 16,
  },
  syncLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  syncPercent: {
    fontSize: 14,
    fontWeight: '900',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
  },
  syncInfo: {
    fontSize: 11,
    fontWeight: '600',
  },
  completeBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 12,
  },
  checkmark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  completeText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginLeft: 40,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  syncSpinner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  syncingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  button: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
