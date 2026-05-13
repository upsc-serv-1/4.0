import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Dimensions,
} from 'react-native';
import { X, BookOpen, Target, BarChart2, BarChart3, Layers, Tag, FileText, PenTool, Sparkles, Compass, Globe, RotateCcw, LayoutList, Search, Brain, Zap, Star, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

interface FeatureSection {
  icon: any;
  color: string;
  title: string;
  tagline: string;
  description: string;
  highlights: string[];
}

const FEATURES: FeatureSection[] = [
  {
    icon: Target,
    color: '#ef4444',
    title: 'Arena',
    tagline: 'Your Battlefield for Daily Practice',
    description: 'The central hub where you attempt quizzes, practice questions, and take full-length tests. Choose subjects, sections, and micro-topics to create custom practice sessions. Switch between Learning Mode (instant feedback) and Exam Mode (timed, simulated paper).',
    highlights: [
      'Filters by subject, section group, micro-topic, institute, PYQ year & more',
      'Learning Mode — reveal answers instantly with explanations',
      'Exam/Simulation Mode — full-screen question paper layout',
      'AI-powered search across 20,000+ questions',
    ],
  },
  {
    icon: BarChart2,
    color: '#14b8a6',
    title: 'Analyse',
    tagline: 'Deep Performance Analytics & Trends',
    description: 'Review every test you\'ve taken with detailed metrics. View your accuracy, score trajectory over time, subject proficiency, fatigue patterns, and negative marking penalties. Export full analysis reports with multi-institute explanations.',
    highlights: [
      'Performance trajectory — track your score history across tests',
      'Subject proficiency map — see accuracy by subject & section',
      'Fatigue & difficulty analysis — spot patterns in performance',
      'Export comprehensive PDF reports with performance summaries',
    ],
  },
  {
    icon: Layers,
    color: '#8b5cf6',
    title: 'Flashcards',
    tagline: 'Smart Spaced Repetition for Revision',
    description: 'Convert any question into a flashcard with one tap. Organise flashcards into custom branches and folders. The built-in spaced repetition algorithm ensures you revise topics at optimal intervals for long-term retention.',
    highlights: [
      'One-tap flashcard creation from any question',
      'Organise into branches & folders by subject/topic',
      'Spaced repetition for efficient revision',
      'AI-powered flashcard generation from study material',
    ],
  },
  {
    icon: BarChart3,
    color: '#f59e0b',
    title: 'PYQ Analysis',
    tagline: 'Master Previous Year Questions',
    description: 'Browse and analyse all UPSC CSE, Allied, and State PSC previous year questions. Filter by exam year, subject, section group, and micro-topic. View multi-institute explanations side-by-side and export curated question banks.',
    highlights: [
      'All UPSC CSE PYQs (2013-present) with multi-institute answers',
      'Explanations from Vision IAS, Forum IAS, Vajiram, Next IAS & more',
      'Fuzzy dedup — same question from different institutes merged',
      'Export PYQ banks with custom filters and institute selection',
    ],
  },
  {
    icon: Star,
    color: '#f59e0b',
    title: '⭐ My Vitamin',
    tagline: 'Your Personalised Best Answer',
    description: 'Create your own "Vitamin" — a personalised best answer for any question. Combine explanations from multiple institutes, add your own insights, and save it as your definitive answer. Switch between institute answers and your Vitamin with one tap.',
    highlights: [
      'Create personalised best answers from multiple sources',
      'Combine institute explanations with your own insights',
      'One-tap toggle between institute answers & your Vitamin',
      'Export your Vitamins alongside question banks',
    ],
  },
  {
    icon: Zap,
    color: '#8b5cf6',
    title: '⚡ AI Features',
    tagline: 'Artificial Intelligence Throughout',
    description: 'AI is deeply integrated into the app — from expanding search queries to generating explanations, summarising notes, creating flashcards, and analysing your performance. Multiple AI providers supported: Gemini, Groq, OpenRouter, and DeepSeek.',
    highlights: [
      'AI Explain — get detailed AI-generated explanations for any question',
      'AI Chat — have a conversation about any question or note',
      'AI Summarise — auto-summarise long explanations',
      'AI Flashcard — generate flashcards from any content',
      'AI Search — semantic understanding of your queries',
      'Switch between Gemini, Groq, OpenRouter & DeepSeek',
    ],
  },
  {
    icon: LayoutList,
    color: '#f97316',
    title: 'Syllabus',
    tagline: 'Track Your Syllabus Progress',
    description: 'Visual syllabus tracker that shows your coverage and mastery across subjects, section groups, and micro-topics. Identify weak areas instantly and plan your study schedule effectively.',
    highlights: [
      'Visual progress tracking across the full syllabus',
      'Mastery indicators by subject, section & micro-topic',
      'Identify weak areas with <50% accuracy highlights',
      'Plan focussed revision on uncovered topics',
    ],
  },
  {
    icon: Search,
    color: '#6366f1',
    title: 'Search',
    tagline: 'AI-Powered Semantic Search',
    description: 'Search 20,000+ questions using natural language. The AI understands your intent and expands your query into related keywords for comprehensive results. Exact matches appear first, followed by semantic matches.',
    highlights: [
      'Natural language search — type as you think',
      'AI expands your query into smart keywords',
      'Exact matches ranked first, then semantic matches',
      'Filters by subject, exam year, PYQ status & more',
    ],
  },
  {
    icon: Globe,
    color: '#ec4899',
    title: 'Ghost Browser',
    tagline: 'Incognito Question Browser',
    description: 'Browse and search questions anonymously without saving progress or creating attempt records. Perfect for quick lookups, exploring topics, or demonstrating the app without affecting your analytics.',
    highlights: [
      'Anonymous question browsing — no tracking',
      'Full search with keyword highlighting',
      'View multi-institute explanations',
      'Ideal for quick reference & exploration',
    ],
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AppInfoGuide({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>App Guide</Text>
            <Text style={[styles.headerSub, { color: colors.textTertiary }]}>
              Everything you need to know about Dr. UPSC
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.surfaceStrong }]}>
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.heroEmoji]}>📚</Text>
            <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Welcome to Dr. UPSC</Text>
            <Text style={[styles.heroDesc, { color: colors.textSecondary }]}>
              Your complete UPSC preparation companion. Practice questions, analyse performance,
              take notes, create flashcards — all powered by AI. Here's a tour of everything you can do.
            </Text>
          </View>

          {/* Feature Cards */}
          {FEATURES.map((feature, idx) => {
            const Icon = feature.icon;
            const isExpanded = expandedIndex === idx;

            return (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.7}
                onPress={() => setExpandedIndex(isExpanded ? null : idx)}
                style={[styles.featureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.featureHeader}>
                  <View style={[styles.iconWrap, { backgroundColor: feature.color + '18' }]}>
                    <Icon size={22} color={feature.color} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>{feature.title}</Text>
                    <Text style={[styles.featureTagline, { color: colors.textTertiary }]}>{feature.tagline}</Text>
                  </View>
                  <ChevronRight
                    size={18}
                    color={colors.textTertiary}
                    style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
                  />
                </View>

                {isExpanded && (
                  <View style={[styles.featureBody, { borderTopColor: colors.border }]}>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                      {feature.description}
                    </Text>
                    <View style={styles.highlightsList}>
                      {feature.highlights.map((h, i) => (
                        <View key={i} style={styles.highlightRow}>
                          <View style={[styles.bullet, { backgroundColor: feature.color }]} />
                          <Text style={[styles.highlightText, { color: colors.textPrimary }]}>{h}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Footer */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: '900' },
  headerSub: { fontSize: 13, marginTop: 2 },
  closeBtn: { padding: 8, borderRadius: 20 },
  scroll: { padding: 16 },
  heroCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  heroEmoji: { fontSize: 40, marginBottom: 8 },
  heroTitle: { fontSize: 20, fontWeight: '900', marginBottom: 6 },
  heroDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  featureCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: { fontSize: 16, fontWeight: '800' },
  featureTagline: { fontSize: 12, marginTop: 2 },
  featureBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  featureDesc: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  highlightsList: { gap: 8 },
  highlightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bullet: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  highlightText: { fontSize: 12, flex: 1, lineHeight: 17 },
});
