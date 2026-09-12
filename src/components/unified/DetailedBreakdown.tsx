import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager, ScrollView, useWindowDimensions } from 'react-native';
import { 
  ChevronDown, ChevronRight, BookOpen, Layers, Target, 
  TrendingUp, History, Scale, Globe, Leaf, FlaskConical, 
  Sprout, Globe2, Newspaper 
} from 'lucide-react-native';
import { HierarchicalPerformance, PerformanceStats } from '../../lib/hierarchical-analytics';
import { StatusMeter } from './StatusMeter';
import { spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface DetailedBreakdownProps {
  performance: HierarchicalPerformance | null;
}

const getSubjectIcon = (subject: string, color: string) => {
  const s = subject.toLowerCase();
  const props = { size: 18, color };
  
  if (s.includes('history')) return <History {...props} />;
  if (s.includes('economy')) return <TrendingUp {...props} />;
  if (s.includes('polity')) return <Scale {...props} />;
  if (s.includes('geography')) return <Globe {...props} />;
  if (s.includes('environment')) return <Leaf {...props} />;
  if (s.includes('science')) return <FlaskConical {...props} />;
  if (s.includes('agriculture')) return <Sprout {...props} />;
  if (s.includes('international') || s.includes('ir')) return <Globe2 {...props} />;
  if (s.includes('current') || s.includes('news')) return <Newspaper {...props} />;
  
  return <BookOpen {...props} />;
};

export const DetailedBreakdown = ({ performance }: DetailedBreakdownProps) => {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const isWide = width > 768;

  if (!performance) return null;

  const toggleSubject = (name: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSubjects(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const toggleSection = (name: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSections(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const renderStats = (stats: PerformanceStats, isSmall = false) => (
    <View style={[styles.statsRow, isSmall && { marginBottom: 8, marginTop: 8 }]}>
      <View style={styles.statItem}>
        <View style={[styles.statDot, { backgroundColor: '#10b981' }, isSmall && { width: 6, height: 6 }]} />
        <Text style={[styles.statText, { color: colors.textSecondary }, isSmall && { fontSize: 10 }]}>{stats.correct} Correct</Text>
      </View>
      <View style={styles.statItem}>
        <View style={[styles.statDot, { backgroundColor: '#ef4444' }, isSmall && { width: 6, height: 6 }]} />
        <Text style={[styles.statText, { color: colors.textSecondary }, isSmall && { fontSize: 10 }]}>{stats.incorrect} Incorrect</Text>
      </View>
      <View style={styles.statItem}>
        <View style={[styles.statDot, { backgroundColor: '#94a3b8' }, isSmall && { width: 6, height: 6 }]} />
        <Text style={[styles.statText, { color: colors.textSecondary }, isSmall && { fontSize: 10 }]}>{stats.unattempted} Skipped</Text>
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.header, { color: colors.textTertiary }]}>SUBJECT BREAKDOWN</Text>
      
      <View style={isWide ? styles.wideGrid : null}>
        {Object.values(performance.subjects).map((subject) => (
          <View 
            key={subject.name} 
            style={[
              styles.card, 
              { backgroundColor: colors.surface, borderColor: colors.border },
              isWide && styles.wideCard
            ]}
          >
            <TouchableOpacity 
              style={styles.cardHeader} 
              onPress={() => toggleSubject(subject.name)}
              activeOpacity={0.7}
            >
              <View style={styles.headerInfo}>
                <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                  {getSubjectIcon(subject.name, colors.primary)}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.subjectName, { color: colors.textPrimary }]} numberOfLines={1}>{subject.name}</Text>
                  <Text style={[styles.subjectMeta, { color: colors.textTertiary }]}>
                    {subject.accuracy}% ACCURACY • {subject.total} QUESTIONS
                  </Text>
                </View>
              </View>
              {expandedSubjects[subject.name] ? (
                <ChevronDown size={20} color={colors.textTertiary} />
              ) : (
                <ChevronRight size={20} color={colors.textTertiary} />
              )}
            </TouchableOpacity>

            <View style={styles.cardContent}>
              <StatusMeter 
                correct={subject.correct} 
                incorrect={subject.incorrect} 
                skipped={subject.unattempted} 
                total={subject.total} 
                height={8} 
              />
              
              {expandedSubjects[subject.name] && (
                <View style={styles.expandedContent}>
                  {renderStats(subject)}
                  
                  <View style={[styles.divider, { backgroundColor: colors.border + '40' }]} />
                  
                  {Object.values(subject.sectionGroups).map((section) => (
                    <View key={section.name} style={styles.sectionContainer}>
                      <TouchableOpacity 
                        style={styles.sectionHeader}
                        onPress={() => toggleSection(section.name)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.sectionTitleRow}>
                          <Layers size={14} color={colors.textTertiary} />
                          <Text style={[styles.sectionName, { color: colors.textSecondary }]}>{section.name}</Text>
                        </View>
                        <Text style={[styles.sectionRatio, { color: colors.textTertiary }]}>
                          {section.correct}/{section.total} Correct
                        </Text>
                      </TouchableOpacity>
                      
                      <StatusMeter 
                        correct={section.correct} 
                        incorrect={section.incorrect} 
                        skipped={section.unattempted} 
                        total={section.total} 
                        height={4} 
                      />
                      {renderStats(section, true)}

                      {expandedSections[section.name] && (
                        <View style={styles.microTopicsContainer}>
                          {Object.values(section.microTopics).map((topic) => (
                            <View key={topic.name} style={styles.microTopicContainer}>
                              <View style={styles.microTopicHeader}>
                                <View style={styles.microTopicTitleRow}>
                                  <Target size={12} color={colors.textTertiary} />
                                  <Text style={[styles.microTopicName, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {topic.name}
                                  </Text>
                                </View>
                                <Text style={[styles.sectionRatio, { color: colors.textTertiary }]}>
                                  {topic.correct}/{topic.total} Correct
                                </Text>
                              </View>
                              
                              <StatusMeter 
                                correct={topic.correct} 
                                incorrect={topic.incorrect} 
                                skipped={topic.unattempted} 
                                total={topic.total} 
                                height={4} 
                              />
                              {renderStats(topic, true)}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  wideGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: spacing.md,
    overflow: 'hidden',
    width: '100%',
  },
  wideCard: {
    width: '48.5%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '900',
  },
  subjectMeta: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  cardContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  expandedContent: {
    marginTop: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statText: {
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginBottom: spacing.lg,
  },
  sectionContainer: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionName: {
    fontSize: 13,
    fontWeight: '800',
  },
  sectionRatio: {
    fontSize: 10,
    fontWeight: '700',
  },
  microTopicsContainer: {
    marginTop: 12,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#f1f5f9',
  },
  microTopicContainer: {
    marginBottom: 16,
  },
  microTopicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  microTopicTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  microTopicName: {
    fontSize: 12,
    fontWeight: '700',
  },

});
