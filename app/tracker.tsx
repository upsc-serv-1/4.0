import React, { useState, useEffect, useMemo } from 'react';
import FeatureGate from '../src/components/FeatureGate';
import {
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  LayoutAnimation,
  Platform,
  UIManager,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import Animated, { 
  FadeInDown, 
  useSharedValue, 
  useAnimatedStyle, 
  useAnimatedScrollHandler, 
  interpolate, 
  Extrapolation 
} from 'react-native-reanimated';
import { 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  ChevronRight,
  ArrowLeft,
  Target,
  Circle,
  Download,
  X,
  Check,
} from 'lucide-react-native';


import Svg, { Circle as SvgCircle, G, Text as SvgText } from 'react-native-svg';
import { RadarChart, BarChart } from '../src/components/Charts';
import { useTheme } from '../src/context/ThemeContext';
import { PageWrapper } from '../src/components/PageWrapper';
import { spacing } from '../src/theme';
import { MICRO_SYLLABUS, MAINS_SYLLABUS, ANTHROPOLOGY_SYLLABUS } from '../src/data/syllabus';
import { SyllabusService, SyllabusProgress } from '../src/services/SyllabusService';
import { useAuth } from '../src/context/AuthContext';
import { buildWeightedSyllabusData, WeightedYearFilter } from '../src/lib/syllabusWeightedProgress';
import { AIQuickActionButton } from '../src/components/AIQuickActionButton';
import { DEFAULT_SYLLABUS_TEMPLATES } from '../src/services/AIPromptManager';
import { SyllabusExportSheet } from '../src/components/export/SyllabusExportSheet';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { useFocusEffect, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const OPTIONAL_SYLLABUS: any = {
  "Paper 1": {
    "Fundamentals": [
      "Core Concepts and Theories",
      "Historical Evolution",
      "Major Thinkers and Contributors"
    ],
    "Applied Aspects": [
      "Methodology and Techniques",
      "Contemporary Issues and Applications",
      "Case Studies"
    ]
  },
  "Paper 2": {
    "Indian Context": [
      "Evolution in India",
      "Prominent Indian Thinkers",
      "Socio-cultural and Economic Dynamics"
    ],
    "Contemporary India": [
      "Current Challenges and Responses",
      "Policy Implementation and Impact",
      "Future Trajectories"
    ]
  }
};

type Mode = 'prelims' | 'mains' | 'optional';
type CoverageMode = 'equal' | 'weighted';
type WeightedYearMode = 'all' | 'single' | 'range';

function SyllabusTracker() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>('prelims');
  const [progress, setProgress] = useState<Record<string, SyllabusProgress>>({});
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [trackingMethod, setTrackingMethod] = useState<'single' | 'multi'>('multi');
  const [optionalChoice, setOptionalChoice] = useState<string>('Anthropology');
  const [coverageMode, setCoverageMode] = useState<CoverageMode>('equal');
  const [weightedYearMode, setWeightedYearMode] = useState<WeightedYearMode>('all');
  const [weightedSingleYear, setWeightedSingleYear] = useState<string>('2025');
  const [weightedStartYear, setWeightedStartYear] = useState<string>('2016');
  const [weightedEndYear, setWeightedEndYear] = useState<string>('2025');
  const [weightedTopicCounts, setWeightedTopicCounts] = useState<Record<string, number>>({});
  const [weightedSectionCounts, setWeightedSectionCounts] = useState<Record<string, number>>({});
  const [weightedSubjectCounts, setWeightedSubjectCounts] = useState<Record<string, number>>({});
  const [availableWeightedYears, setAvailableWeightedYears] = useState<string[]>([]);
  const [loadingWeightedData, setLoadingWeightedData] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(330);
  const [selectedCompSubject, setSelectedCompSubject] = useState<string | null>(null);
  const [heatmapSection, setHeatmapSection] = useState<string | null>(null);
  const [aiContextMode, setAiContextMode] = useState<'all' | 'subject'>('subject');
  const [isExportSheetVisible, setIsExportSheetVisible] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      AsyncStorage.getItem('optional_choice').then(val => {
        if (val) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOptionalChoice(val);
        }
      });
    }, [])
  );

  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, 200],
      [0, -200],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateY }],
      opacity: interpolate(scrollY.value, [0, 150], [1, 0], Extrapolation.CLAMP),
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      paddingTop: insets.top > 0 ? insets.top : 20, // Shift down to avoid Island/Notch
    };
  });

  useEffect(() => {
    if (session?.user.id) {
      // 1. Instant Cache Load
      SyllabusService.getCachedProgress(session.user.id).then(setProgress);
      // 2. Background Network Sync
      SyllabusService.getProgress(session.user.id).then(setProgress);
    }
  }, [session]);

  const toggleStatus = async (path: string, stage: keyof SyllabusProgress) => {
    if (!session?.user.id) return;
    
    const current = progress[path] || { ncert: false, pyqs: false, books: false, test: false, mastered: false };
    const updated = { ...current, [stage]: !current[stage] };
    
    const newProgress = { ...progress, [path]: updated };
    setProgress(newProgress);
    
    await SyllabusService.updateProgress(session.user.id, path, updated);
  };

  const activeOptionalSyllabus = useMemo(() => {
    const sourceSyllabus = optionalChoice === 'Anthropology' ? ANTHROPOLOGY_SYLLABUS : OPTIONAL_SYLLABUS;
    return {
      [`${optionalChoice} Paper 1`]: sourceSyllabus["Paper 1"],
      [`${optionalChoice} Paper 2`]: sourceSyllabus["Paper 2"],
    };
  }, [optionalChoice]);

  const activeSyllabus = mode === 'prelims' ? MICRO_SYLLABUS : mode === 'mains' ? MAINS_SYLLABUS : activeOptionalSyllabus;
  const activeSyllabusMap = activeSyllabus as Record<string, Record<string, string[]>>;

  useEffect(() => {
    if (coverageMode !== 'weighted' || mode !== 'prelims') return;
    let cancelled = false;

    const fetchWeighted = async () => {
      try {
        setLoadingWeightedData(true);
        const filter: WeightedYearFilter =
          weightedYearMode === 'single'
            ? { mode: 'single', singleYear: Number(weightedSingleYear) }
            : weightedYearMode === 'range'
            ? { mode: 'range', startYear: Number(weightedStartYear), endYear: Number(weightedEndYear) }
            : { mode: 'all' };

        const data = await buildWeightedSyllabusData(filter);
        if (cancelled) return;

        setWeightedTopicCounts(data.topicCounts);
        setWeightedSectionCounts(data.sectionCounts);
        setWeightedSubjectCounts(data.subjectCounts);
        const years = data.years.map(String);
        setAvailableWeightedYears(years);

        if (years.length > 0) {
          if (weightedYearMode === 'single' && !years.includes(weightedSingleYear)) {
            setWeightedSingleYear(years[0]);
          }
          if (weightedYearMode === 'range') {
            const latest = years[0];
            const oldest = years[years.length - 1];
            if (!weightedStartYear) setWeightedStartYear(oldest);
            if (!weightedEndYear) setWeightedEndYear(latest);
          }
        }
      } catch (err) {
        console.error('weighted syllabus fetch failed', err);
      } finally {
        if (!cancelled) setLoadingWeightedData(false);
      }
    };
    fetchWeighted();
    return () => {
      cancelled = true;
    };
  }, [coverageMode, mode, weightedYearMode, weightedSingleYear, weightedStartYear, weightedEndYear]);

  const getTopicCompletionScore = (item: SyllabusProgress) => {
    if (trackingMethod === 'single') return item.mastered ? 1 : 0;
    const done = Number(Boolean(item.mastered)) + Number(Boolean(item.ncert)) + Number(Boolean(item.pyqs)) + Number(Boolean(item.books));
    return done / 4;
  };

  const getTopicWeight = (subject: string, group: string, topic: string) => {
    const t = topic.trim().toLowerCase();
    const g = group.trim().toLowerCase();
    const s = subject.trim().toLowerCase();
    return weightedTopicCounts[t] || weightedSectionCounts[g] || weightedSubjectCounts[s] || 0;
  };

  const getOverallStats = () => {
    let totalItems = 0;
    let completedItems = 0;
    let weightedTotal = 0;
    let weightedCovered = 0;

    Object.entries(activeSyllabusMap).forEach(([sub, groups]) => {
      Object.entries(groups).forEach(([group, topics]) => {
        (topics as string[]).forEach(topic => {
          const path = `${sub}.${group}.${topic}`;
          const item = progress[path] || {};
          
          if (trackingMethod === 'single') {
             totalItems += 1;
             if (item.mastered) completedItems += 1;
          } else {
             totalItems += 4; // mastered, ncert, pyqs, books
             if (item.mastered) completedItems += 1;
             if (item.ncert) completedItems += 1;
             if (item.pyqs) completedItems += 1;
             if (item.books) completedItems += 1;
          }

          if (coverageMode === 'weighted' && mode === 'prelims') {
            const weight = getTopicWeight(sub, group, topic);
            weightedTotal += weight;
            weightedCovered += weight * getTopicCompletionScore(item);
          }
        });
      });
    });
    const weightedPercent = weightedTotal ? Math.round((weightedCovered / weightedTotal) * 100) : 0;
    const linearPercent = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;
    return {
      totalItems,
      completedItems,
      weightedTotal,
      weightedCovered,
      percent: coverageMode === 'weighted' && mode === 'prelims' && weightedTotal > 0 ? weightedPercent : linearPercent,
    };
  };

  const getSubjectStats = (subject: string) => {
    let totalItems = 0;
    let completedItems = 0;
    let weightedTotal = 0;
    let weightedCovered = 0;
    const groups = activeSyllabusMap[subject];
    if (groups) {
      Object.entries(groups).forEach(([group, topics]) => {
        (topics as string[]).forEach(topic => {
          const path = `${subject}.${group}.${topic}`;
          const item = progress[path] || {};

          if (trackingMethod === 'single') {
             totalItems += 1;
             if (item.mastered) completedItems += 1;
          } else {
             totalItems += 4;
             if (item.mastered) completedItems += 1;
             if (item.ncert) completedItems += 1;
             if (item.pyqs) completedItems += 1;
             if (item.books) completedItems += 1;
          }

          if (coverageMode === 'weighted' && mode === 'prelims') {
            const weight = getTopicWeight(subject, group, topic);
            weightedTotal += weight;
            weightedCovered += weight * getTopicCompletionScore(item);
          }
        });
      });
    }
    const weightedPercent = weightedTotal ? Math.round((weightedCovered / weightedTotal) * 100) : 0;
    const linearPercent = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;
    return {
      totalItems,
      completedItems,
      weightedTotal,
      weightedCovered,
      percent: coverageMode === 'weighted' && mode === 'prelims' && weightedTotal > 0 ? weightedPercent : linearPercent,
    };
  };

  const stats = useMemo(
    getOverallStats,
    [mode, progress, activeSyllabus, trackingMethod, coverageMode, weightedTopicCounts, weightedSectionCounts, weightedSubjectCounts]
  );

  const getGroupStats = (subject: string, group: string, topics: string[]) => {
    let totalItems = 0;
    let completedItems = 0;
    topics.forEach((topic) => {
      const path = `${subject}.${group}.${topic}`;
      const item = progress[path] || {};
      if (trackingMethod === 'single') {
        totalItems += 1;
        if (item.mastered) completedItems += 1;
      } else {
        totalItems += 4;
        if (item.mastered) completedItems += 1;
        if (item.ncert) completedItems += 1;
        if (item.pyqs) completedItems += 1;
        if (item.books) completedItems += 1;
      }
    });
    return { percent: totalItems ? Math.round((completedItems / totalItems) * 100) : 0 };
  };

  const getSubjectDrilldown = (subject: string) => {
    const groups = activeSyllabusMap[subject] || {};
    const sectionRows = Object.entries(groups)
      .map(([group, topics]) => ({ name: group, percent: getGroupStats(subject, group, topics as string[]).percent }))
      .sort((a, b) => b.percent - a.percent);

    const microRows: Array<{ name: string; percent: number; group: string }> = [];
    Object.entries(groups).forEach(([group, topics]) => {
      (topics as string[]).forEach((topic) => {
        const path = `${subject}.${group}.${topic}`;
        const item = progress[path] || {};
        microRows.push({
          name: topic,
          group,
          percent: Math.round(getTopicCompletionScore(item) * 100),
        });
      });
    });

    return {
      sectionRows,
      microRows: microRows.sort((a, b) => b.percent - a.percent),
    };
  };

  // View: Overview Dashboard
  const renderOverview = () => (
    <Animated.View entering={FadeInDown.duration(400).springify()}>
      
      {mode === 'optional' && (
        <View style={{ marginBottom: 24, padding: 16, backgroundColor: colors.surfaceStrong, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
           <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
             <View>
                <Text style={{ fontSize: 11, fontWeight: '900', color: colors.primary, letterSpacing: 1 }}>SELECTED OPTIONAL</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: colors.textPrimary, marginTop: 4 }}>{optionalChoice}</Text>
             </View>
             <TouchableOpacity 
               onPress={() => router.push('/profile')}
               style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.primary + '15', borderRadius: 8 }}
             >
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>CHANGE IN SETTINGS</Text>
             </TouchableOpacity>
           </View>
        </View>
      )}

      <View style={[s.intelCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: mode === 'optional' ? 0 : 8, padding: isTablet ? 16 : 20 }]}>
         <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Target color={colors.primary} size={20} />
            <Text style={[s.intelTitle, { color: colors.textPrimary, marginLeft: 8 }]}>Preparation Intelligence</Text>
            <TouchableOpacity 
              onPress={() => setIsExportSheetVisible(true)}
              style={[s.exportPill, { borderColor: colors.border, marginLeft: 'auto' }]}
            >
              <Download size={14} color={colors.textSecondary} />
              <Text style={[s.exportPillText, { color: colors.textSecondary }]}>Export</Text>
            </TouchableOpacity>
         </View>
         <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[s.intelMetric, { backgroundColor: colors.bg, borderColor: colors.border }]}>
               <Text style={[s.intelMetricLabel, { color: colors.textSecondary }]}>
                 {coverageMode === 'weighted' && mode === 'prelims' ? 'PYQ WEIGHT (TOTAL Q)' : `TOTAL ${trackingMethod === 'single' ? 'TOPICS' : 'CHECKPOINTS'}`}
               </Text>
               <Text style={[s.intelMetricVal, { color: colors.textPrimary }]}>
                 {coverageMode === 'weighted' && mode === 'prelims' ? Math.round(stats.weightedTotal || 0) : stats.totalItems}
               </Text>
            </View>
            <View style={[s.intelMetric, { backgroundColor: '#14532d', borderColor: '#166534' }]}>
               <Text style={[s.intelMetricLabel, { color: 'rgba(255,255,255,0.7)' }]}>
                 {coverageMode === 'weighted' && mode === 'prelims' ? 'WEIGHTED COVERED' : 'COMPLETED'}
               </Text>
               <Text style={[s.intelMetricVal, { color: '#fff' }]}>
                 {coverageMode === 'weighted' && mode === 'prelims' ? Math.round(stats.weightedCovered || 0) : stats.completedItems}
               </Text>
            </View>
         </View>
         <View style={[s.intelEfficiency, { backgroundColor: '#1c1917' }]}>
            <View>
               <Text style={[s.intelMetricLabel, { color: 'rgba(255,255,255,0.6)' }]}>AGGREGATE EFFICIENCY</Text>
               <Text style={[s.intelMetricVal, { color: '#fff' }]}>{stats.percent}%</Text>
            </View>
            <DoughnutChart percentage={stats.percent} size={68} strokeWidth={8} color="#8a795d" />
         </View>
      </View>

      <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Subject Progress Summary</Text>
      <View style={[s.subjectGrid, isTablet && { gap: 10 }]}>
        {Object.keys(activeSyllabusMap).map(subject => {
          const subStats = getSubjectStats(subject);
          return (
            <TouchableOpacity 
              key={subject}
              style={[s.subjectGridCard, { backgroundColor: colors.surface, borderColor: colors.border, width: isTablet ? '31.8%' : '48%', padding: isTablet ? 12 : 16 }]}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setSelectedSubject(subject);
                setExpandedGroup(Object.keys(activeSyllabusMap[subject])[0] || null);
              }}
            >
              <Text style={[s.subjectGridName, { color: colors.textSecondary }]} numberOfLines={1}>{subject}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12 }}>
                 <Text style={[s.subjectGridPercent, { color: colors.textPrimary }]}>{subStats.percent}%</Text>
                 <Text style={[s.subjectGridRatio, { color: colors.textTertiary }]}>
                   {coverageMode === 'weighted' && mode === 'prelims'
                     ? `${Math.round(subStats.weightedCovered || 0)}/${Math.round(subStats.weightedTotal || 0)}`
                     : `${subStats.completedItems}/${subStats.totalItems}`}
                 </Text>
              </View>
              <View style={[s.progressBarBg, { backgroundColor: colors.bg, marginTop: 8 }]}>
                 <View style={[s.progressBarFill, { width: `${subStats.percent}%`, backgroundColor: colors.primary }]} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[s.sectionTitle, { color: colors.textPrimary, marginTop: 26 }]}>Comparative Analysis & Drilldown</Text>
      <View style={[s.compCard, { backgroundColor: colors.surface, borderColor: colors.border, padding: 0, overflow: 'hidden' }]}>
        <View style={{ padding: 20, width: '100%' }}>
           <Text style={[s.compCardTitle, { color: colors.textPrimary }]}>1. Radial Progress Map</Text>
           <Text style={[s.compCardSub, { color: colors.textSecondary }]}>Interactive radar view of subject mastery</Text>
        </View>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={{ paddingHorizontal: 30, paddingBottom: 30 }}
        >
          <View style={{ width: 440, height: 400, alignItems: 'center', justifyContent: 'center' }}>
            <RadarChart 
              data={Object.keys(activeSyllabusMap).map(subj => ({ 
                label: subj, 
                value: getSubjectStats(subj).percent 
              }))}
              size={340}
              onPress={(label) => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setSelectedCompSubject(label === selectedCompSubject ? null : label);
                setHeatmapSection(null);
              }}
            />
          </View>
        </ScrollView>

        <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: colors.border }}>
           <Text style={[s.compCardTitle, { color: colors.textPrimary }]}>2. All Subject Completion</Text>
           <Text style={[s.compCardSub, { color: colors.textSecondary }]}>Overview of your entire syllabus progress</Text>
           
           <View style={{ marginTop: 16, gap: 10 }}>
             {Object.keys(activeSyllabusMap).map(subj => {
               const stats = getSubjectStats(subj);
               return (
                 <TouchableOpacity 
                   key={subj} 
                   onPress={() => {
                     LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                     setSelectedCompSubject(subj);
                     setHeatmapSection(null);
                   }}
                   style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                 >
                   <Text style={{ width: 100, fontSize: 11, fontWeight: '700', color: colors.textSecondary }} numberOfLines={1}>{subj}</Text>
                   <View style={{ flex: 1, height: 8, backgroundColor: colors.bg, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                     <View style={{ width: `${stats.percent}%`, height: '100%', backgroundColor: colors.primary }} />
                   </View>
                   <Text style={{ width: 35, fontSize: 11, fontWeight: '800', color: colors.primary, textAlign: 'right' }}>{stats.percent}%</Text>
                 </TouchableOpacity>
               );
             })}
           </View>
        </View>

        {selectedCompSubject && (
          <Animated.View entering={FadeInDown.duration(300)} style={{ width: '100%', padding: 20, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg + '50' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View>
                <Text style={[s.compCardTitle, { color: colors.textPrimary, fontSize: 16 }]}>3. {selectedCompSubject}: Sections</Text>
                <Text style={[s.compCardSub, { color: colors.textSecondary }]}>Tap a section to see micro-topics</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedCompSubject(null)}>
                <X size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <BarChart
              data={Object.entries(activeSyllabusMap[selectedCompSubject]).map(([group, topics], idx) => {
                const groupColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
                const groupColor = groupColors[idx % groupColors.length];
                return {
                  label: group,
                  value: getGroupStats(selectedCompSubject, group, topics as string[]).percent,
                  color: groupColor
                };
              })}
              height={180}
              onPress={(label) => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setHeatmapSection(label === heatmapSection ? null : label);
              }}
            />

            {selectedCompSubject && (
              <Animated.View entering={FadeInDown.duration(300)} style={{ marginTop: 24, padding: 16, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={[s.compCardTitle, { color: colors.textPrimary, fontSize: 14 }]}>
                    4. {heatmapSection ? `${heatmapSection}: ` : 'All '}Micro-topics
                  </Text>
                  {heatmapSection && (
                    <TouchableOpacity onPress={() => setHeatmapSection(null)}>
                      <X size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>
                
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }}>
                  {Object.entries(activeSyllabusMap[selectedCompSubject])
                    .filter(([group]) => !heatmapSection || group === heatmapSection)
                    .flatMap(([group, topics], idx) => {
                      const groupColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
                      const groupColor = groupColors[idx % groupColors.length];
                      return (topics as string[]).map(topic => ({ group, topic, color: groupColor }));
                    })
                    .map(({ group, topic, color }) => {
                      const path = `${selectedCompSubject}.${group}.${topic}`;
                      const item = progress[path] || {};
                      const isDone = item.mastered;
                      
                      return (
                        <TouchableOpacity 
                          key={path}
                          onPress={() => {
                            toggleStatus(path, 'mastered');
                          }}
                          style={{ 
                            width: '48.5%',
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            padding: 10,
                            backgroundColor: isDone ? color + '15' : colors.bg,
                            borderRadius: 10,
                            borderWidth: 1.5,
                            borderColor: isDone ? color : colors.border,
                            marginBottom: 2
                          }}
                        >
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ 
                              width: 18, 
                              height: 18, 
                              borderRadius: 4, 
                              backgroundColor: isDone ? color : 'transparent',
                              borderWidth: 2,
                              borderColor: isDone ? color : colors.textTertiary,
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {isDone && <Check color="#fff" size={12} strokeWidth={4} />}
                            </View>
                            <View style={{ flex: 1 }}>
                              {!heatmapSection && (
                                <Text style={{ fontSize: 8, fontWeight: '900', color: color, textTransform: 'uppercase' }} numberOfLines={1}>
                                  {group}
                                </Text>
                              )}
                              <Text style={{ fontSize: 11, color: isDone ? colors.textSecondary : colors.textPrimary, flex: 1, lineHeight: 13, fontWeight: isDone ? '600' : '700' }} numberOfLines={2}>
                                {topic}
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                </View>
                
                <TouchableOpacity 
                  onPress={() => {
                    setSelectedSubject(selectedCompSubject);
                    setExpandedGroup(heatmapSection || Object.keys(activeSyllabusMap[selectedCompSubject])[0]);
                  }}
                  style={{ 
                    marginTop: 16, 
                    backgroundColor: colors.primary, 
                    paddingVertical: 12, 
                    borderRadius: 12,
                    alignItems: 'center' 
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '900', color: '#fff' }}>VIEW ALL CHECKPOINTS</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </Animated.View>
        )}
      </View>

      <View style={[s.compCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 16 }]}>
        <View style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
           <Target color="#ef4444" size={20} />
           <Text style={[s.compCardTitle, { color: colors.textPrimary, marginLeft: 8 }]}>Weak Area Radar</Text>
        </View>
        {Object.keys(activeSyllabusMap)
          .map(subj => ({ name: subj, stats: getSubjectStats(subj) }))
          .filter(s => s.stats.percent < 40)
          .sort((a, b) => a.stats.percent - b.stats.percent)
          .map(({ name, stats }) => (
            <View key={name} style={[s.weakRow, { borderBottomColor: colors.border }]}>
               <Text style={[s.weakName, { color: colors.textSecondary }]}>{name}</Text>
               <Text style={[s.weakAction, { color: '#ef4444' }]}>Needs Attention ({stats.percent}%)</Text>
            </View>
        ))}
        {Object.keys(activeSyllabusMap).map(subj => ({ name: subj, stats: getSubjectStats(subj) })).filter(s => s.stats.percent < 40).length === 0 && (
           <Text style={[s.weakAction, { color: '#22c55e', marginTop: 8 }]}>No critical weak areas identified! All subjects {'>'}40%.</Text>
        )}
      </View>
    </Animated.View>
  );

  // View: Subject Details
  const renderSubjectDetail = () => {
    if (!selectedSubject) return null;
    const subStats = getSubjectStats(selectedSubject);
    const groups = activeSyllabusMap[selectedSubject];

    return (
      <Animated.View entering={FadeInDown.duration(400).springify()} style={s.detailContainer}>
        <TouchableOpacity 
          style={s.backBtn}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setSelectedSubject(null);
          }}
        >
          <ArrowLeft size={20} color={colors.textSecondary} />
          <Text style={[s.backText, { color: colors.textSecondary }]}>Back to Overview</Text>
        </TouchableOpacity>

        <View style={[s.detailHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
           <View style={{ flex: 1 }}>
              <Text style={[s.detailSubjectName, { color: colors.textPrimary }]}>{selectedSubject}</Text>
              <Text style={[s.detailSubtitle, { color: colors.textSecondary }]}>Syllabus checkpoints</Text>
           </View>
           <View style={{ alignItems: 'flex-end' }}>
              <Text style={[s.detailPercent, { color: colors.primary }]}>{subStats.percent}%</Text>
              <Text style={[s.detailRatio, { color: colors.textTertiary }]}>COMPLETION</Text>
           </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
           <DoughnutChart percentage={subStats.percent} size={140} strokeWidth={16} color={colors.primary} />
        </View>

        <View style={[s.linearProgressBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
           <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={[s.linearProgressTitle, { color: colors.textPrimary }]}>Linear Progress</Text>
              <Text style={[s.linearProgressRatio, { color: colors.textPrimary }]}>
                {coverageMode === 'weighted' && mode === 'prelims'
                  ? `${Math.round(subStats.weightedCovered || 0)}/${Math.round(subStats.weightedTotal || 0)} Weighted`
                  : `${subStats.completedItems}/${subStats.totalItems} ${trackingMethod === 'single' ? 'Topics' : 'Checkpoints'}`}
              </Text>
           </View>
           <View style={[s.progressBarBg, { backgroundColor: colors.bg, height: 6 }]}>
              <View style={[s.progressBarFill, { width: `${subStats.percent}%`, backgroundColor: colors.primary }]} />
           </View>
        </View>

        <View style={s.groupsContainer}>
          {Object.entries(groups).map(([group, topics]) => (
            <View key={group} style={[s.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity 
                style={s.groupHeader}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setExpandedGroup(expandedGroup === group ? null : group);
                }}
              >
                <Text style={[s.groupName, { color: colors.textPrimary }]}>{group}</Text>
                {expandedGroup === group ? <ChevronUp size={20} color={colors.textTertiary} /> : <ChevronDown size={20} color={colors.textTertiary} />}
              </TouchableOpacity>

              {expandedGroup === group && (
                <View style={s.topicsList}>
                  {(topics as string[]).map(topic => {
                    const path = `${selectedSubject}.${group}.${topic}`;
                    const itemProgress = progress[path] || { ncert: false, pyqs: false, books: false, test: false, mastered: false };
                    
                    return (
                      <View key={topic} style={[s.topicRow, { borderBottomColor: colors.border }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1 }}>
                           <TouchableOpacity onPress={() => toggleStatus(path, 'mastered')} style={s.checkBtn}>
                              {itemProgress.mastered ? (
                                <CheckCircle2 size={24} color={colors.primary} fill={colors.primary + '20'} />
                              ) : (
                                <Circle size={24} color={colors.textTertiary} />
                              )}
                           </TouchableOpacity>
                           <View style={{ flex: 1 }}>
                             <Text style={[s.topicText, { color: itemProgress.mastered ? colors.textSecondary : colors.textPrimary, textDecorationLine: itemProgress.mastered ? 'line-through' : 'none' }]}>
                               {topic}
                             </Text>
                           </View>
                        </View>
                        
                        {trackingMethod === 'multi' && (
                          <View style={s.statusGrid}>
                            <StatusBtn active={itemProgress.ncert} onPress={() => toggleStatus(path, 'ncert')} label="NCERT" colors={colors} />
                            <StatusBtn active={itemProgress.pyqs} onPress={() => toggleStatus(path, 'pyqs')} label="PYQ" colors={colors} />
                            <StatusBtn active={itemProgress.books} onPress={() => toggleStatus(path, 'books')} label="Book" colors={colors} />
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
        </View>
      </Animated.View>
    );
  };

  return (
    <PageWrapper>
      {!selectedSubject && (
        <Animated.View
          style={[headerAnimatedStyle, { backgroundColor: colors.bg }]}
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        >
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={[s.h1, { color: colors.textPrimary }]}>Syllabus Progress</Text>
              <Text style={[s.subhead, { color: colors.textSecondary }]}>Track your completion, identify weak areas, and master the UPSC syllabus.</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsExportSheetVisible(true)}
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                borderWidth: 1.5,
                borderColor: '#fff',
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6
              }}
            >
              <Download color="#fff" size={16} />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>GET REPORT</Text>
            </TouchableOpacity>
          </View>

          <View style={[s.topControlGrid, { marginHorizontal: spacing.lg }]}>
            <View style={[s.topLeftPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[s.tabBar, { marginHorizontal: 0, marginBottom: 8, backgroundColor: colors.bg, borderColor: colors.border }]}>
                <TouchableOpacity style={[s.tab, trackingMethod === 'single' && { backgroundColor: colors.primary }]} onPress={() => setTrackingMethod('single')}>
                  <Text style={[s.tabText, { color: trackingMethod === 'single' ? '#fff' : colors.textSecondary }]}>Single</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.tab, trackingMethod === 'multi' && { backgroundColor: colors.primary }]} onPress={() => setTrackingMethod('multi')}>
                  <Text style={[s.tabText, { color: trackingMethod === 'multi' ? '#fff' : colors.textSecondary }]}>Multi</Text>
                </TouchableOpacity>
              </View>
              <View style={[s.tabBar, { marginHorizontal: 0, marginBottom: 0, backgroundColor: colors.bg, borderColor: colors.border }]}>
                <TouchableOpacity style={[s.tab, coverageMode === 'equal' && { backgroundColor: colors.primary }]} onPress={() => setCoverageMode('equal')}>
                  <Text style={[s.tabText, { color: coverageMode === 'equal' ? '#fff' : colors.textSecondary }]}>Normal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.tab, coverageMode === 'weighted' && { backgroundColor: colors.primary }]} onPress={() => setCoverageMode('weighted')}>
                  <Text style={[s.tabText, { color: coverageMode === 'weighted' ? '#fff' : colors.textSecondary }]}>PYQ</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[s.topRightPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {(['prelims', 'mains', 'optional'] as Mode[]).map((m) => (
                <TouchableOpacity key={m} style={[s.modeLineBtn, { borderColor: colors.border }, mode === m && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setMode(m)}>
                  <Text style={[s.modeLineText, { color: mode === m ? '#fff' : colors.textSecondary }]}>{m === 'prelims' ? 'Prelims' : m === 'mains' ? 'Mains' : 'Optional'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {coverageMode === 'weighted' && mode === 'prelims' && (
            <View style={[s.weightedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={s.weightedChips}>
                <TouchableOpacity style={[s.weightedChip, { borderColor: colors.border }, weightedYearMode === 'all' && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setWeightedYearMode('all')}>
                  <Text style={[s.weightedChipText, { color: weightedYearMode === 'all' ? '#fff' : colors.textSecondary }]}>All Years</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.weightedChip, { borderColor: colors.border }, weightedYearMode === 'single' && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setWeightedYearMode('single')}>
                  <Text style={[s.weightedChipText, { color: weightedYearMode === 'single' ? '#fff' : colors.textSecondary }]}>Single</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.weightedChip, { borderColor: colors.border }, weightedYearMode === 'range' && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setWeightedYearMode('range')}>
                  <Text style={[s.weightedChipText, { color: weightedYearMode === 'range' ? '#fff' : colors.textSecondary }]}>Range</Text>
                </TouchableOpacity>
              </View>
              {weightedYearMode === 'single' && (
                <TextInput
                  value={weightedSingleYear}
                  onChangeText={setWeightedSingleYear}
                  keyboardType="number-pad"
                  maxLength={4}
                  style={[s.weightedInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                />
              )}
              {weightedYearMode === 'range' && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput value={weightedStartYear} onChangeText={setWeightedStartYear} keyboardType="number-pad" maxLength={4} style={[s.weightedInput, { flex: 1, color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]} placeholder="From" placeholderTextColor={colors.textTertiary} />
                  <TextInput value={weightedEndYear} onChangeText={setWeightedEndYear} keyboardType="number-pad" maxLength={4} style={[s.weightedInput, { flex: 1, color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]} placeholder="To" placeholderTextColor={colors.textTertiary} />
                </View>
              )}
              {loadingWeightedData ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[s.weightedHint, { color: colors.textSecondary, marginLeft: 8 }]}>Loading weights...</Text>
                </View>
              ) : (
                <Text style={[s.weightedHint, { color: colors.textSecondary }]}>
                  {availableWeightedYears.length ? `Data years: ${availableWeightedYears[availableWeightedYears.length - 1]}-${availableWeightedYears[0]}` : 'No PYQ data found'}
                </Text>
              )}
            </View>
          )}
        </Animated.View>
      )}

      {selectedSubject && (
        <View style={s.header}>
          <View>
            <Text style={[s.h1, { color: colors.textPrimary }]}>Syllabus Progress</Text>
            <Text style={[s.subhead, { color: colors.textSecondary }]}>Track your completion, identify weak areas, and master the UPSC syllabus.</Text>
          </View>
        </View>
      )}

      <Animated.ScrollView 
        contentContainerStyle={[s.content, !selectedSubject && { paddingTop: headerHeight + 16 }]} 
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {selectedSubject ? renderSubjectDetail() : renderOverview()}
      </Animated.ScrollView>
      {!selectedSubject && (
        <View style={[s.aiDock, { bottom: insets.bottom + 12 }]}>
          <View style={[s.aiModeStrip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity style={[s.aiModeChip, aiContextMode === 'subject' && { backgroundColor: colors.primary }]} onPress={() => setAiContextMode('subject')}>
              <Text style={[s.aiModeText, { color: aiContextMode === 'subject' ? '#fff' : colors.textSecondary }]}>Current Subject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.aiModeChip, aiContextMode === 'all' && { backgroundColor: colors.primary }]} onPress={() => setAiContextMode('all')}>
              <Text style={[s.aiModeText, { color: aiContextMode === 'all' ? '#fff' : colors.textSecondary }]}>All Subjects</Text>
            </TouchableOpacity>
          </View>
          <AIQuickActionButton
            context={{
              type: 'syllabus',
              title:
                aiContextMode === 'all'
                  ? `${mode.toUpperCase()} Full Syllabus`
                  : selectedCompSubject || Object.keys(activeSyllabusMap)[0] || mode.toUpperCase(),
              metadata: {
                progress: String(stats.percent),
                mode,
                coverage: coverageMode,
              },
            }}
            templates={DEFAULT_SYLLABUS_TEMPLATES}
            buttonLabel="AI Plan"
            buttonStyle={s.aiFab}
          />
        </View>
      )}
      <SyllabusExportSheet
        visible={isExportSheetVisible}
        onClose={() => setIsExportSheetVisible(false)}
        progress={progress}
        syllabus={activeSyllabusMap}
        title="Syllabus Completion Report"
      />
    </PageWrapper>
  );
}

function DoughnutChart({ percentage, size = 120, strokeWidth = 12, color = '#8a795d' }: any) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <SvgCircle
            stroke="rgba(150,150,150,0.15)"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <SvgCircle
            stroke={color}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </G>
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
         <Text style={{ fontSize: size * 0.22, fontWeight: '900', color }}>{percentage}%</Text>
      </View>
    </View>
  );
}

function StatusBtn({ active, onPress, label, colors }: any) {
  return (
    <TouchableOpacity 
      style={[s.statusBtn, { backgroundColor: active ? colors.primary + '15' : colors.bg, borderColor: active ? colors.primary + '30' : colors.border }]} 
      onPress={onPress}
    >
      <Text style={[s.statusLabel, { color: active ? colors.primary : colors.textTertiary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  header: { padding: spacing.lg, paddingBottom: 12 },
  h1: { fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  subhead: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  
  tabBar: { flexDirection: 'row', marginHorizontal: spacing.lg, borderRadius: 14, padding: 4, borderWidth: 1, marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 9, paddingHorizontal: 4, alignItems: 'center', borderRadius: 10, justifyContent: 'center' },
  tabText: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  topControlGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  topLeftPanel: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 8 },
  topRightPanel: { width: 180, borderWidth: 1, borderRadius: 14, padding: 8, gap: 6 },
  modeLineBtn: { paddingVertical: 8, borderWidth: 1, borderRadius: 9, alignItems: 'center' },
  modeLineText: { fontSize: 11, fontWeight: '800' },
  weightedCard: { marginHorizontal: spacing.lg, marginBottom: 10, borderRadius: 16, borderWidth: 1, padding: 12 },
  weightedChips: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  weightedChip: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9, backgroundColor: '#00000010', borderWidth: 1 },
  weightedChipText: { fontSize: 10, fontWeight: '800' },
  weightedInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6, fontWeight: '700', fontSize: 12 },
  weightedHint: { fontSize: 10, fontWeight: '600' },
  
  content: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  
  // Overview Styles
  intelCard: { borderRadius: 20, padding: 16, borderWidth: 1, marginBottom: 24 },
  intelTitle: { fontSize: 18, fontWeight: '900' },
  intelMetric: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1 },
  intelMetricLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  intelMetricVal: { fontSize: 24, fontWeight: '900' },
  intelEfficiency: { marginTop: 12, padding: 20, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exportPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  exportPillText: { fontSize: 11, fontWeight: '700' },
  
  sectionTitle: { fontSize: 20, fontWeight: '900', marginBottom: 16 },
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  subjectGridCard: { width: '48%', padding: 14, borderRadius: 16, borderWidth: 1 },
  subjectGridName: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  subjectGridPercent: { fontSize: 24, fontWeight: '900' },
  subjectGridRatio: { fontSize: 10, fontWeight: '700', paddingBottom: 4 },
  progressBarBg: { height: 4, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  
  compCard: { padding: 18, borderRadius: 18, borderWidth: 1 },
  compCardTitle: { fontSize: 18, fontWeight: '900' },
  compCardSub: { fontSize: 12, marginTop: 4 },
  compSubjectName: { fontSize: 13, fontWeight: '800' },
  compSubjectPercent: { fontSize: 13, fontWeight: '900' },
  
  weakRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  weakName: { fontSize: 14, fontWeight: '700' },
  weakAction: { fontSize: 12, fontWeight: '800' },
  
  // Detail Styles
  detailContainer: { flex: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backText: { fontSize: 14, fontWeight: '600', marginLeft: 8 },
  detailHeader: { padding: 24, borderRadius: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  detailSubjectName: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  detailSubtitle: { fontSize: 14, marginTop: 4 },
  detailPercent: { fontSize: 32, fontWeight: '900' },
  detailRatio: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 2 },
  
  linearProgressBox: { padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 24 },
  linearProgressTitle: { fontSize: 14, fontWeight: '700' },
  linearProgressRatio: { fontSize: 14, fontWeight: '800' },
  
  groupsContainer: { gap: 16 },
  groupCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  groupHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupName: { fontSize: 16, fontWeight: '800' },
  
  topicsList: { paddingHorizontal: 20, paddingBottom: 12 },
  topicRow: { paddingVertical: 16, borderTopWidth: 1, gap: 12 },
  checkBtn: { marginRight: 12, marginTop: 2 },
  topicText: { fontSize: 15, fontWeight: '600', lineHeight: 22, flexShrink: 1 },
  statusGrid: { flexDirection: 'row', gap: 8, paddingLeft: 36, flexWrap: 'wrap' },
  statusBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  statusLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  aiDock: { position: 'absolute', right: 16, alignItems: 'flex-end', gap: 8 },
  aiModeStrip: { flexDirection: 'row', gap: 6, borderWidth: 1, borderRadius: 999, padding: 4 },
  aiModeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  aiModeText: { fontSize: 10, fontWeight: '800' },
  aiFab: { backgroundColor: '#7c3aed', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
});

export default function TrackerScreen() {
  return (
    <FeatureGate feature="tracker" featureLabel="Syllabus Tracker">
      <SyllabusTracker />
    </FeatureGate>
  );
}
