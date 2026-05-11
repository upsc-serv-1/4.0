import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Dimensions, Modal, Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import { useAggregateTestAnalytics } from '../../hooks/useTestAnalytics';
import { LineChart, RadarChart, BarChart, DonutChart, ScatterPlot } from '../Charts';
import { prelimsTaxonomy } from '../../data/taxonomy';
import {
  AlertTriangle, TrendingUp, Filter, Lightbulb, Clock,
  BarChart2 as BarChartIcon, Target, Download,
  CheckCircle2, XCircle, HelpCircle, BarChart3, Trash2,
} from 'lucide-react-native';
import { DEFAULT_ANALYTICS_LAYOUT, loadAnalyticsLayout } from '../../utils/analyticsLayout';
import {
  buildAggregateHierarchicalAccuracy,
  buildAggregateTestTrends,
  evaluateRepeatedWeaknesses,
} from '../../lib/hierarchical-analytics';
import { AnalysisExportSheet, AnalysisExportQuestion } from '../export/AnalysisExportSheet';
import { buildPredictive, probableHotsFor2026 } from '../../lib/pyqPredictive';
import { supabase } from '../../lib/supabase';

interface AnalyseSectionProps {
  userId: string;
}

export const AnalyseSection = ({ userId }: AnalyseSectionProps) => {
  const { colors } = useTheme();
  const {
    loading,
    error,
    trends,
    cumulativeHierarchy,
    repeatedWeaknesses,
    allQuestions,
    rawAllQuestions,
    rawAttemptsForTrend,
  } = useAggregateTestAnalytics(userId);

  const screenWidth = Dimensions.get('window').width;
  const isCompactScreen = screenWidth < 390;

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(['All']);
  const [statusFilter, setStatusFilter] = useState<'all' | 'correct' | 'incorrect' | 'skipped'>('all');
  const [heatmapMode, setHeatmapMode] = useState<'mastery' | 'accuracy'>('mastery');
  const [sectionOrder, setSectionOrder] = useState<string[]>(DEFAULT_ANALYTICS_LAYOUT.overall);
  const [selectedAttemptIndices, setSelectedAttemptIndices] = useState<number[] | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isExportSheetVisible, setIsExportSheetVisible] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<string[]>([]);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Heatmap drill-down state
  const [heatmapSubject, setHeatmapSubject] = useState<string | null>(null);
  const [heatmapSection, setHeatmapSection] = useState<string | null>(null);
  const [allUserTags, setAllUserTags] = useState<string[]>([]);
  const scrollRef = React.useRef<ScrollView>(null);
  const [heatmapY, setHeatmapY] = useState(0);

  useEffect(() => {
    // Fetch all user revision tags for global context in export
    const fetchTags = async () => {
      try {
        const { data } = await supabase.from('question_states')
          .select('review_tags')
          .eq('user_id', userId)
          .not('review_tags', 'is', null);
        
        const tags = new Set<string>();
        data?.forEach(row => {
          if (Array.isArray(row.review_tags)) row.review_tags.forEach(t => tags.add(t));
        });
        setAllUserTags(Array.from(tags).sort());
      } catch (e) {
        console.error("Error fetching global tags", e);
      }
    };
    fetchTags();
  }, [userId]);

  useEffect(() => {
    loadAnalyticsLayout().then(layout => {
      const order = layout.overall;
      if (!order.includes('highlights')) {
        setSectionOrder(['highlights', ...order]);
      } else {
        setSectionOrder(order);
      }
    });
  }, []);

  const filteredAggregate = useMemo(() => {
    const safeAttempts = rawAttemptsForTrend || [];
    const safeQuestions =
      (Array.isArray(allQuestions) && allQuestions.length > 0
        ? allQuestions
        : rawAllQuestions) || [];

    if (safeAttempts.length === 0 || safeQuestions.length === 0) {
      return null;
    }

    const fullTrends = buildAggregateTestTrends(safeAttempts);
    const allScores = fullTrends?.historicalScores || [];

    const selectedTestIds = selectedAttemptIndices && selectedAttemptIndices.length > 0
      ? new Set(
          allScores
            .filter(item => selectedAttemptIndices.includes(item.attemptIndex))
            .map(item => item.testId)
        )
      : new Set(allScores.map(item => item.testId));

    const filteredAttempts = safeAttempts.filter(attempt => selectedTestIds.has(attempt.test_id));
    let filteredQuestions = safeQuestions.filter(question => question?.testId && selectedTestIds.has(question.testId));

    if (!selectedSubjects.includes('All')) {
      filteredQuestions = filteredQuestions.filter(q => {
        const matchesPYQ = selectedSubjects.includes('PYQ') && q.isPyq;
        const matchesSubject = selectedSubjects.includes(q.subject);
        return matchesPYQ || matchesSubject;
      });
    }

    if (statusFilter !== 'all') {
      filteredQuestions = filteredQuestions.filter(q => {
        const isCorrect = q.selectedAnswer?.toLowerCase() === q.correctAnswer?.toLowerCase() && !!q.selectedAnswer;
        const isIncorrect = q.selectedAnswer?.toLowerCase() !== q.correctAnswer?.toLowerCase() && !!q.selectedAnswer;
        const isSkipped = !q.selectedAnswer;

        if (statusFilter === 'correct') return isCorrect;
        if (statusFilter === 'incorrect') return isIncorrect;
        if (statusFilter === 'skipped') return isSkipped;
        return true;
      });
    }

    let historicalScores = [];
    if (selectedSubjects.includes('All') && statusFilter === 'all') {
      historicalScores = buildAggregateTestTrends(filteredAttempts).historicalScores;
    } else {
      const trendsByTest: Record<string, { correct: number, total: number }> = {};
      filteredQuestions.forEach(q => {
        if (!trendsByTest[q.testId]) trendsByTest[q.testId] = { correct: 0, total: 0 };
        if (q.selectedAnswer === q.correctAnswer) trendsByTest[q.testId].correct++;
        if (q.selectedAnswer) trendsByTest[q.testId].total++;
      });

      historicalScores = filteredAttempts.map((attempt) => {
        const stats = trendsByTest[attempt.test_id] || { correct: 0, total: 0 };
        return {
          attemptIndex: attempt.attemptIndex,
          testId: attempt.test_id,
          title: attempt.title,
          date: attempt.submitted_at,
          score: attempt.score,
          accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
          totalQuestionsAttempted: stats.total
        };
      });
    }

    const filteredTrends = {
       ...buildAggregateTestTrends(filteredAttempts),
       historicalScores
    };

    const filteredCumulativeHierarchy = buildAggregateHierarchicalAccuracy(filteredQuestions);
    const filteredRepeatedWeaknesses = evaluateRepeatedWeaknesses(filteredAttempts, filteredQuestions);

    return {
      trends: filteredTrends,
      cumulativeHierarchy: filteredCumulativeHierarchy,
      repeatedWeaknesses: filteredRepeatedWeaknesses,
      filteredQuestions,
    };
  }, [selectedAttemptIndices, rawAttemptsForTrend, allQuestions, rawAllQuestions, statusFilter, selectedSubjects]);

  const activeTrends = filteredAggregate?.trends || trends;
  const activeCumulative = filteredAggregate?.cumulativeHierarchy || cumulativeHierarchy;
  const activeWeaknesses = filteredAggregate?.repeatedWeaknesses || repeatedWeaknesses;
  const activeQuestionsForExport = filteredAggregate?.filteredQuestions
    || (Array.isArray(allQuestions) && allQuestions.length > 0 ? allQuestions : rawAllQuestions)
    || [];

  // Map QuestionAttempt → AnalysisExportQuestion for the sheet.
  const exportQuestions: AnalysisExportQuestion[] = useMemo(() => {
    return (activeQuestionsForExport || []).map((q: any) => ({
      id: String(q.id),
      question_text: q.question_text || q.statement || '',
      options: q.options,
      correct_answer: q.correctAnswer || q.correct_answer,
      selected_answer: q.selectedAnswer || q.selected_answer,
      is_correct: (q.selectedAnswer ?? q.selected_answer)
        ? String(q.selectedAnswer || q.selected_answer).toLowerCase() === String(q.correctAnswer || q.correct_answer || '').toLowerCase()
        : undefined,
      explanation_markdown: q.explanation_markdown,
      explanation: q.explanation,
      subject: q.subject || 'General',
      section_group: q.sectionGroup || q.section_group || 'General',
      micro_topic: q.microTopic || q.micro_topic || 'Other',
      exam_year: q.examYear || q.exam_year,
      is_pyq: !!q.isPyq || !!q.is_pyq,
      is_ncert: !!q.is_ncert,
      difficulty: q.difficultyLevel || q.difficulty,
      time_taken_seconds: q.timeSpentSeconds || q.time_taken_seconds,
    }));
  }, [activeQuestionsForExport]);

  const buildForecastRows = (rows: AnalysisExportQuestion[]) => {
    const predictive = buildPredictive(
      rows,
      (q: any) => Number(q.exam_year) || null,
      { level: 'micro_topic' }
    );
    const hots = probableHotsFor2026(predictive, 1, 12);
    return hots.map((row) => ({
      key: row.key,
      label: row.key,
      totalQuestions: row.totalQuestions,
      streak: row.streak,
      trend: row.trend,
      forecastPoint: row.forecast2026.point,
      forecastLow: row.forecast2026.low,
      forecastHigh: row.forecast2026.high,
      hotScore: row.hotScore,
    }));
  };

  const handleDeleteTests = async () => {
    if (selectedForDelete.length === 0) return;
    
    setIsDeleting(true);
    try {
      for (const attemptId of selectedForDelete) {
        await supabase.from('question_states').delete().eq('attempt_id', attemptId);
        await supabase.from('test_attempts').delete().eq('id', attemptId);
      }
      
      setIsDeleteMode(false);
      setSelectedForDelete([]);
      setIsDeleteConfirmVisible(false);
      
      Alert.alert('Success', 'Tests deleted successfully. Refreshing analytics...');
      setTimeout(() => window.location.reload?.(), 500);
    } catch (err) {
      console.error('Error deleting tests:', err);
      Alert.alert('Error', 'Failed to delete tests. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading && !activeTrends) {
    return (
      <View style={[styles.center, { padding: spacing.xl }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>Computing Analytics...</Text>
      </View>
    );
  }

  if (error || !activeTrends || !activeCumulative) {
    return (
      <View style={[styles.center, { padding: spacing.xl, marginTop: 40 }]}>
        <AlertTriangle color={colors.error} size={40} opacity={0.6} />
        <Text style={{ color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center', fontWeight: '900' }}>
          No Analytics Data Yet
        </Text>
        <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
          Finish more tests in the Unified Arena to see your overall performance trends.
        </Text>
      </View>
    );
  }

  const subjects = Object.keys(activeCumulative.subjects).sort();
  const allAvailableSubjects = Object.keys(cumulativeHierarchy.subjects).sort();
  const activePerf = activeCumulative?.overall || { accuracy: 0, total: 0, advanced: { errors: {}, confidence: {}, difficulty: {}, fatigue: {} } };
  const subjectsWithData = subjects.filter(s => activeCumulative.subjects[s].total > 0);
  const proficiencyData = subjectsWithData.map(s => ({
    subject: s,
    accuracy: activeCumulative.subjects[s].accuracy,
    count: activeCumulative.subjects[s].total
  }));

  const drillDownItems: { name: string; accuracy: number; total: number; isSection?: boolean }[] = [];

  const isSingleSubject = selectedSubjects.length === 1 && selectedSubjects[0] !== 'All' && selectedSubjects[0] !== 'PYQ';

  if (!isSingleSubject) {
    subjectsWithData.forEach(s => {
      drillDownItems.push({ name: s, accuracy: activeCumulative.subjects[s].accuracy, total: activeCumulative.subjects[s].total });
    });
  } else {
    const subName = selectedSubjects[0];
    const sub = activeCumulative.subjects[subName];
    if (sub) {
      Object.values(sub.sectionGroups || {}).forEach(sg => {
        drillDownItems.push({ name: sg.name, accuracy: sg.accuracy, total: sg.total, isSection: true });
      });
    }
  }
  drillDownItems.sort((a, b) => a.accuracy - b.accuracy);

  const selectedTestsLabel = !selectedAttemptIndices
    ? "All Tests"
    : selectedAttemptIndices.length === 1
      ? `1 Test (#${selectedAttemptIndices[0]})`
      : `${selectedAttemptIndices.length} Tests`;

  const sectionBlocks: Record<string, React.ReactNode> = {
    highlights: (
      <View key="highlights" style={styles.highlightRow}>
        <View style={[styles.highlightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.highlightLabel, { color: colors.textTertiary }]}>Overall Accuracy</Text>
          <Text style={[styles.highlightValue, { color: colors.primary }]}>{activeCumulative?.overall?.accuracy || 0}%</Text>
        </View>
        <View style={[styles.highlightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.highlightLabel, { color: colors.textTertiary }]}>Tests Analyzed</Text>
          <Text style={[styles.highlightValue, { color: colors.textPrimary }]}>{activeTrends.historicalScores.length}</Text>
        </View>
      </View>
    ),
    smart_insight: (
      <View key="smart_insight" style={[styles.insightCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Lightbulb color={colors.primary} size={18} />
          <Text style={[styles.insightTitle, { color: colors.primary }]}>Growth Insight</Text>
        </View>
        <Text style={[styles.insightText, { color: colors.textPrimary }]}>
          {activeTrends.historicalScores.length < 3
            ? "Complete at least 3 tests to unlock deeper trajectory and fatigue analysis."
            : activeTrends.historicalScores[activeTrends.historicalScores.length-1].accuracy > activeTrends.historicalScores[0].accuracy
              ? "Your accuracy is trending upwards! Focus on maintaining consistency in your 'Logical Elimination' zones."
              : "Stability is key. Reviewing your mistake patterns from the last 5 tests could reveal hidden concept gaps."}
        </Text>
      </View>
    ),
    repeated_weaknesses: activeWeaknesses.length > 0 ? (
      <View key="repeated_weaknesses" style={[styles.chartCard, { backgroundColor: '#fff7ed', borderColor: '#fdba74' }]}>
        <View style={styles.cardHeader}>
          <AlertTriangle size={18} color="#f97316" />
          <Text style={[styles.cardTitle, { color: '#9a3412' }]}>Repeated Weakness Tracker</Text>
        </View>
        <Text style={[styles.cardSubtitle, { color: '#9a3412', opacity: 0.8 }]}>
          Sections where you've scored below 50% in multiple recent attempts.
        </Text>
        <View style={{ gap: 8 }}>
          {activeWeaknesses.slice(0, 3).map((w, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f97316' }} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#9a3412' }}>{w}</Text>
            </View>
          ))}
        </View>
      </View>
    ) : null,
    performance_trajectory: (
      <View key="performance_trajectory" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <TrendingUp size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Performance Trajectory</Text>
        </View>
        <Text style={[styles.chartSubLabel, { color: colors.textTertiary, marginBottom: 8 }]}>Overall Score Trajectory</Text>
        <LineChart
          data={[{ label: 'Score', values: activeTrends.historicalScores.map(t => t.score) }]}
          labels={activeTrends.historicalScores.map(t => {
            const name = t.title && t.title !== `Attempt #${t.attemptIndex}` ? t.title : '';
            const short = name.length > 18 ? name.slice(0, 18) + '…' : name;
            return short ? `#${t.attemptIndex} (${short})` : `#${t.attemptIndex}`;
          })}
          height={180}
          colors={[colors.primary]}
          stickyY={true}
          backgroundColor={colors.surface}
        />
        <View style={styles.chartDivider} />
        <Text style={[styles.chartSubLabel, { color: colors.textTertiary, marginBottom: 8 }]}>Negative Marking Penalty</Text>
        <LineChart
          data={[{ label: 'Penalty', values: activeTrends.negativeMarkingTrends.map(t => t.negativeMarksPenalty) }]}
          labels={activeTrends.historicalScores.map(t => {
            const name = t.title && t.title !== `Attempt #${t.attemptIndex}` ? t.title : '';
            const short = name.length > 18 ? name.slice(0, 18) + '…' : name;
            return short ? `#${t.attemptIndex} (${short})` : `#${t.attemptIndex}`;
          })}
          height={180}
          colors={['#ef4444']}
          stickyY={true}
          backgroundColor={colors.surface}
        />
      </View>
    ),
    subject_proficiency: proficiencyData.length > 0 ? (
      <View key="subject_proficiency" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Target size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            {!isSingleSubject ? 'Subject Proficiency Map' : `${selectedSubjects[0]} Section Map`}
          </Text>
        </View>
        <RadarChart
          data={!isSingleSubject
            ? proficiencyData.map(p => ({ label: p.subject, value: p.accuracy }))
            : Object.values(activeCumulative.subjects[selectedSubjects[0]]?.sectionGroups || {})
                .filter(sg => sg.total > 0)
                .map(sg => ({ label: sg.name, value: sg.accuracy }))
          }
          size={240}
          onPress={(label) => {
            if (!isSingleSubject) {
              setSelectedSubjects([label]);
            } else {
              setHeatmapSubject(selectedSubjects[0]);
              setHeatmapSection(label);
              // Scroll to heatmap with a small offset
              setTimeout(() => {
                scrollRef.current?.scrollTo({ y: heatmapY + 150, animated: true });
              }, 100);
            }
          }}
        />
      </View>
    ) : null,
    elimination_zone: (
      <View key="elimination_zone" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Target size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>The Elimination Zone</Text>
        </View>
        <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Score vs. Questions Attempted (Efficiency Analysis)</Text>
        <ScatterPlot
          data={activeTrends.historicalScores
            .filter(t => t.totalQuestionsAttempted !== undefined && t.score !== undefined)
            .map(t => ({ x: t.totalQuestionsAttempted, y: t.score }))}
          height={200}
        />
      </View>
    ),
    theme_heatmap: (selectedSubjects.includes('All') || selectedSubjects.includes('PYQ') || isSingleSubject) ? (() => {
      const allScores = activeTrends.historicalScores;
      const testsToDisplay = selectedAttemptIndices && selectedAttemptIndices.length > 0
        ? allScores.filter(t => selectedAttemptIndices.includes(t.attemptIndex))
        : allScores;

      const renderHeatmap = (title: string, dataRows: any[], level: 'subject' | 'section' | 'micro', onRowPress?: (name: string) => void) => {
        if (dataRows.length === 0) return null;
        
        return (
          <View key={`heatmap-${level}`} style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: spacing.md }]}>
            <View style={styles.cardHeader}>
              <BarChart3 size={18} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{title}</Text>
            </View>
            <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
              {/* Frozen First Column (Labels) */}
              <View style={{ width: 100, zIndex: 10, backgroundColor: colors.surface }}>
                <View style={styles.heatmapRow}>
                  <View style={[styles.heatmapCell, styles.heatmapHeaderCell, { width: 100 }]} />
                </View>
                {dataRows.map((item, rowIndex) => (
                  <TouchableOpacity 
                    key={`sticky-${rowIndex}`} 
                    style={styles.heatmapRow}
                    onPress={() => onRowPress?.(item.name)}
                    disabled={!onRowPress}
                  >
                    <View style={[styles.heatmapCell, styles.heatmapHeaderCell, { width: 100 }]}>
                      <Text style={[styles.heatmapRowTitle, { color: onRowPress ? colors.primary : colors.textPrimary }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Scrollable Data Columns */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.heatmapGrid}>
                  <View style={styles.heatmapRow}>
                    {testsToDisplay.map((t, i) => {
                      const hasCustomTitle = t.title && t.title !== `Attempt #${t.attemptIndex}`;
                      const shortTitle = hasCustomTitle ? (t.title!.length > 8 ? t.title!.slice(0, 8) + '…' : t.title!) : '';
                      return (
                        <View key={`header-${i}`} style={[styles.heatmapCell, { width: 50, backgroundColor: 'transparent' }]}>
                          <Text style={[styles.heatmapHeaderText, { color: colors.textSecondary, width: 50, marginRight: 0 }]}>#{t.attemptIndex}</Text>
                          {shortTitle ? <Text style={[styles.heatmapHeaderText, { color: colors.textTertiary, width: 50, marginRight: 0, fontSize: 7 }]} numberOfLines={1}>{shortTitle}</Text> : null}
                        </View>
                      );
                    })}
                  </View>

                  {dataRows.map((item, rowIndex) => (
                    <View key={`row-${rowIndex}`} style={styles.heatmapRow}>
                      {testsToDisplay.map((t, colIndex) => {
                        // In a real app, we'd fetch actual per-test category accuracy here.
                        // For now, we simulate using the aggregate + attempt variance.
                        const attemptRatio = t.accuracy / 100;
                        const cellAcc = Math.max(0, Math.min(100, item.accuracy * (0.8 + (attemptRatio * 0.4))));
                        const ratio = cellAcc / 100;
                        let bgColor = colors.surfaceStrong;
                        let textColor = colors.textTertiary;
                        if (cellAcc > 0) {
                          const h = 120; // Green Hue
                          const s = 65 + (ratio * 20);
                          const l = 95 - (ratio * 50);
                          bgColor = `hsl(${h}, ${s}%, ${l}%)`;
                          textColor = l < 55 ? '#ffffff' : '#065f46';
                        }

                        return (
                          <View key={`cell-${rowIndex}-${colIndex}`} style={[styles.heatmapCell, { backgroundColor: bgColor, width: 50 }]}>
                            <Text style={[styles.heatmapCellText, { color: textColor }]}>
                              {Math.round(cellAcc)}%
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        );
      };

      const subjectRows = Object.values(activeCumulative.subjects)
        .filter(s => s.total > 0)
        .sort((a, b) => b.total - a.total);

      const sectionRows = heatmapSubject && activeCumulative.subjects[heatmapSubject]
        ? Object.values(activeCumulative.subjects[heatmapSubject].sectionGroups)
            .filter(sg => sg.total > 0)
            .sort((a, b) => b.total - a.total)
        : [];

      const microRows = (() => {
        if (!heatmapSection || !heatmapSubject) return [];
        
        // Get topics from taxonomy for this section
        const taxonomyTopics = prelimsTaxonomy
          .filter(t => t.subject === heatmapSubject && t.sectionGroup === heatmapSection)
          .map(t => t.microTopic);
        
        const existingMetrics = activeCumulative.subjects[heatmapSubject]?.sectionGroups[heatmapSection]?.microTopics || {};
        
        // Merge taxonomy with actual performance metrics
        const merged = Array.from(new Set([...taxonomyTopics, ...Object.keys(existingMetrics)])).map(mtName => {
          const stats = existingMetrics[mtName] || { correct: 0, incorrect: 0, unattempted: 0, total: 0, accuracy: 0, timeSpent: 0 };
          return { name: mtName, ...stats };
        });

        return merged.sort((a, b) => (b.total || 0) - (a.total || 0));
      })();

      return (
        <View 
          key="theme_heatmap_container" 
          onLayout={(e) => setHeatmapY(e.nativeEvent.layout.y)}
        >
          {renderHeatmap('Subject Mastery Heatmap', subjectRows, 'subject', (name) => {
            setHeatmapSubject(name === heatmapSubject ? null : name);
            setHeatmapSection(null);
          })}
          
          {heatmapSubject && renderHeatmap(`${heatmapSubject}: Themes`, sectionRows, 'section', (name) => {
            setHeatmapSection(name === heatmapSection ? null : name);
          })}

          {heatmapSection && renderHeatmap(`${heatmapSection}: Microtopics`, microRows, 'micro')}
        </View>
      );
    })() : null,
    fatigue_difficulty: (
      <View key="fatigue_difficulty" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Clock size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Fatigue & Difficulty Analysis</Text>
        </View>
        <Text style={[styles.chartSubtitle, { color: colors.textTertiary, marginBottom: 10 }]}>Performance by Test Half</Text>
        <BarChart
          data={Object.entries(activePerf?.advanced?.fatigue || {}).map(([half, stats]) => ({
            label: half === '1' ? 'First Half' : 'Second Half',
            value: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
          }))}
          height={180}
        />
        <View style={styles.chartDivider} />
        <Text style={[styles.chartSubtitle, { color: colors.textTertiary, marginBottom: 10 }]}>Difficulty-wise Accuracy</Text>
        <BarChart
          data={Object.entries(activePerf?.advanced?.difficulty || {}).map(([level, stats]) => ({
            label: level,
            value: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
          }))}
          height={180}
          color={colors.primary + '80'}
        />
      </View>
    ),
    weak_areas: (
      <View key="weak_areas" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <AlertTriangle size={24} color={'#ef4444'} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Weak Areas (&lt;50% Accuracy)</Text>
        </View>

        {activePerf?.advanced?.weakAreas && activePerf.advanced.weakAreas.length > 0 ? (
          <View style={styles.weakList}>
            {activePerf.advanced.weakAreas.map((area, index) => (
              <View key={`${area.name}-${index}`} style={[styles.weakItem, { borderBottomColor: colors.border + '50' }]}>
                <View>
                  <Text style={[styles.weakItemName, { color: colors.textPrimary }]}>{area.name}</Text>
                  <Text style={[styles.weakItemType, { color: colors.textTertiary }]}>{area.type}</Text>
                </View>
                <View style={[styles.weakBadge, { backgroundColor: '#ef444415' }]}>
                  <Text style={[styles.weakBadgeText, { color: '#ef4444' }]}>
                    {area.accuracy}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No major weak areas detected in these tests. Keep it up!
          </Text>
        )}
      </View>
    ),
  };

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={styles.container}>

      {/* Top-right single Export button + compact Filter entry */}
      <View style={[styles.topBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {isDeleteMode ? (
          <>
            <TouchableOpacity
              testID="analysis-cancel-delete-btn"
              onPress={() => {
                setIsDeleteMode(false);
                setSelectedForDelete([]);
              }}
              style={styles.topFilter}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.topLabel, { color: colors.textTertiary }]}>Delete Tests</Text>
                <Text style={[styles.topValue, { color: colors.textPrimary }]} numberOfLines={1}>
                  {selectedForDelete.length === 0 ? 'Select tests' : `${selectedForDelete.length} selected`}
                </Text>
              </View>
            </TouchableOpacity>
            {selectedForDelete.length > 0 && (
              <TouchableOpacity
                onPress={() => setIsDeleteConfirmVisible(true)}
                style={[styles.exportTopBtn, { backgroundColor: '#ef4444' }]}
              >
                <Trash2 color="#fff" size={16} />
                <Text style={styles.exportTopBtnText}>Delete</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <TouchableOpacity
              testID="analysis-filter-btn"
              onPress={() => setIsModalVisible(true)}
              style={styles.topFilter}
            >
              <Filter color={colors.primary} size={16} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.topLabel, { color: colors.textTertiary }]}>Filter Data</Text>
                <Text style={[styles.topValue, { color: colors.textPrimary }]} numberOfLines={1}>{selectedTestsLabel}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              testID="analysis-delete-btn"
              onPress={() => setIsDeleteMode(true)}
              style={[styles.exportTopBtn, { backgroundColor: colors.primary + '40', borderWidth: 1, borderColor: colors.primary }]}
            >
              <Trash2 color={colors.primary} size={16} />
              <Text style={[styles.exportTopBtnText, { color: colors.primary }]}>Select</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="analysis-export-btn"
              onPress={() => setIsExportSheetVisible(true)}
              style={[styles.exportTopBtn, { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6, borderWidth: 1.5, borderColor: '#fff' }]}
            >
              <Download color="#fff" size={16} />
              <Text style={styles.exportTopBtnText}>GET REPORT</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={isDeleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDeleteConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border, padding: spacing.xl }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary, marginBottom: spacing.lg }]}>
              Delete {selectedForDelete.length} Test{selectedForDelete.length > 1 ? 's' : ''}?
            </Text>
            <Text style={[{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg }]}>
              This will permanently delete these tests from Supabase and all trends will be recalculated.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <TouchableOpacity
                onPress={() => setIsDeleteConfirmVisible(false)}
                style={[styles.actionChip, { backgroundColor: colors.bg, borderColor: colors.border, flex: 1 }]}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '700', textAlign: 'center' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteTests}
                disabled={isDeleting}
                style={[styles.actionChip, { backgroundColor: '#ef4444', flex: 1 }]}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center' }}>Delete All</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sticky Filter Bar (Subjects) */}
      <View style={[styles.stickyFilterContainer, { backgroundColor: colors.bg }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['All', 'PYQ', ...allAvailableSubjects].map(filter => {
            const isSelected = selectedSubjects.includes(filter);
            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterChip,
                  { borderColor: colors.border },
                  isSelected && {
                    backgroundColor: filter === 'PYQ' ? '#dcfce7' : colors.primary,
                    borderColor: filter === 'PYQ' ? '#15803d' : colors.primary
                  }
                ]}
                onPress={() => {
                  setSelectedSubjects(prev => {
                    if (filter === 'All') return ['All'];
                    const filtered = prev.filter(s => s !== 'All');
                    if (filtered.includes(filter)) {
                      const next = filtered.filter(s => s !== filter);
                      return next.length === 0 ? ['All'] : next;
                    } else {
                      return [...filtered, filter];
                    }
                  });
                }}
              >
                <Text style={[
                  styles.filterText,
                  { color: colors.textSecondary },
                  isSelected && { color: filter === 'PYQ' ? '#15803d' : '#fff' }
                ]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Status Filter Bar */}
      <View style={{ marginBottom: spacing.md }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
          {[
            { id: 'all', label: 'All Status', icon: Target },
            { id: 'correct', label: 'Correct', icon: CheckCircle2 },
            { id: 'incorrect', label: 'Incorrect', icon: XCircle },
            { id: 'skipped', label: 'Skipped', icon: HelpCircle }
          ].map((pill: any) => {
            const isSelected = statusFilter === pill.id;
            const Icon = pill.icon;
            return (
              <TouchableOpacity
                key={pill.id}
                onPress={() => setStatusFilter(pill.id)}
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border
                  }
                ]}
              >
                <Icon size={14} color={isSelected ? '#fff' : colors.textSecondary} />
                <Text style={[styles.statusPillText, { color: isSelected ? '#fff' : colors.textSecondary }]}>
                  {pill.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {sectionOrder.map(key => sectionBlocks[key]).filter(Boolean)}

      {/* Test Selection Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select Tests to Analyze</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Text style={{ color: colors.primary, fontWeight: '800' }}>DONE</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setSelectedAttemptIndices(null)}
                style={[styles.actionChip, { backgroundColor: !selectedAttemptIndices ? colors.primary : colors.bg, borderColor: colors.border }]}
              >
                <Text style={{ color: !selectedAttemptIndices ? '#fff' : colors.textSecondary, fontSize: 12, fontWeight: '700' }}>All Tests</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const allScores = trends.historicalScores;
                  const allIndices = allScores.map(t => t.attemptIndex);
                  setSelectedAttemptIndices(allIndices);
                }}
                style={[styles.actionChip, { backgroundColor: colors.bg, borderColor: colors.border }]}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSelectedAttemptIndices([])}
                style={[styles.actionChip, { backgroundColor: colors.bg, borderColor: colors.border }]}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>Deselect All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalList}>
              {(isDeleteMode ? [...trends.historicalScores].reverse() : [...activeTrends.historicalScores].reverse()).map((t) => {
                const isSelected = isDeleteMode 
                  ? selectedForDelete.includes(t.testId)
                  : (!selectedAttemptIndices || selectedAttemptIndices.includes(t.attemptIndex));
                
                return (
                  <TouchableOpacity
                    key={t.testId || t.attemptIndex}
                    style={[styles.testItem, { borderBottomColor: colors.border + '30' }]}
                    onPress={() => {
                      if (isDeleteMode) {
                        setSelectedForDelete(prev =>
                          prev.includes(t.testId)
                            ? prev.filter(id => id !== t.testId)
                            : [...prev, t.testId]
                        );
                      } else {
                        const current = selectedAttemptIndices || activeTrends.historicalScores.map(x => x.attemptIndex);
                        if (current.includes(t.attemptIndex)) {
                          const next = current.filter(id => id !== t.attemptIndex);
                          setSelectedAttemptIndices(next.length === activeTrends.historicalScores.length ? null : next);
                        } else {
                          const next = [...current, t.attemptIndex];
                          setSelectedAttemptIndices(next.length === activeTrends.historicalScores.length ? null : next);
                        }
                      }
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.testItemTitle, { color: colors.textPrimary }]}>
                        Attempt #{t.attemptIndex}{t.title && t.title !== `Attempt #${t.attemptIndex}` ? ` (${t.title})` : ''}
                      </Text>
                      <Text style={[styles.testItemSub, { color: colors.textSecondary }]}>
                        {t.date ? new Date(t.date).toLocaleDateString() : 'Recent'} • Score: {t.score} • Accuracy: {Math.round(t.accuracy)}%
                      </Text>
                    </View>
                    <View style={[
                      styles.checkbox, 
                      { 
                        borderColor: isDeleteMode ? '#ef4444' : colors.primary, 
                        backgroundColor: isSelected ? (isDeleteMode ? '#ef4444' : colors.primary) : 'transparent' 
                      }
                    ]}>
                      {isSelected && <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* New Unified Analysis Export Sheet */}
      <AnalysisExportSheet
        visible={isExportSheetVisible}
        onClose={() => setIsExportSheetVisible(false)}
        questions={exportQuestions}
        trends={activeTrends}
        cumulative={activeCumulative}
        weaknesses={activeWeaknesses}
        buildForecastRows={buildForecastRows}
        title="Analysis Export"
        allRevisionTags={allUserTags}
      />

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingTop: 0,
    paddingBottom: 100,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  topFilter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topLabel: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  topValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 1,
  },
  exportTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  exportTopBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  highlightRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  highlightCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  highlightValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  chartCard: {
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  insightCard: {
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  insightText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  chartSubLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  heatmapGrid: {
    flexDirection: 'column',
    marginBottom: 2,
  },
  heatmapRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  heatmapCell: {
    width: 45,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    marginRight: 2,
  },
  heatmapHeaderCell: {
    width: 80,
    backgroundColor: 'transparent',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  heatmapHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    width: 45,
    marginRight: 2,
  },
  heatmapRowTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  heatmapCellText: {
    fontSize: 10,
    fontWeight: '800',
  },
  stickyFilterContainer: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  filterScroll: {
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '800',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  weakList: {
    marginTop: spacing.sm,
  },
  weakItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  weakItemName: {
    fontSize: 15,
    fontWeight: '700',
  },
  weakItemType: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  weakBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  weakBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  actionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalList: {
    paddingBottom: spacing.xl,
  },
  testItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  testItemTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  testItemSub: {
    fontSize: 12,
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: spacing.lg,
  },
});
