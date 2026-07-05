import React, { useState, useEffect } from 'react';
import FeatureGate from '../src/components/FeatureGate';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Search,
  ChevronLeft,
  Target,
  BarChart3,
  LayoutList,
  BarChart2,
  Sparkles,
  Palette,
  Bookmark,
} from 'lucide-react-native';
import PrelimsTagsView from '../src/components/prelims/PrelimsTagsView';

function PrelimsScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [currentScreen, setCurrentScreen] = useState<'hub' | 'revision-tags'>('hub');

  // Theme state: 'gradient' or 'white' (default is 'white' for prelims)
  const [prelimsTheme, setPrelimsTheme] = useState<'gradient' | 'white'>('white');

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('prelims_theme');
        if (savedTheme === 'gradient') {
          setPrelimsTheme('gradient');
        } else {
          setPrelimsTheme('white');
        }
      } catch (err) {
        console.error('Failed to load prelims theme:', err);
      }
    };
    loadTheme();
  }, []);

  const togglePrelimsTheme = async () => {
    try {
      const nextTheme = prelimsTheme === 'gradient' ? 'white' : 'gradient';
      setPrelimsTheme(nextTheme);
      await AsyncStorage.setItem('prelims_theme', nextTheme);
    } catch (err) {
      console.error('Failed to save prelims theme:', err);
    }
  };

  const primaryCards = [
    {
      id: 'arena',
      title: 'Arena',
      description: 'Practice prelims questions & tests',
      color: '#ef4444',
      icon: Target,
    },
    {
      id: 'pyq',
      title: 'PYQ Analysis',
      description: 'Trend analysis of previous year questions',
      color: '#8b5cf6',
      icon: BarChart3,
    },
    {
      id: 'syllabus',
      title: 'Syllabus',
      description: 'Track your prelims syllabus progress',
      color: '#10b981',
      icon: LayoutList,
    },
    {
      id: 'analyse',
      title: 'Analyse',
      description: 'Review your test attempts & performance',
      color: '#14b8a6',
      icon: BarChart2,
    },
    {
      id: 'revision-tags',
      title: 'Revision Tags',
      description: 'Tag & track questions for revision',
      color: '#ec4899',
      icon: Bookmark,
    },
  ];

  const recentTopics = [
    'Polity',
    'Economy',
    'Geography',
    'History',
    'Environment',
    'Science & Tech',
  ];

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      {!isDark && prelimsTheme === 'gradient' && (
        <LinearGradient
          colors={['#e0f2fe', '#fef3c7', '#fce7f3', '#d1fae5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {/* Screen: Revision Tags */}
      {currentScreen === 'revision-tags' ? (
        <PrelimsTagsView onBack={() => setCurrentScreen('hub')} />
      ) : (
        <>
      {/* Back Button Header */}
      <View style={[styles.header, { backgroundColor: 'transparent', paddingTop: insets.top, height: 64 + insets.top }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: colors.surface + '88', borderColor: colors.border }]}
        >
          <ChevronLeft size={20} color={colors.textPrimary} />
          <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>UPSC Prelims</Text>
          <View style={styles.premiumBadge}>
            <Sparkles size={11} color="#f59e0b" style={{ marginRight: 2 }} />
            <Text style={styles.premiumText}>PREMIUM</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={togglePrelimsTheme}
          style={[
            styles.backButton,
            {
              backgroundColor: colors.surface + '88',
              borderColor: colors.border,
              paddingHorizontal: 10,
            }
          ]}
        >
          <Palette size={16} color={prelimsTheme === 'gradient' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.backButtonText, { color: prelimsTheme === 'gradient' ? colors.primary : colors.textSecondary, marginLeft: 4 }]}>
            {prelimsTheme === 'gradient' ? 'Theme 1' : 'Theme 2'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.hubScroll} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={[styles.heroHeading, { color: colors.textPrimary }]}>
            Master UPSC Prelims
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            Your dedicated hub for prelims preparation.
          </Text>

          {/* Search Input */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/ai-search')}
            style={[
              styles.largeSearchInput,
              {
                backgroundColor: !isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(30, 41, 59, 0.7)',
                borderColor: !isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.15)',
                height: isTablet ? 64 : 54,
                borderRadius: isTablet ? 32 : 27,
              }
            ]}
          >
            <Search size={isTablet ? 22 : 18} color="#94a3b8" style={{ marginRight: 10 }} />
            <TextInput
              placeholder="Search topics, PYQs, notes..."
              placeholderTextColor="#94a3b8"
              style={[styles.largeSearchText, { color: colors.textPrimary }]}
              editable={false}
              pointerEvents="none"
            />
          </TouchableOpacity>
        </View>

        {/* Cards Grid */}
        <View style={styles.cardsGrid}>
          {primaryCards.map(card => {
            const Icon = card.icon;
            return (
              <TouchableOpacity
                key={card.id}
                activeOpacity={0.8}
                onPress={() => {
                  switch (card.id) {
                    case 'arena':
                      router.push({ pathname: '/unified/arena', params: { stage: 'Prelims' } });
                      break;
                    case 'pyq':
                      router.push({ pathname: '/pyq', params: { fromTab: 'prelims' } });
                      break;
                    case 'syllabus':
                      router.push('/tracker');
                      break;
                    case 'analyse':
                      router.push('/analyse');
                      break;
                    case 'revision-tags':
                      setCurrentScreen('revision-tags');
                      break;
                  }
                }}
                style={[
                  styles.figmaCard,
                  {
                    backgroundColor: !isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(30, 41, 59, 0.55)',
                    borderColor: !isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.15)',
                    width: isTablet ? '48%' : '48.3%',
                    padding: isTablet ? 24 : 14,
                  }
                ]}
              >
                <View style={styles.cardContentLayoutVertical}>
                  <View style={[
                    styles.figmaIconBox,
                    {
                      backgroundColor: card.color,
                      width: isTablet ? 64 : 48,
                      height: isTablet ? 64 : 48,
                    }
                  ]}>
                    <Icon size={isTablet ? 30 : 22} color="#ffffff" />
                  </View>
                  <View style={styles.cardTextContainerVertical}>
                    <Text style={[
                      styles.figmaCardTitle,
                      {
                        color: colors.textPrimary,
                        fontSize: isTablet ? 18 : 13.5,
                        marginTop: 4,
                      }
                    ]}>
                      {card.title}
                    </Text>
                    <Text style={[
                      styles.figmaCardDesc,
                      {
                        color: colors.textSecondary,
                        fontSize: isTablet ? 12 : 9.5,
                        lineHeight: isTablet ? 16 : 12,
                      }
                    ]}>
                      {card.description}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Recent Topics */}
        <View style={styles.recentTopicsContainer}>
          <Text style={[styles.recentTitle, { color: colors.textSecondary, textAlign: 'center' }]}>Popular Subjects</Text>
          <View style={styles.topicsRowCentered}>
            {recentTopics.map(topic => (
              <TouchableOpacity
                key={topic}
                onPress={() => router.push({ pathname: '/unified/arena', params: { subject: topic, stage: 'Prelims' } })}
                style={[
                  styles.topicChip,
                  {
                    backgroundColor: !isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(30, 41, 59, 0.55)',
                    borderColor: !isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 255, 255, 0.15)'
                  }
                ]}
              >
                <Text style={[styles.topicChipText, { color: colors.textSecondary, fontSize: isTablet ? 13 : 11 }]}>{topic}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  premiumText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#d97706',
    letterSpacing: 1,
  },
  hubScroll: {
    padding: 16,
    paddingBottom: 60,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  heroHeading: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 24,
  },
  largeSearchInput: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 8,
  },
  largeSearchText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  figmaCard: {
    borderRadius: 24,
    borderWidth: 1.2,
    elevation: 3,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  cardContentLayoutVertical: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  figmaIconBox: {
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 2,
  },
  cardTextContainerVertical: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  figmaCardTitle: {
    fontWeight: '800',
    textAlign: 'center',
  },
  figmaCardDesc: {
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  recentTopicsContainer: {
    marginTop: 32,
  },
  recentTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
    marginLeft: 4,
  },
  topicsRowCentered: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  topicChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  topicChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

export default function PrelimsScreenWithGate() {
  return (
    <FeatureGate feature="prelims" featureLabel="Prelims Hub">
      <PrelimsScreen />
    </FeatureGate>
  );
}
