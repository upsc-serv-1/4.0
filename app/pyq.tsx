import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { KVStore } from '../src/lib/kvStore';
import { OfflineManager } from '../src/services/OfflineManager';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  ChevronDown,
  ChevronLeft,
  Download,
  Grid,
  LineChart as LineIcon,
  Target,
  TrendingUp,
  X,
  FileStack,
  HelpCircle,
} from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';
import { PieChart, LineChart } from '../src/components/Charts';
import { useTheme } from '../src/context/ThemeContext';
import { useCourse } from '../src/context/CourseContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { prelimsTaxonomy } from '../src/data/taxonomy';
import { AnalysisExportSheet } from '../src/components/export/AnalysisExportSheet';
import { buildPyqAnalysisSummaryHtml, type ExportPayload } from '../src/lib/unifiedExportEngine';
import { mergeQuestions, enrichWithCrossInstituteExplanations } from '../src/utils/merger';
import { useDownloadManager } from '../src/context/DownloadManagerContext';
import { useExportGuard } from '../src/lib/useExportGuard';
import { ActiveFiltersBar, ActiveFilter } from '../src/components/pyq/ActiveFiltersBar';
import { SelectionSummaryBar } from '../src/components/pyq/SelectionSummaryBar';
import { PredictiveInsightsPanel } from '../src/components/pyq/PredictiveInsightsPanel';
import { buildPredictive, probableHotsFor2026 } from '../src/lib/pyqPredictive';
import { CompareWindowsPanel } from '../src/components/pyq/CompareWindowsPanel';
import { UndoToast, UndoSpec } from '../src/components/common/UndoToast';

const { width } = Dimensions.get('window');

// Course-specific stages and papers
// Note: CourseContext uses 'Civil Services', so both keys are needed for backward compatibility
const STAGES_BY_COURSE: Record<string, string[]> = {
  'Civil Services': ['Prelims', 'Mains'],
  'UPSC CSE': ['Prelims', 'Mains'],
  'Medical Science': ['INICET', 'NEET PG', 'UPSC CMS'],
};

const PAPERS_BY_COURSE: Record<string, Record<string, string[] | null>> = {
  'Civil Services': {
    Prelims: ['GS Paper 1', 'GS Paper 2 (CSAT)'],
    Mains: ['GS Paper 1', 'GS Paper 2', 'GS Paper 3', 'GS Paper 4', 'Optional'],
  },
  'UPSC CSE': {
    Prelims: ['GS Paper 1', 'GS Paper 2 (CSAT)'],
    Mains: ['GS Paper 1', 'GS Paper 2', 'GS Paper 3', 'GS Paper 4', 'Optional'],
  },
  'Medical Science': {
    INICET: null,
    'NEET PG': null,
    'UPSC CMS': ['Paper 1', 'Paper 2'],
  },
};

// Legacy constants (kept for backward compatibility)
const EXAM_STAGES = ['Prelims', 'Mains'];
const PAPERS = {
  Prelims: ['GS Paper 1', 'GS Paper 2 (CSAT)'],
  Mains: ['GS Paper 1', 'GS Paper 2', 'GS Paper 3', 'GS Paper 4', 'Optional'],
};
const RANGE_OPTIONS = ['Only 2025', 'Last 5 Years', 'Last 10 Years', 'All (2013-2025)', 'Custom Range'];
const TREND_PALETTE = [
  '#2563eb', '#14b8a6', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', // Original 6
  '#06b6d4', '#10b981', '#84cc16', '#eab308', '#f97316', '#6366f1', // Additional
  '#d946ef', '#f43f5e', '#78716c' // More
];
const PYQ_PAGE_SIZE = 1000;

type HubKey = 'overview' | 'focused' | 'pilot' | 'forecast' | 'compare';
type ExportMode = 'all' | 'momentum' | 'distribution' | 'heatmaps' | 'focused' | 'subject_one' | 'subject_all';
type AnalysisReportKey = 'full_report' | 'subject_momentum' | 'subject_distribution' | 'heatmaps' | 'focused_trend' | 'forecast';

const ANALYSIS_REPORT_OPTIONS: Array<{ key: AnalysisReportKey; label: string }> = [
  { key: 'full_report', label: 'Include Full Report' },
  { key: 'subject_momentum', label: 'Subject Momentum' },
  { key: 'subject_distribution', label: 'Subject Distribution' },
  { key: 'heatmaps', label: 'Heatmaps' },
  { key: 'focused_trend', label: 'Focused Trend' },
  { key: 'forecast', label: 'Forecast (Probable 2026 Topics)' },
];

type HeatmapRow = {
  key: string;
  label: string;
  /**
   * Optional visual variant of the label. When provided the grid renders this
   * (e.g. "Economy · Banking") while still delivering the original `label`
   * value through callbacks — keeping navigation logic intact.
   */
  displayLabel?: string;
  byYear: Record<string, number>;
};

// Heatmap base dimensions (phone defaults). Responsive logic below expands
// these on larger screens (iPads/tablets) so the grid uses available width.
const HEATMAP_LABEL_WIDTH = 170;
const HEATMAP_CELL_WIDTH = 54;
const HEATMAP_ROW_HEIGHT = 58;
const HEATMAP_MAX_BODY_HEIGHT = 520;

// Responsive helper: expands cell width / label width based on screen width.
// On iPads (>=768), it attempts to fill the available horizontal space
// across the year axis while keeping comfortable minimums.
const getResponsiveHeatmapDims = (screenWidth: number, yearsCount: number, isCompact?: boolean) => {
  // Panel horizontal padding (24) + outer screen padding approximations.
  // We leave ~56px of chrome for panel padding+margins.
  const available = Math.max(320, screenWidth - 56);
  const isTablet = screenWidth >= 768;
  const isLargeTablet = screenWidth >= 1024;

  let labelWidth: number;
  let cellWidth: number;
  let rowHeight: number;

  if (isLargeTablet) {
    labelWidth = isCompact ? 220 : 260;
    rowHeight = 60;
    // Target fit: divide remaining space across years but clamp to 64-120
    const remaining = available - labelWidth;
    const ideal = Math.floor(remaining / Math.max(1, yearsCount));
    cellWidth = Math.max(68, Math.min(120, ideal));
  } else if (isTablet) {
    labelWidth = isCompact ? 200 : 230;
    rowHeight = 58;
    const remaining = available - labelWidth;
    const ideal = Math.floor(remaining / Math.max(1, yearsCount));
    cellWidth = Math.max(62, Math.min(96, ideal));
  } else {
    labelWidth = isCompact ? 150 : 180;
    rowHeight = HEATMAP_ROW_HEIGHT;
    cellWidth = HEATMAP_CELL_WIDTH;
  }
  return { labelWidth, cellWidth, rowHeight, isTablet };
};

function StickyHeatmapTable({
  title,
  labelHeader,
  years,
  rows,
  baseColor,
  colors,
  onCellPress,
  onRowPress,
  onLabelActionPress,
  onYearPress,
  heatmapPalette,
  maxValue,
  labelWidth,
  compactLabel,
  preferredCellWidth,
}: {
  title: string;
  labelHeader: string;
  years: string[];
  rows: HeatmapRow[];
  baseColor: string;
  colors: any;
  onCellPress?: (rowLabel: string, year: string) => void;
  onRowPress?: (rowLabel: string) => void;
  onLabelActionPress?: (rowLabel: string) => void;
  onYearPress?: (year: string) => void;
  heatmapPalette: 'spectral' | 'ocean';
  maxValue?: number;
  labelWidth?: number;
  compactLabel?: boolean;
  /** Minimum cell width to honour even on small screens (defaults to responsive). */
  preferredCellWidth?: number;
}) {
  const screenW = Dimensions.get('window').width;
  const dims = getResponsiveHeatmapDims(screenW, years.length, compactLabel);
  const finalLabelWidth = labelWidth || dims.labelWidth;
  const finalCellWidth = Math.max(preferredCellWidth || 0, dims.cellWidth);
  const finalRowHeight = dims.rowHeight;
  const headerRef = useRef<ScrollView | null>(null);

  const handleBodyHorizontalScroll = (x: number) => {
    headerRef.current?.scrollTo({ x, animated: false });
  };

  return (
    <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
      <Text style={[styles.panelTitle, { color: colors.textPrimary }]}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary, paddingVertical: 16 }]}>No heatmap data available.</Text>
      ) : (
        <View style={[styles.heatmapFrame, { borderColor: colors.border }]}> 
          <View style={[styles.heatmapStickyHeaderRow, { borderBottomColor: colors.border, backgroundColor: colors.surfaceStrong }]}> 
            <View style={[styles.heatmapStickyLabelHeader, { borderRightColor: colors.border, width: finalLabelWidth, height: finalRowHeight }]}> 
              <Text style={[styles.heatmapLabelHeaderText, { color: colors.textTertiary }]}>{labelHeader}</Text>
            </View>
            <ScrollView
              horizontal
              ref={headerRef}
              scrollEnabled={false}
              showsHorizontalScrollIndicator={false}
            >
              <View style={styles.heatmapYearHeaderTrack}>
                {years.map((year) => (
                  <TouchableOpacity 
                    key={`header-${labelHeader}-${year}`} 
                    style={[styles.heatmapYearHeaderCell, { borderRightColor: colors.border, width: finalCellWidth, height: finalRowHeight }]}
                    onPress={() => onYearPress?.(year)}
                    activeOpacity={0.6}
                  > 
                    <Text style={[styles.heatmapYearHeaderText, { color: colors.textTertiary }]}>{year}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <ScrollView style={styles.heatmapBodyScroll} nestedScrollEnabled>
            <View style={styles.heatmapBodyLayout}>
              <View style={[styles.heatmapStickyLabelColumn, { borderRightColor: colors.border, width: finalLabelWidth }]}> 
                {rows.map((row) => (
                  <TouchableOpacity 
                    key={`label-${row.key}`} 
                    style={[styles.heatmapStickyLabelCell, { borderBottomColor: colors.border + '55', width: finalLabelWidth, height: finalRowHeight }]}
                    onPress={() => onRowPress?.(row.label)}
                    activeOpacity={0.7}
                  > 
                    <View style={styles.heatmapLabelRow}>
                      <Text style={[styles.heatmapStickyLabelText, { color: colors.textSecondary, flex: 1, fontSize: 11, lineHeight: 15 }]} numberOfLines={2}>
                        {row.displayLabel || row.label}
                      </Text>
                      {onLabelActionPress && (
                        <TouchableOpacity 
                          onPress={() => onLabelActionPress(row.label)}
                          style={styles.labelActionBtn}
                        >
                          <FileStack size={14} color={colors.primary || '#7c3aed'} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator
                onScroll={(event) => handleBodyHorizontalScroll(event.nativeEvent.contentOffset.x)}
                scrollEventThrottle={16}
              >
                <View>
                  {rows.map((row) => (
                    <View key={`data-${row.key}`} style={[styles.heatmapDataRow, { borderBottomColor: colors.border + '55', height: finalRowHeight }]}> 
                      {years.map((year) => {
                        const count = row.byYear[year] || 0;
                        let bgColor = colors.surfaceStrong;
                        let textColor = colors.textTertiary;
                        let opacity = 1;

                        if (count > 0) {
                          // Scale ratio based on maxValue (defaults to 22 for global, set to 6 for deep-dives)
                          const denom = Math.max(1, (maxValue || 22) - 1);
                          const ratio = Math.min(1, (count - 1) / denom);
                          
                          if (heatmapPalette === 'spectral') {
                            // Spectral: Yellow-Green to Deep Blue
                            const h = 70 + (ratio * 155);
                            const s = 65 + (ratio * 25);
                            const l = 85 - (ratio * 55);
                            bgColor = `hsl(${h}, ${s}%, ${l}%)`;
                            textColor = l < 55 ? '#ffffff' : '#065f46';
                          } else if (heatmapPalette === 'ocean') {
                            // Ocean: Light Blue to Deep Navy
                            const h = 210 + (ratio * 15); // Stays in blue range
                            const s = 60 + (ratio * 35); // Gets more saturated
                            const l = 90 - (ratio * 65); // Gets much darker
                            bgColor = `hsl(${h}, ${s}%, ${l}%)`;
                            textColor = l < 55 ? '#ffffff' : '#1e3a8a';
                          } else if (heatmapPalette === 'sunset') {
                            // Sunset: Coral to Deep Orange/Red
                            const h = 10 + (ratio * 20); // Coral to Orange-Red
                            const s = 75 + (ratio * 20); // Gets more saturated
                            const l = 80 - (ratio * 55); // Gets much darker
                            bgColor = `hsl(${h}, ${s}%, ${l}%)`;
                            textColor = l < 55 ? '#ffffff' : '#7c2d12';
                          } else if (heatmapPalette === 'forest') {
                            // Forest: Light Green to Deep Forest Green
                            const h = 100 + (ratio * 80); // Green range
                            const s = 40 + (ratio * 45); // Gets more saturated
                            const l = 80 - (ratio * 50); // Gets darker
                            bgColor = `hsl(${h}, ${s}%, ${l}%)`;
                            textColor = l < 55 ? '#ffffff' : '#14532d';
                          }
                        } else {
                          opacity = 0.4;
                        }

                        return (
                          <TouchableOpacity
                            key={`${row.key}-${year}`}
                            style={[
                              styles.heatmapDataCell, 
                              { 
                                backgroundColor: bgColor, 
                                opacity,
                                borderRadius: 12,
                                margin: 1.5,
                                width: finalCellWidth - 3,
                                height: finalRowHeight - 3,
                              }
                            ]}
                            onPress={() => onCellPress?.(row.label, year)}
                          >
                            <Text style={[styles.heatCellText, { color: textColor, fontSize: 12, fontWeight: '800' }]}>{count || ''}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function PyqAnalysisTab({ isEmbedded }: { isEmbedded?: boolean }) {
  const { colors, isDark } = useTheme();
  const { selectedCourse } = useCourse();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{ fromTab?: string }>();
  
  // Get stages and papers for the selected course
  const currentStages = STAGES_BY_COURSE[selectedCourse] || STAGES_BY_COURSE['UPSC CSE'];
  const currentPapersByStage = PAPERS_BY_COURSE[selectedCourse] || PAPERS_BY_COURSE['UPSC CSE'];
  
  const taxonomyMaps = useMemo(() => {
    const microToSubject: Record<string, string> = {};
    const sectionToSubject: Record<string, string> = {};
    prelimsTaxonomy.forEach(entry => {
      if (entry.microTopic) microToSubject[entry.microTopic.trim().toLowerCase()] = entry.subject;
      if (entry.sectionGroup) sectionToSubject[entry.sectionGroup.trim().toLowerCase()] = entry.subject;
    });
    return { microToSubject, sectionToSubject };
  }, []);

  const isFirstMount = useRef(true);

  const initialStage = useMemo(() => {
    const stages = STAGES_BY_COURSE[selectedCourse] || STAGES_BY_COURSE['UPSC CSE'];
    if (params.fromTab === 'mains') {
      const mainsIndex = stages.findIndex(s => s.toLowerCase() === 'mains');
      if (mainsIndex !== -1) return stages[mainsIndex];
    }
    return stages[0];
  }, [selectedCourse, params.fromTab]);

  const initialPaper = useMemo(() => {
    const papersByStage = PAPERS_BY_COURSE[selectedCourse] || PAPERS_BY_COURSE['UPSC CSE'];
    const papers = papersByStage[initialStage as keyof typeof papersByStage];
    return papers?.[0] || null;
  }, [selectedCourse, initialStage]);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [examStage, setExamStage] = useState(initialStage);
  const [selectedPaper, setSelectedPaper] = useState<string | null>(initialPaper);

  useEffect(() => {
    if (params.fromTab === 'mains') {
      const mainsIndex = currentStages.findIndex(s => s.toLowerCase() === 'mains');
      if (mainsIndex !== -1) {
        const targetStage = currentStages[mainsIndex];
        setExamStage(targetStage);
        
        const papersForStage = currentPapersByStage[targetStage as keyof typeof currentPapersByStage];
        const firstPaper = papersForStage?.[0] || null;
        setSelectedPaper(firstPaper);
      }
    }
  }, [params.fromTab, currentStages, currentPapersByStage]);
  const [selectedRange, setSelectedRange] = useState('Last 10 Years');
  const [customYearStart, setCustomYearStart] = useState('2020');
  const [customYearEnd, setCustomYearEnd] = useState('2025');
  const [activeHub, setActiveHub] = useState<HubKey>('pilot');
  const [pilotSubject, setPilotSubject] = useState<string | null>(null);
  const [pilotSection, setPilotSection] = useState<string | null>(null);
  const [pilotMicro, setPilotMicro] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'stage' | 'paper' | 'range' | null>(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [questionExportVisible, setQuestionExportVisible] = useState(false);
  const [questionExportScope, setQuestionExportScope] = useState<'selected_subject' | 'all_subjects'>('selected_subject');
  const [questionExportSubject, setQuestionExportSubject] = useState('');
  const [questionExportSections, setQuestionExportSections] = useState<string[]>([]);
  const [questionExportMicros, setQuestionExportMicros] = useState<string[]>([]);
  const [questionExportFilterList, setQuestionExportFilterList] = useState<'subject' | 'section_group' | 'micro_topic'>('subject');
  const [questionExportYearMode, setQuestionExportYearMode] = useState<'all' | 'single' | 'range'>('all');
  const [questionExportSingleYear, setQuestionExportSingleYear] = useState('');
  const [questionExportYearStart, setQuestionExportYearStart] = useState('');
  const [questionExportYearEnd, setQuestionExportYearEnd] = useState('');

  const [rawQuestions, setRawQuestions] = useState<any[]>([]);
  const [testsMetaById, setTestsMetaById] = useState<Record<string, any>>({});
  const [distributionData, setDistributionData] = useState<Array<{ name: string; value: number }>>([]);
  const [heatmapData, setHeatmapData] = useState<Record<string, Record<string, number>>>({});
  const [topicYearHeatmap, setTopicYearHeatmap] = useState<Record<string, Record<string, number>>>({});
  const [topTopics, setTopTopics] = useState<string[]>([]);
  const [trendSubjects, setTrendSubjects] = useState<string[]>([]);
  const [selSubjects, setSelSubjects] = useState<string[]>([]);
  const [selSections, setSelSections] = useState<string[]>([]);
  const [selMicros, setSelMicros] = useState<string[]>([]);
  const [selSubtopics, setSelSubtopics] = useState<string[]>([]);
  
  const [focusSubject, setFocusSubject] = useState('All');
  const [focusSection, setFocusSection] = useState('All');
  const [focusMicro, setFocusMicro] = useState('All');
  const [exportSubject, setExportSubject] = useState('');

  const [heatmapPalette, setHeatmapPalette] = useState<'spectral' | 'ocean'>('spectral');

  // Auto-scroll refs/coords for PYQ analysis heatmap (Issue #20)
  const mainScrollRef = useRef<ScrollView | null>(null);
  const deepDivePanelYRef = useRef<number>(0);
  const microTopicsYRef = useRef<number>(0);
  const lastScrolledForSubjectRef = useRef<string | null>(null);
  const lastScrolledForSectionRef = useRef<string | null>(null);

  // When user clicks a subject, smoothly scroll to its deep-dive panel.
  useEffect(() => {
    if (!pilotSubject) {
      lastScrolledForSubjectRef.current = null;
      return;
    }
    if (lastScrolledForSubjectRef.current === pilotSubject) return;
    lastScrolledForSubjectRef.current = pilotSubject;
    // Wait for layout to settle before scrolling
    const t = setTimeout(() => {
      const y = Math.max(0, deepDivePanelYRef.current - 8);
      mainScrollRef.current?.scrollTo({ y, animated: true });
    }, 240);
    return () => clearTimeout(t);
  }, [pilotSubject]);

  // When user clicks a section group, smoothly scroll to the micro-topic heatmap.
  useEffect(() => {
    if (!pilotSection) {
      lastScrolledForSectionRef.current = null;
      return;
    }
    const key = `${pilotSubject}::${pilotSection}`;
    if (lastScrolledForSectionRef.current === key) return;
    lastScrolledForSectionRef.current = key;
    const t = setTimeout(() => {
      const y = Math.max(0, microTopicsYRef.current - 8);
      mainScrollRef.current?.scrollTo({ y, animated: true });
    }, 280);
    return () => clearTimeout(t);
  }, [pilotSection, pilotSubject]);
  const [undoSpec, setUndoSpec] = useState<UndoSpec | null>(null);
  const downloads = useDownloadManager();
  const { isExporting: guardBusy, guard } = useExportGuard();

  // Fade animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Reset stage and paper when course changes
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      if (params.fromTab === 'mains') return;
    }
    const newStages = STAGES_BY_COURSE[selectedCourse] || STAGES_BY_COURSE['UPSC CSE'];
    const newStage = newStages[0];
    setExamStage(newStage);
    
    const newPapersByStage = PAPERS_BY_COURSE[selectedCourse] || PAPERS_BY_COURSE['UPSC CSE'];
    const newPapers = newPapersByStage[newStage as keyof typeof newPapersByStage];
    const newPaper = newPapers?.[0] || null;
    setSelectedPaper(newPaper);
  }, [selectedCourse]);

  useEffect(() => {
    fetchPyqData();
  }, [examStage, selectedPaper, selectedRange, customYearStart, customYearEnd, selectedCourse]);

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [loading]);

  const getAnalyticsSubject = (q: any) => {
    return String(q.subject || '').trim().toUpperCase() || 'MISCELLANEOUS';
  };

  const getAnalyticsYear = (q: any) => {
    const test = testsMetaById[String(q.test_id)] || {};
    const y = q.exam_year || q.year || q.launch_year || q.source?.year || test.launch_year || test.exam_year;
    const num = parseInt(String(y), 10);
    return Number.isFinite(num) && num > 1900 ? num : null;
  };

  const parseYearRange = () => {
    const start = parseInt(customYearStart, 10);
    const end = parseInt(customYearEnd, 10);
    if (Number.isNaN(start) || Number.isNaN(end)) return null;
    return { start: Math.min(start, end), end: Math.max(start, end) };
  };

  const extractYearFromTitle = (value: string) => {
    const match = String(value || '').match(/(20\d{2})/);
    return match ? parseInt(match[1], 10) : null;
  };

  const normalizePyqPaperGroup = (value = '', fallbackStage = '') => {
    const text = String(value || '').trim().toLowerCase();
    const stage = String(fallbackStage || '').trim().toLowerCase();
    if (!text) return '';
    if (text === 'gs paper 1' || text === 'paper 1' || text === 'gs1' || text === 'pre_gs1' || text.includes('gs paper 1')) return 'GS Paper 1';
    if (text === 'csat' || text === 'gs paper 2' || text === 'paper 2' || text === 'gs2' || text === 'pre_csat' || text.includes('csat') || text.includes('paper 2') || (text === 'pre_gs2' && stage.includes('prelim'))) return 'GS Paper 2';
    if (text === 'gs paper 3' || text === 'paper 3' || text === 'gs3') return 'GS Paper 3';
    if (text === 'gs paper 4' || text === 'paper 4' || text === 'gs4') return 'GS Paper 4';
    return String(value || '').trim();
  };

  const resolveTestPaperGroup = (test: any) =>
    normalizePyqPaperGroup(
      test.section_group || test.sectionGroup || test.level || test.title || '',
      test.level || test.series || ''
    );

  const getTestYear = (test: any) => {
    const num = Number(test?.launch_year || test?.exam_year || extractYearFromTitle(test?.title || ''));
    return Number.isFinite(num) && num > 1900 ? num : null;
  };

  const matchesYearRange = (year: number | null) => {
    if (!year) return false;
    if (selectedRange === 'Only 2025') return year === 2025;
    if (selectedRange === 'Last 5 Years') return year >= 2021;
    if (selectedRange === 'Last 10 Years') return year >= 2016;
    if (selectedRange === 'Custom Range') {
      const range = parseYearRange();
      if (!range) return true;
      return year >= range.start && year <= range.end;
    }
    return true;
  };

  const fetchQuestionsForTests = async (testIds: string[]) => {
    // OFFLINE-FIRST: use cached questions when available.
    const cachedQuestions = OfflineManager.getOfflineQuestionsAllSync() || [];
    if (cachedQuestions.length > 0) {
      const cachedRows = cachedQuestions.filter((q: any) => testIds.includes(q.test_id));
      if (cachedRows.length > 0) {
        return cachedRows;
      }
    }

    const rows: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('questions')
        .select('*, tests(institute)')
        .in('test_id', testIds)
        .eq('course', selectedCourse)
        .order('test_id', { ascending: true })
        .order('question_number', { ascending: true })
        .range(from, from + PYQ_PAGE_SIZE - 1);
      if (error) throw error;
      if (!data?.length) break;
      rows.push(...data);
      if (data.length < PYQ_PAGE_SIZE) break;
      from += PYQ_PAGE_SIZE;
    }
    return rows;
  };

  const fetchPyqData = async (bypassCache = false) => {
    const stageNorm = examStage.toLowerCase();
    const targetPaperGroup = normalizePyqPaperGroup(selectedPaper, examStage);
    const cacheKey = `pyq_cache_${stageNorm}_${targetPaperGroup.replace(/\s+/g, '_')}_${selectedRange.replace(/\s+/g, '_')}`;

    if (!bypassCache) {
      try {
        const cached = KVStore.getJson(cacheKey);
        if (cached) {
          setRawQuestions(cached.questions || []);
          setTestsMetaById(cached.testsMeta || {});
          processAnalytics(cached.questions || []);
        } else {
          setLoading(true);
        }
      } catch (e) {
        setLoading(true);
      }
    }

    try {
      // CourseContext uses 'Civil Services' but legacy code also uses 'UPSC CSE'
      const isUpscCseCourse = selectedCourse === 'UPSC CSE' || selectedCourse === 'Civil Services';
      if (stageNorm === 'mains' && isUpscCseCourse) {
        try {
          // Map UI paper labels to DB paper column values (mains_questions.paper)
          let mappedPaper = 'GS1';
          if (targetPaperGroup === 'GS Paper 1') mappedPaper = 'GS1';
          else if (targetPaperGroup === 'GS Paper 2') mappedPaper = 'GS2';
          else if (targetPaperGroup === 'GS Paper 3') mappedPaper = 'GS3';
          else if (targetPaperGroup === 'GS Paper 4') mappedPaper = 'GS4';
          else if (targetPaperGroup === 'Optional') mappedPaper = 'Optional';
          
          console.log(`[MainsFetch] Querying mains_questions for paper: ${mappedPaper}, stage: ${examStage}`);
          
          // Query Supabase mains_questions with paper filter and is_pyq=true at DB level
          const { data, error: mainsErr } = await supabase
            .from('mains_questions')
            .select('id, question_number, question_text, marks, exam_year, subject, section_group, microtopic, subtopic, macrotag, microtag, hierarchy_path, paper, is_pyq, source_attribution_label, exam_info, stage, exam, exam_group, is_upsc_cse, is_allied, is_others, exam_category, answers:mains_answers(id, institute)')
            .eq('paper', mappedPaper)
            .eq('is_pyq', true);
          
          if (mainsErr) throw mainsErr;
          
          const mainsQs: any[] = data || [];
          console.log('[MainsFetch] Fetched from Supabase:', mainsQs.length, 'questions for paper:', mappedPaper);
          
          if (mainsQs.length === 0) {
            console.warn(`[MainsFetch] No questions found for paper=${mappedPaper} in mains_questions table`);
            clearComputedState();
            setRawQuestions([]);
            setTestsMetaById({});
            setLoading(false);
            return;
          }
          
          // Normalize Supabase column names to match the analytics code expectations
          const allMainsQuestions = mainsQs.map((q: any) => ({
            id: q.id,
            questionNumber: q.question_number,
            questionText: q.question_text,
            marks: q.marks,
            year: q.exam_year,
            subject: q.subject,
            sectionGroup: q.section_group,
            microTopic: q.microtopic,
            subTopic: q.subtopic,
            macrotag: q.macrotag,
            microtag: q.microtag,
            hierarchy_path: q.hierarchy_path || [],
            paper: q.paper || mappedPaper,
            is_pyq: q.is_pyq,
            source_attribution_label: q.source_attribution_label,
            exam_info: q.exam_info,
            stage: q.stage,
            exam: q.exam,
            exam_group: q.exam_group,
            is_upsc_cse: q.is_upsc_cse,
            is_allied: q.is_allied,
            is_others: q.is_others,
            exam_category: q.exam_category,
            answers: (q.answers || []).map((ans: any) => ({
              id: ans.id,
              institute: ans.institute,
              answerText: ans.answer_text,
            }))
          }));

          const visibleQs = allMainsQuestions.filter((q: any) => {
            const yr = q.year;
            return matchesYearRange(yr);
          });

          if (visibleQs.length === 0) {
            console.warn(`[MainsFetch] No questions match year range for paper=${mappedPaper}`);
          }

          const mockTestsMeta: Record<string, any> = {};
          const formattedQs = visibleQs.map((q: any) => {
            const mockTestId = `mains-${mappedPaper.toLowerCase()}-${q.year}`;
            if (!mockTestsMeta[mockTestId]) {
              mockTestsMeta[mockTestId] = {
                id: mockTestId,
                title: `${q.year} - Mains - ${targetPaperGroup} - UPSC`,
                series: 'Mains (Official)',
                level: targetPaperGroup,
                launch_year: q.year,
                exam_year: q.year,
                institute: 'UPSC',
                program_id: 'cse',
                program_name: 'CSE',
              };
            }
            
            return {
              id: q.id,
              question_text: q.questionText,
              question_number: q.questionNumber,
              marks: q.marks,
              year: q.year,
              exam_year: q.year,
              subject: q.subject,
              section_group: q.sectionGroup,
              micro_topic: q.microTopic,
              sub_topic: q.subTopic,
              macrotag: q.macrotag,
              microtag: q.microtag,
              hierarchy_path: q.hierarchy_path || [],
              paper: q.paper,
              test_id: mockTestId,
              _institute: 'UPSC',
              _explanations: (q.answers || []).map((ans: any) => ({
                id: ans.id,
                institute: ans.institute,
                source: ans.institute,
                explanationText: ans.answerText,
                text: ans.answerText,
              })),
              _institutes: (q.answers || []).map((ans: any) => ans.institute).filter(Boolean),
            };
          });

          setRawQuestions(formattedQs);
          setTestsMetaById(mockTestsMeta);
          processAnalytics(formattedQs);

          KVStore.setJson(cacheKey, {
            questions: formattedQs,
            testsMeta: mockTestsMeta,
            timestamp: Date.now()
          });
          setLoading(false);
          return;
        } catch (err) {
          console.error('[MainsFetch] Error loading mains questions from Supabase:', err);
          clearComputedState();
          setRawQuestions([]);
          setTestsMetaById({});
          setLoading(false);
          return;
        }
      }

      // OFFLINE-FIRST: use cached tests metadata first.
      let tests: any[] = (OfflineManager as any).getOfflineTestsSync?.() || [];

      if (!tests || tests.length === 0) {
        const { data: networkTests, error: testError } = await supabase
          .from('tests')
          .select('id, title, subject, level, paper_type, section_group, exam_year, launch_year, institute, program_id, program_name, series')
          .eq('course', selectedCourse);
        if (testError) throw testError;
        tests = networkTests || [];
      }

      const relevantTests = (tests || []).filter((test: any) => {
        const institute = String(test.institute || '').trim().toLowerCase();
        const programId = String(test.program_id || '').trim().toLowerCase();
        const programName = String(test.program_name || '').trim().toLowerCase();
        const series = String(test.series || '').trim().toLowerCase();
        const paperType = String(test.paper_type || '').trim().toLowerCase();

        if (isUpscCseCourse) {
          if (institute !== 'upsc') return false;
          if (programId !== 'cse' && programName !== 'cse') return false;
          const targetSeries = stageNorm === 'prelims' ? 'prelims (official)' : 'mains (official)';
          if (series !== targetSeries) return false;
        } else {
          if (stageNorm && !series.includes(stageNorm)) return false;
        }

        if (paperType && !['test-paper', 'question bank'].includes(paperType)) return false;
        return resolveTestPaperGroup(test) === targetPaperGroup;
      });
      const visibleTests = relevantTests.filter((test: any) => matchesYearRange(getTestYear(test)));

      if (visibleTests.length === 0) {
        clearComputedState();
        setRawQuestions([]);
        setTestsMetaById({});
        return;
      }

      const testIds = visibleTests.map((test: any) => test.id);
      const testsMetaMap = Object.fromEntries(visibleTests.map((test: any) => [String(test.id), test]));
      const questions = await fetchQuestionsForTests(testIds);
      
      // Run dedup merge so each question carries _explanations and _institutes
      const { mergedQs } = mergeQuestions(questions);

      // Enrich with cross-institute explanations from other coaching institutes
      // (runs fuzzy Jaccard matching against non-UPSC PYQ variants in the DB)
      try {
        await enrichWithCrossInstituteExplanations(mergedQs, supabase);
      } catch (enrichErr) {
        console.warn('[PYQ] Cross-institute enrichment failed (non-fatal)', enrichErr);
      }

      setRawQuestions(mergedQs);
      setTestsMetaById(testsMetaMap);
      processAnalytics(mergedQs);

      // Save to cache — store enriched questions so _institutes/_explanations survive cache
      KVStore.setJson(cacheKey, {
        questions: mergedQs,
        testsMeta: testsMetaMap,
        timestamp: Date.now()
      });

    } catch (err) {
      console.error('PYQ analysis fetch error', err);
      if (!bypassCache) { // Only clear if we didn't have cache to begin with
        clearComputedState();
        setRawQuestions([]);
        setTestsMetaById({});
      }
    } finally {
      setLoading(false);
    }
  };

  const clearComputedState = () => {
    setDistributionData([]);
    setHeatmapData({});
    setTopicYearHeatmap({});
    setTopTopics([]);
    setTrendSubjects([]);
    
    // Clear selection states
    setPilotSubject(null);
    setPilotSection(null);
    setOneSub(null);
    setOneSec(null);
    setSelSubjects([]);
    setSelSections([]);
    setSelMicros([]);
    
    setSectionData([]);
    setMicroTopicData([]);
  };

  const [topicSubjectMap, setTopicSubjectMap] = useState<Record<string, string>>({});

  const processAnalytics = (data: any[]) => {
    if (!data.length) {
      clearComputedState();
      return;
    }

    const subjectMap: Record<string, number> = {};
    const yearSubjectMap: Record<string, Record<string, number>> = {};
    const topicMap: Record<string, number> = {};
    const topicYearMap: Record<string, Record<string, number>> = {};
    const topicToSubject: Record<string, string> = {};

    data.forEach(q => {
      const subject = getAnalyticsSubject(q);
      const year = getAnalyticsYear(q);
      if (!year) return;
      const yearKey = String(year);

      subjectMap[subject] = (subjectMap[subject] || 0) + 1;
      if (!yearSubjectMap[yearKey]) yearSubjectMap[yearKey] = {};
      yearSubjectMap[yearKey][subject] = (yearSubjectMap[yearKey][subject] || 0) + 1;

      const topic = q.micro_topic || q.section_group || 'Other';
      topicMap[topic] = (topicMap[topic] || 0) + 1;
      if (!topicYearMap[topic]) topicYearMap[topic] = {};
      topicYearMap[topic][yearKey] = (topicYearMap[topic][yearKey] || 0) + 1;
      if (!topicToSubject[topic]) topicToSubject[topic] = subject;
    });

    const sortedSubjects = Object.entries(subjectMap).sort((a, b) => b[1] - a[1]);
    const hottestTopics = Object.entries(topicMap).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name]) => name);

    setDistributionData(sortedSubjects.map(([name, value]) => ({ name, value })));
    setHeatmapData(yearSubjectMap);
    setTopTopics(hottestTopics);
    setTopicSubjectMap(topicToSubject);
    // Default to Economy-only trend selection when available; otherwise fall back
    // to top subject. Users can add more via chips.
    const economy = sortedSubjects.find(([name]) => name.toLowerCase() === 'economy');
    setTrendSubjects(economy ? ['Economy'] : sortedSubjects.slice(0, 1).map(([name]) => name));

    const filteredTopicHeatmap: Record<string, Record<string, number>> = {};
    hottestTopics.forEach(topic => {
      filteredTopicHeatmap[topic] = topicYearMap[topic] || {};
    });
    setTopicYearHeatmap(filteredTopicHeatmap);
  };

  // Single subject selection for the Distribution Donut (reusing existing logic for now)
  const [oneSub, setOneSub] = useState<string | null>(null);
  const [oneSec, setOneSec] = useState<string | null>(null);
  const [oneMicro, setOneMicro] = useState<string | null>(null);
  const [sectionData, setSectionData] = useState<Array<{ name: string; value: number }>>([]);
  const [microTopicData, setMicroTopicData] = useState<Array<{ name: string; value: number }>>([]);
  const [subTopicData, setSubTopicData] = useState<Array<{ name: string; value: number }>>([]);

  useEffect(() => {
    if (!oneSub) {
      setSectionData([]);
      setOneSec(null);
      setOneMicro(null);
      return;
    }
    const sectionMap: Record<string, number> = {};
    rawQuestions
      .filter(q => getAnalyticsSubject(q) === oneSub)
      .forEach(q => {
        const section = q.section_group || 'General';
        sectionMap[section] = (sectionMap[section] || 0) + 1;
      });
    setSectionData(Object.entries(sectionMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));
  }, [oneSub, rawQuestions]);

  useEffect(() => {
    if (!oneSub || !oneSec) {
      setMicroTopicData([]);
      setOneMicro(null);
      return;
    }
    const microMap: Record<string, number> = {};
    rawQuestions
      .filter(q => getAnalyticsSubject(q) === oneSub && (q.section_group || 'General') === oneSec)
      .forEach(q => {
        const micro = q.micro_topic || q.microTopic || 'Other';
        microMap[micro] = (microMap[micro] || 0) + 1;
      });
    setMicroTopicData(Object.entries(microMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));
  }, [oneSub, oneSec, rawQuestions]);

  useEffect(() => {
    if (!oneSub || !oneSec || !oneMicro) {
      setSubTopicData([]);
      return;
    }
    const subMap: Record<string, number> = {};
    rawQuestions
      .filter(q => {
        const sub = getAnalyticsSubject(q);
        const sec = q.section_group || 'General';
        const micro = q.micro_topic || q.microTopic || 'Other';
        return sub === oneSub && sec === oneSec && micro === oneMicro;
      })
      .forEach(q => {
        const subtopic = q.subTopic || q.sub_topic || 'Other';
        subMap[subtopic] = (subMap[subtopic] || 0) + 1;
      });
    setSubTopicData(Object.entries(subMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));
  }, [oneSub, oneSec, oneMicro, rawQuestions]);

  const years = useMemo(() => {
    const questionYears = rawQuestions
      .map(getAnalyticsYear)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const testYears = Object.values(testsMetaById)
      .map((test: any) => getTestYear(test))
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    return Array.from(new Set([...questionYears, ...testYears]))
      .sort((a, b) => b - a)
      .map(String);
  }, [rawQuestions, testsMetaById]);

  const heatmapSections = useMemo(() => {
    if (selSubjects.length === 0) return [];
    const map: Record<string, Record<string, number>> = {};
    rawQuestions
      .filter(q => selSubjects.includes(getAnalyticsSubject(q)))
      .forEach(q => {
        const section = q.section_group || 'General';
        const year = String(getAnalyticsYear(q) || '');
        if (!year) return;
        if (!map[section]) map[section] = {};
        map[section][year] = (map[section][year] || 0) + 1;
      });
    return Object.entries(map)
      .map(([name, byYear]) => ({ name, byYear, total: Object.values(byYear).reduce((sum, val) => sum + val, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 16);
  }, [rawQuestions, selSubjects, years]);

  const heatmapMicros = useMemo(() => {
    if (selSubjects.length === 0) return [];
    const map: Record<string, Record<string, number>> = {};
    rawQuestions
      .filter(q => {
        const sub = getAnalyticsSubject(q);
        if (!selSubjects.includes(sub)) return false;
        if (selSections.length > 0 && !selSections.includes(q.section_group || 'General')) return false;
        return true;
      })
      .forEach(q => {
        const micro = q.micro_topic || 'Other';
        const year = String(getAnalyticsYear(q) || '');
        if (!year) return;
        if (!map[micro]) map[micro] = {};
        map[micro][year] = (map[micro][year] || 0) + 1;
      });
    return Object.entries(map)
      .map(([name, byYear]) => ({ name, byYear, total: Object.values(byYear).reduce((sum, val) => sum + val, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 24);
  }, [rawQuestions, selSubjects, selSections, years]);

  const subjectHeatmapRows = useMemo<HeatmapRow[]>(() => {
    return distributionData.slice(0, 16).map(item => ({
      key: `subject-${item.name}`,
      label: item.name,
      byYear: years.reduce((acc, year) => {
        const count = heatmapData[year]?.[item.name] || 0;
        if (count) acc[year] = count;
        return acc;
      }, {} as Record<string, number>),
    }));
  }, [distributionData, years, heatmapData]);

  const topicHeatmapRows = useMemo<HeatmapRow[]>(() => {
    return topTopics.map(topic => {
      const subject = topicSubjectMap[topic];
      const combined = subject && subject !== topic ? `${subject} · ${topic}` : topic;
      return {
        key: `topic-${topic}`,
        label: topic,          // original topic — used by callbacks
        displayLabel: combined, // visual label (subject + topic single column)
        byYear: topicYearHeatmap[topic] || {},
      };
    });
  }, [topTopics, topicYearHeatmap, topicSubjectMap]);

  const sectionHeatmapRows = useMemo<HeatmapRow[]>(() => {
    return heatmapSections.map(item => ({
      key: `section-${item.name}`,
      label: item.name,
      byYear: item.byYear,
    }));
  }, [heatmapSections]);

  const microHeatmapRows = useMemo<HeatmapRow[]>(() => {
    return heatmapMicros.map(item => ({
      key: `micro-${item.name}`,
      label: item.name,
      byYear: item.byYear,
    }));
  }, [heatmapMicros]);

  const allSections = useMemo(() => {
    if (selSubjects.length === 0) return [];
    const set = new Set<string>();
    rawQuestions
      .filter(q => selSubjects.includes(getAnalyticsSubject(q)))
      .forEach(q => set.add(q.section_group || 'General'));
    return Array.from(set).sort();
  }, [rawQuestions, selSubjects]);

  const allMicros = useMemo(() => {
    if (selSubjects.length === 0) return [];
    const set = new Set<string>();
    rawQuestions
      .filter(q => {
        const sub = getAnalyticsSubject(q);
        if (!selSubjects.includes(sub)) return false;
        if (selSections.length > 0 && !selSections.includes(q.section_group || 'General')) return false;
        return true;
      })
      .forEach(q => set.add(q.micro_topic || q.microTopic || 'Other'));
    return Array.from(set).sort();
  }, [rawQuestions, selSubjects, selSections]);

  const allSubtopics = useMemo(() => {
    if (selSubjects.length === 0) return [];
    const set = new Set<string>();
    rawQuestions
      .filter(q => {
        const sub = getAnalyticsSubject(q);
        if (!selSubjects.includes(sub)) return false;
        if (selSections.length > 0 && !selSections.includes(q.section_group || 'General')) return false;
        const microVal = q.micro_topic || q.microTopic || 'Other';
        if (selMicros.length > 0 && !selMicros.includes(microVal)) return false;
        return true;
      })
      .forEach(q => {
        const subtopic = q.subTopic || q.sub_topic;
        if (subtopic) set.add(subtopic);
      });
    return Array.from(set).sort();
  }, [rawQuestions, selSubjects, selSections, selMicros]);

  const heatmapSubtopics = useMemo(() => {
    if (selSubjects.length === 0) return [];
    const map: Record<string, Record<string, number>> = {};
    rawQuestions
      .filter(q => {
        const sub = getAnalyticsSubject(q);
        if (!selSubjects.includes(sub)) return false;
        if (selSections.length > 0 && !selSections.includes(q.section_group || 'General')) return false;
        const microVal = q.micro_topic || q.microTopic || 'Other';
        if (selMicros.length > 0 && !selMicros.includes(microVal)) return false;
        return true;
      })
      .forEach(q => {
        const subtopic = q.subTopic || q.sub_topic || 'Other';
        const year = String(getAnalyticsYear(q) || '');
        if (!year) return;
        if (!map[subtopic]) map[subtopic] = {};
        map[subtopic][year] = (map[subtopic][year] || 0) + 1;
      });
    return Object.entries(map)
      .map(([name, byYear]) => ({ name, byYear, total: Object.values(byYear).reduce((sum, val) => sum + val, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 24);
  }, [rawQuestions, selSubjects, selSections, selMicros, years]);

  const subtopicHeatmapRows = useMemo<HeatmapRow[]>(() => {
    return heatmapSubtopics.map(item => ({
      key: `subtopic-${item.name}`,
      label: item.name,
      byYear: item.byYear,
    }));
  }, [heatmapSubtopics]);

  const trendColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    distributionData.forEach((item, index) => {
      map[item.name] = TREND_PALETTE[index % TREND_PALETTE.length];
    });
    return map;
  }, [distributionData]);

  const topThreeSubjects = useMemo(() => distributionData.slice(0, 3), [distributionData]);
  const exportSubjects = useMemo(() => distributionData.map(item => item.name), [distributionData]);

  const questionExportBaseQuestions = useMemo(() => {
    return rawQuestions.filter((q) => {
      if (questionExportScope === 'all_subjects') return true;
      if (!questionExportSubject) return true;
      return getAnalyticsSubject(q) === questionExportSubject;
    });
  }, [rawQuestions, questionExportScope, questionExportSubject]);

  const questionExportSectionOptions = useMemo(() => {
    const set = new Set<string>();
    questionExportBaseQuestions.forEach((q) => set.add(q.section_group || 'General'));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [questionExportBaseQuestions]);

  const questionExportMicroOptions = useMemo(() => {
    const set = new Set<string>();
    questionExportBaseQuestions
      .filter((q) => questionExportSections.length === 0 || questionExportSections.includes(q.section_group || 'General'))
      .forEach((q) => set.add(q.micro_topic || 'Other'));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [questionExportBaseQuestions, questionExportSections]);

  const questionExportYearOptions = useMemo(() => {
    const set = new Set<number>();
    questionExportBaseQuestions.forEach((q) => {
      const year = getAnalyticsYear(q);
      if (typeof year === 'number' && Number.isFinite(year)) {
        set.add(year);
      }
    });
    return Array.from(set).sort((a, b) => b - a).map(String);
  }, [questionExportBaseQuestions, getAnalyticsYear]);

  const questionExportYearBounds = useMemo(() => {
    if (questionExportYearMode === 'all') return { start: null as number | null, end: null as number | null };

    if (questionExportYearMode === 'single') {
      const year = Number(questionExportSingleYear);
      if (!Number.isFinite(year)) return { start: null as number | null, end: null as number | null };
      return { start: year, end: year };
    }

    const start = Number(questionExportYearStart);
    const end = Number(questionExportYearEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return { start: null as number | null, end: null as number | null };
    }
    return { start: Math.min(start, end), end: Math.max(start, end) };
  }, [questionExportYearMode, questionExportSingleYear, questionExportYearStart, questionExportYearEnd]);

  const questionExportFilteredQuestions = useMemo(() => {
    return questionExportBaseQuestions.filter((q) => {
      const sectionGroup = q.section_group || 'General';
      const microTopic = q.micro_topic || 'Other';
      if (questionExportSections.length > 0 && !questionExportSections.includes(sectionGroup)) return false;
      if (questionExportMicros.length > 0 && !questionExportMicros.includes(microTopic)) return false;

      if (questionExportYearBounds.start != null || questionExportYearBounds.end != null) {
        const year = getAnalyticsYear(q);
        if (!year) return false;
        if (questionExportYearBounds.start != null && year < questionExportYearBounds.start) return false;
        if (questionExportYearBounds.end != null && year > questionExportYearBounds.end) return false;
      }

      return true;
    });
  }, [
    questionExportBaseQuestions,
    questionExportSections,
    questionExportMicros,
    questionExportYearBounds,
    getAnalyticsYear,
  ]);

  const questionExportSummary = useMemo(() => {
    if (!questionExportFilteredQuestions.length) return null;

    const subjectTotals: Record<string, number> = {};
    const subjectByYear: Record<string, Record<string, number>> = {};
    const sectionTotals: Record<string, number> = {};
    const sectionByYear: Record<string, Record<string, number>> = {};
    const microTotals: Record<string, number> = {};
    const microByYear: Record<string, Record<string, number>> = {};
    const topicTotals: Record<string, number> = {};
    const topicByYear: Record<string, Record<string, number>> = {};
    const totalsByYear: Record<string, number> = {};

    questionExportFilteredQuestions.forEach((q) => {
      const yearNum = getAnalyticsYear(q);
      if (!yearNum) return;
      const year = String(yearNum);
      const subject = getAnalyticsSubject(q);
      const section = q.section_group || 'General';
      const micro = q.micro_topic || 'Other';
      const topic = micro || section;

      subjectTotals[subject] = (subjectTotals[subject] || 0) + 1;
      if (!subjectByYear[year]) subjectByYear[year] = {};
      subjectByYear[year][subject] = (subjectByYear[year][subject] || 0) + 1;

      sectionTotals[section] = (sectionTotals[section] || 0) + 1;
      if (!sectionByYear[section]) sectionByYear[section] = {};
      sectionByYear[section][year] = (sectionByYear[section][year] || 0) + 1;

      microTotals[micro] = (microTotals[micro] || 0) + 1;
      if (!microByYear[micro]) microByYear[micro] = {};
      microByYear[micro][year] = (microByYear[micro][year] || 0) + 1;

      topicTotals[topic] = (topicTotals[topic] || 0) + 1;
      if (!topicByYear[topic]) topicByYear[topic] = {};
      topicByYear[topic][year] = (topicByYear[topic][year] || 0) + 1;

      totalsByYear[year] = (totalsByYear[year] || 0) + 1;
    });

    const summaryYears = Object.keys(totalsByYear).sort((a, b) => Number(b) - Number(a));
    if (!summaryYears.length) return null;

    const subjectSorted = Object.entries(subjectTotals).sort((a, b) => b[1] - a[1]);
    const sectionSorted = Object.entries(sectionTotals).sort((a, b) => b[1] - a[1]);
    const microSorted = Object.entries(microTotals).sort((a, b) => b[1] - a[1]);

    const isSingleSubject = questionExportScope === 'selected_subject' && !!questionExportSubject;
    const deepDiveSubject = isSingleSubject ? questionExportSubject : null;

    const subjectHeatmapRowsLocal = subjectSorted.slice(0, 16).map(([name]) => ({
      key: `subject-${name}`,
      label: name,
      byYear: summaryYears.reduce((acc, year) => {
        const count = subjectByYear[year]?.[name] || 0;
        if (count) acc[year] = count;
        return acc;
      }, {} as Record<string, number>),
    }));

    const topicHeatmapRowsLocal = Object.entries(topicTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name]) => ({
        key: `topic-${name}`,
        label: name,
        byYear: topicByYear[name] || {},
      }));

    const sectionHeatmapRowsLocal = sectionSorted.slice(0, 20).map(([name]) => ({
      key: `section-${name}`,
      label: name,
      byYear: sectionByYear[name] || {},
    }));

    const microHeatmapRowsLocal = microSorted.slice(0, 24).map(([name]) => ({
      key: `micro-${name}`,
      label: name,
      byYear: microByYear[name] || {},
    }));

    const distributionRows = isSingleSubject
      ? sectionSorted.map(([name, value]) => ({ name, value }))
      : subjectSorted.map(([name, value]) => ({ name, value }));

    const topTrendSubjects = subjectSorted.slice(0, 4).map(([name]) => name);
    const overviewSeriesLocal = isSingleSubject && deepDiveSubject
      ? [{
          label: deepDiveSubject,
          values: summaryYears.map((year) => subjectByYear[year]?.[deepDiveSubject] || 0),
          color: '#2563EB',
        }]
      : topTrendSubjects.map((subject, index) => ({
          label: subject,
          values: summaryYears.map((year) => subjectByYear[year]?.[subject] || 0),
          color: TREND_PALETTE[index % TREND_PALETTE.length],
        }));

    const focusLabel = questionExportMicros.length === 1
      ? questionExportMicros[0]
      : questionExportMicros.length > 1
        ? 'Selected Micro Topics'
        : questionExportSections.length === 1
          ? questionExportSections[0]
          : questionExportSections.length > 1
            ? 'Selected Section Groups'
            : deepDiveSubject || 'Selected Scope';

    const focusTrendSeriesLocal = [{
      label: focusLabel,
      values: summaryYears.map((year) => totalsByYear[year] || 0),
      color: '#2563EB',
    }];

    return {
      questionCount: questionExportFilteredQuestions.length,
      years: summaryYears,
      distributionRows,
      overviewSeries: overviewSeriesLocal,
      focusTrendSeries: focusTrendSeriesLocal,
      focusSubject: deepDiveSubject || 'All',
      focusSection: questionExportSections.length === 1 ? questionExportSections[0] : 'All',
      focusMicro: questionExportMicros.length === 1 ? questionExportMicros[0] : 'All',
      primaryHeatmapRows: isSingleSubject ? sectionHeatmapRowsLocal : subjectHeatmapRowsLocal,
      secondaryHeatmapRows: isSingleSubject ? microHeatmapRowsLocal : topicHeatmapRowsLocal,
      momentumTitle: isSingleSubject && deepDiveSubject ? `${deepDiveSubject} Momentum` : 'Subject Momentum',
      distributionTitle: isSingleSubject ? `${deepDiveSubject} Section Group Distribution` : 'Subject Distribution (Donut)',
      focusedTitle: isSingleSubject ? `${deepDiveSubject} Focused Trend` : 'Focused Trend',
      primaryHeatmapTitle: isSingleSubject && deepDiveSubject ? `${deepDiveSubject} Section Group × Year Heatmap` : 'Subject × Year Heatmap',
      primaryHeatmapLabel: isSingleSubject ? 'Section Group' : 'Subject',
      secondaryHeatmapTitle: isSingleSubject && deepDiveSubject ? `${deepDiveSubject} Micro Topic × Year Heatmap` : 'Top 20 Topics × Year Heatmap',
      secondaryHeatmapLabel: isSingleSubject ? 'Micro Topic' : 'Topic',
    };
  }, [
    questionExportFilteredQuestions,
    questionExportScope,
    questionExportSubject,
    questionExportSections,
    questionExportMicros,
    getAnalyticsSubject,
    getAnalyticsYear,
  ]);

  const buildAnalysisExecutiveSummaryHtml = (selectedReports: Record<string, boolean>): string => {
    if (!questionExportSummary) return '';

    const yearRangeLabel = questionExportYearBounds.start == null || questionExportYearBounds.end == null
      ? 'All Years'
      : questionExportYearBounds.start === questionExportYearBounds.end
        ? `Year ${questionExportYearBounds.start}`
        : `${questionExportYearBounds.start}-${questionExportYearBounds.end}`;

    // Forecast data — produced from currently filtered raw questions so the
    // Forecast export honours the user's subject / section / year selections.
    let forecastRows: Array<{
      key: string;
      label: string;
      totalQuestions: number;
      streak: number;
      trend: 'rising' | 'falling' | 'stable';
      forecastPoint: number;
      forecastLow: number;
      forecastHigh: number;
      hotScore: number;
    }> | undefined;
    if (selectedReports.forecast || selectedReports.full_report) {
      try {
        const predictive = buildPredictive(rawQuestions, getAnalyticsYear, {
          level: 'micro_topic',
          getSubject: getAnalyticsSubject,
        });
        const hots = probableHotsFor2026(predictive, 1, 12);
        forecastRows = hots.map((row) => ({
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
      } catch {
        forecastRows = undefined;
      }
    }

    return buildPyqAnalysisSummaryHtml({
      selectedReports,
      examStage,
      selectedPaper,
      selectedRange: yearRangeLabel,
      customYearStart: questionExportYearBounds.start != null ? String(questionExportYearBounds.start) : '',
      customYearEnd: questionExportYearBounds.end != null ? String(questionExportYearBounds.end) : '',
      questionCount: questionExportSummary.questionCount,
      years: questionExportSummary.years,
      distributionData: questionExportSummary.distributionRows,
      overviewSeries: questionExportSummary.overviewSeries,
      focusTrendSeries: questionExportSummary.focusTrendSeries,
      focusSubject: questionExportSummary.focusSubject,
      focusSection: questionExportSummary.focusSection,
      focusMicro: questionExportSummary.focusMicro,
      subjectHeatmapRows: questionExportSummary.primaryHeatmapRows,
      topicHeatmapRows: questionExportSummary.secondaryHeatmapRows,
      heatmapPalette,
      momentumTitle: questionExportSummary.momentumTitle,
      distributionTitle: questionExportSummary.distributionTitle,
      focusedTitle: questionExportSummary.focusedTitle,
      primaryHeatmapTitle: questionExportSummary.primaryHeatmapTitle,
      primaryHeatmapLabel: questionExportSummary.primaryHeatmapLabel,
      secondaryHeatmapTitle: questionExportSummary.secondaryHeatmapTitle,
      secondaryHeatmapLabel: questionExportSummary.secondaryHeatmapLabel,
      forecastRows,
      forecastTitle: questionExportScope === 'selected_subject' && questionExportSubject
        ? `Forecast — ${questionExportSubject} (Probable 2026 Topics)`
        : 'Forecast — Probable 2026 Topics',
    });
  };

  const questionExportPayload = useMemo<ExportPayload | null>(() => {
    if (!questionExportFilteredQuestions.length) return null;

    const rows = questionExportFilteredQuestions.map((q) => ({
      id: String(q.id),
      question_text: String(q.question_text || q.statement_line || ''),
      options: q.options,
      correct_answer: q.correct_answer,
      explanation_markdown: q.explanation_markdown,
      subject: getAnalyticsSubject(q),
      section_group: q.section_group || 'General',
      micro_topic: q.micro_topic || 'Other',
      exam_year: getAnalyticsYear(q) || '',
      is_pyq: !!q.is_pyq,
      is_ncert: !!q.is_ncert,
      // Include merged explanations from all institutes (dedup merger)
      _explanations: Array.isArray(q._explanations) ? q._explanations : [],
      // Include all contributing institutes
      _institutes: Array.isArray(q._institutes) ? q._institutes : [],
    }));

    return { kind: 'questions', rows } as ExportPayload;
  }, [
    questionExportFilteredQuestions,
    getAnalyticsSubject,
    getAnalyticsYear,
  ]);

  const focusSubjects = useMemo(() => ['All', ...Array.from(new Set(rawQuestions.map(q => getAnalyticsSubject(q))))], [rawQuestions]);
  const focusSections = useMemo(() => {
    if (focusSubject === 'All') return ['All'];
    return ['All', ...Array.from(new Set(rawQuestions.filter(q => getAnalyticsSubject(q) === focusSubject).map(q => q.section_group || 'General')))];
  }, [rawQuestions, focusSubject]);
  const focusMicros = useMemo(() => {
    return [
      'All',
      ...Array.from(
        new Set(
          rawQuestions
            .filter(q => (focusSubject === 'All' || getAnalyticsSubject(q) === focusSubject) && (focusSection === 'All' || (q.section_group || 'General') === focusSection))
            .map(q => q.micro_topic || 'Other')
        )
      ),
    ];
  }, [rawQuestions, focusSubject, focusSection]);

  const breakdownData = useMemo(() => {
    if (!oneSub) return distributionData;
    if (!oneSec) return sectionData;
    if (!oneMicro) return microTopicData;
    return subTopicData;
  }, [distributionData, sectionData, microTopicData, subTopicData, oneSub, oneSec, oneMicro]);

  const donutData = useMemo(() => {
    const source = breakdownData.slice(0, 5);
    const rest = breakdownData.slice(5).reduce((sum, item) => sum + item.value, 0);
    const compact = source.map(item => ({ tag: item.name, count: item.value }));
    if (rest > 0) compact.push({ tag: 'Others', count: rest });
    return compact;
  }, [breakdownData]);

  const overviewSeries = useMemo(() => {
    return trendSubjects.map(subject => ({
      label: subject,
      values: years.map(year => heatmapData[year]?.[subject] || 0),
    }));
  }, [trendSubjects, years, heatmapData]);


  const focusTrendSeries = useMemo(() => {
    const label =
      focusMicro !== 'All'
        ? focusMicro
        : focusSection !== 'All'
          ? `${focusSubject} / ${focusSection}`
          : focusSubject !== 'All'
            ? focusSubject
            : 'All PYQ';
    return [
      {
        label,
        values: years.map(year => {
          const numYear = Number(year);
          return rawQuestions.filter(q => {
            if (getAnalyticsYear(q) !== numYear) return false;
            if (focusSubject !== 'All' && getAnalyticsSubject(q) !== focusSubject) return false;
            if (focusSection !== 'All' && (q.section_group || 'General') !== focusSection) return false;
            if (focusMicro !== 'All' && (q.micro_topic || 'Other') !== focusMicro) return false;
            return true;
          }).length;
        }),
      },
    ];
  }, [rawQuestions, years, focusSubject, focusSection, focusMicro]);

  useEffect(() => {
    if (exportSubjects.length === 0) {
      setExportSubject('');
      setQuestionExportSubject('');
      return;
    }
    if (!exportSubject || !exportSubjects.includes(exportSubject)) {
      setExportSubject(exportSubjects[0]);
    }
    if (!questionExportSubject || !exportSubjects.includes(questionExportSubject)) {
      setQuestionExportSubject(exportSubjects[0]);
    }
  }, [exportSubjects, exportSubject, questionExportSubject]);

  useEffect(() => {
    setQuestionExportSections((prev) => prev.filter((section) => questionExportSectionOptions.includes(section)));
  }, [questionExportSectionOptions]);

  useEffect(() => {
    setQuestionExportMicros((prev) => prev.filter((micro) => questionExportMicroOptions.includes(micro)));
  }, [questionExportMicroOptions]);

  useEffect(() => {
    if (questionExportYearOptions.length === 0) {
      setQuestionExportSingleYear('');
      setQuestionExportYearStart('');
      setQuestionExportYearEnd('');
      return;
    }

    if (!questionExportSingleYear || !questionExportYearOptions.includes(questionExportSingleYear)) {
      setQuestionExportSingleYear(questionExportYearOptions[0]);
    }

    const oldestYear = questionExportYearOptions[questionExportYearOptions.length - 1];
    const newestYear = questionExportYearOptions[0];

    if (!questionExportYearStart || !questionExportYearOptions.includes(questionExportYearStart)) {
      setQuestionExportYearStart(oldestYear);
    }

    if (!questionExportYearEnd || !questionExportYearOptions.includes(questionExportYearEnd)) {
      setQuestionExportYearEnd(newestYear);
    }
  }, [questionExportYearOptions, questionExportSingleYear, questionExportYearStart, questionExportYearEnd]);

  const openModal = (type: 'stage' | 'paper' | 'range') => {
    setModalType(type);
    setModalVisible(true);
  };

  const handleSelect = (value: string) => {
    if (modalType === 'stage') {
      setExamStage(value);
      // Get papers for this stage from the current course
      const papersForStage = currentPapersByStage[value as keyof typeof currentPapersByStage];
      const firstPaper = papersForStage?.[0] || null;
      setSelectedPaper(firstPaper);
    } else if (modalType === 'paper') {
      setSelectedPaper(value);
    } else if (modalType === 'range') {
      setSelectedRange(value);
    }
    setModalVisible(false);
  };

  const navigateToLearning = (opts: { subject?: string; subjects?: string[]; section?: string; sections?: string[]; micro?: string; micros?: string[]; subtopic?: string; year?: string; mode?: 'learning' | 'exam' | 'choice' }) => {
    const s = opts.subjects?.join(',') || opts.subject || 'All';
    const sec = opts.sections?.join('|') || opts.section || '';
    const m = opts.micros?.join('|') || opts.micro || '';
    
    let yearStart = '';
    let yearEnd = '';
    const yearParam = opts.year || years.join(',');
    
    if (yearParam) {
      if (yearParam.includes(',')) {
        const yArr = yearParam.split(',').map(Number).filter(n => !isNaN(n)).sort((a,b) => a - b);
        if (yArr.length > 0) {
          yearStart = String(yArr[0]);
          yearEnd = String(yArr[yArr.length - 1]);
        }
      } else {
        yearStart = yearParam;
        yearEnd = yearParam;
      }
    }

    // When stage is Mains, navigate to the dedicated Mains screen which loads
    // all mains data from Supabase and has its own filter UI (paper/subject/section)
    const isMainsStage = examStage?.toLowerCase() === 'mains';
    const isPrelimsStage = examStage?.toLowerCase() === 'prelims';

    if (isMainsStage) {
      router.push({
        pathname: '/mains',
        params: {
          paper: selectedPaper || '',
          subject: s,
          section: sec,
          microtopic: m,
          subtopic: opts.subtopic || '',
          year: yearParam,
          initialScreen: 'questions',
          from: 'pyq',
        }
      });
    } else {
      // Build params that match exactly what the pyq analysis heatmap counted:
      // - pyqFilter: 'PYQ Only' to get only is_pyq=true questions
      // - pyqCategory: 'UPSC CSE' to filter only UPSC CSE (not allied)
      // - stage: examStage so tests are filtered by series (prelims/mains)
      // - year_start/year_end: year range for exact match
      // - subject/section/microtopic: filters from heatmap cell click
      const engineParams: Record<string, string> = {
        mode: (opts.mode && opts.mode !== 'choice') ? opts.mode : 'learning',
        view: 'list',
        pyqFilter: 'PYQ Only',
        examCategory: 'UPSC CSE',
        subject: s,
        year_start: yearStart,
        year_end: yearEnd,
        stage: examStage,
        paper: selectedPaper || '',
      };
      
      // Only add section/microtopic if they have actual values (not 'All')
      if (sec && sec !== 'All') engineParams.section = sec;
      if (m && m !== 'All') engineParams.microtopic = m;

      router.push({
        pathname: '/unified/engine',
        params: engineParams,
      });
    }
  };

  const handleHeatmapPress = (label: string, opts: any, targetYear?: string) => {
    const yearToUse = targetYear || years.join(',');
    navigateToLearning({ ...opts, year: yearToUse, mode: 'learning' });
  };

  const exportPdf = async (mode: ExportMode, subjectOverride?: string) => {
    if (!rawQuestions.length) {
      Alert.alert('No data to export', 'Please load PYQ data before exporting a PDF.');
      return;
    }

    console.log(`[PDFExport] Starting export in mode: ${mode}, subject: ${subjectOverride || 'N/A'}`);
    setExporting(true);
    // Add a small delay to allow the modal to close completely before heavy processing
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      const esc = (value: string | number) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const hslToHex = (h: number, s: number, l: number) => {
      l /= 100;
      const a = (s * Math.min(l, 1 - l)) / 100;
      const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
      };
      return `#${f(0)}${f(8)}${f(4)}`;
    };

    const hexToRgb = (hex: string) => {
      const clean = String(hex || '').replace('#', '');
      if (clean.length !== 6) return '37,99,235';
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      if ([r, g, b].some(Number.isNaN)) return '37,99,235';
      return `${r},${g},${b}`;
    };

    const renderBarChart = (title: string, rows: Array<{ name: string; value: number }>, color = '#2563eb') => {
      if (!rows.length) return '';
      const max = Math.max(...rows.map(row => row.value), 1);
      return `
        <h2>${esc(title)}</h2>
        <div class="bar-card">
          ${rows.map(row => `
            <div class="bar-row">
              <div class="bar-label">${esc(row.name)}</div>
              <div class="bar-track"><div class="bar-fill" style="background:${color}; width:${Math.max((row.value / max) * 100, 3)}%"></div></div>
              <div class="bar-value">${row.value}</div>
            </div>
          `).join('')}
        </div>
      `;
    };

    const renderTable = (title: string, headers: string[], rows: Array<Array<string | number>>) => {
      if (!rows.length) return '';
      return `
        <h2>${esc(title)}</h2>
        <table>
          <tr>${headers.map(header => `<th>${esc(header)}</th>`).join('')}</tr>
          ${rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}
        </table>
      `;
    };

    const renderLineChart = (
      title: string,
      labels: string[],
      series: Array<{ label: string; values: number[] }>,
      palette: string[]
    ) => {
      if (!labels.length || !series.length) return '';
      const widthSvg = 980;
      const heightSvg = 320;
      const leftPad = 56;
      const rightPad = 24;
      const topPad = 26;
      const bottomPad = 56;
      const plotW = widthSvg - leftPad - rightPad;
      const plotH = heightSvg - topPad - bottomPad;
      const maxValue = Math.max(...series.flatMap(item => item.values), 1);
      const x = (index: number) => leftPad + (labels.length === 1 ? 0 : (index * plotW) / (labels.length - 1));
      const y = (value: number) => topPad + plotH - (value / maxValue) * plotH;

      const gridLines = [0, 0.25, 0.5, 0.75, 1].map(step => {
        const yy = topPad + plotH - step * plotH;
        const val = Math.round(maxValue * step);
        return `<line x1="${leftPad}" y1="${yy}" x2="${widthSvg - rightPad}" y2="${yy}" stroke="#e2e8f0" stroke-width="1" />
                <text x="${leftPad - 8}" y="${yy + 4}" text-anchor="end" font-size="10" fill="#64748b">${val}</text>`;
      }).join('');

      const seriesSvg = series.map((item, idx) => {
        const color = palette[idx % palette.length] || '#2563eb';
        const points = item.values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
        const dots = item.values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="3" fill="${color}" />`).join('');
        return `<polyline fill="none" stroke="${color}" stroke-width="3" points="${points}"/>${dots}`;
      }).join('');

      const xLabels = labels.map((label, index) => `<text x="${x(index)}" y="${heightSvg - 18}" text-anchor="middle" font-size="10" fill="#475569">${esc(label)}</text>`).join('');
      const legend = series.map((item, idx) => {
        const color = palette[idx % palette.length] || '#2563eb';
        return `<span class="legend-item"><span class="legend-dot" style="background:${color}"></span>${esc(item.label)}</span>`;
      }).join('');

      return `
        <h2>${esc(title)}</h2>
        <div class="legend-wrap">${legend}</div>
        <div class="chart-card">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthSvg} ${heightSvg}" width="100%" height="${heightSvg}">
            <rect x="${leftPad}" y="${topPad}" width="${plotW}" height="${plotH}" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
            ${gridLines}
            ${seriesSvg}
            ${xLabels}
          </svg>
        </div>
      `;
    };

    const renderDonut = (title: string, rows: Array<{ name: string; value: number }>) => {
      if (!rows.length) return '';
      const topRows = rows.slice(0, 8);
      const rest = rows.slice(8).reduce((sum, item) => sum + item.value, 0);
      const compact = [...topRows];
      if (rest > 0) compact.push({ name: 'Others', value: rest });
      const total = Math.max(compact.reduce((sum, item) => sum + item.value, 0), 1);
      const radius = 66;
      const circumference = 2 * Math.PI * radius;
      let cumulative = 0;
      const segments = compact.map((item, index) => {
        const color = TREND_PALETTE[index % TREND_PALETTE.length];
        const len = (item.value / total) * circumference;
        const segment = `<circle cx="90" cy="90" r="${radius}" fill="none" stroke="${color}" stroke-width="34" stroke-dasharray="${len} ${circumference}" stroke-dashoffset="${-cumulative}" transform="rotate(-90 90 90)"/>`;
        cumulative += len;
        return segment;
      }).join('');

      const legend = compact.map((item, index) => {
        const color = TREND_PALETTE[index % TREND_PALETTE.length];
        return `<div class="donut-legend-row"><span class="donut-legend-dot" style="background:${color}"></span><span>${esc(item.name)}</span><strong>${item.value}</strong></div>`;
      }).join('');

      return `
        <h2>${esc(title)}</h2>
        <div class="donut-wrap">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="200" height="200">
            <circle cx="90" cy="90" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="34"/>
            ${segments}
            <text x="90" y="86" text-anchor="middle" font-size="18" font-weight="700" fill="#0f172a">${total}</text>
            <text x="90" y="104" text-anchor="middle" font-size="10" fill="#64748b">QUESTIONS</text>
          </svg>
          <div class="donut-legend">
            ${legend}
          </div>
        </div>
      `;
    };

    const renderHeatmap = (
      title: string,
      labelHeader: string,
      rows: HeatmapRow[],
      baseColorHex: string,
      divisor: number
    ) => {
      if (!rows.length) return '';
      const rgb = hexToRgb(baseColorHex);
      return `
        <h2>${esc(title)}</h2>
        <table>
          <tr><th>${esc(labelHeader)}</th>${years.map(year => `<th>${esc(year)}</th>`).join('')}</tr>
          ${rows.map(row => `
            <tr>
              <td>${esc(row.label)}</td>
              ${years.map(year => {
                const count = row.byYear[year] || 0;
                let bg = '#f8fafc';
                let tc = '#94a3b8';
                
                if (count > 0) {
                  const capped = Math.min(count, 22);
                  const ratio = (capped - 1) / 21;
                  if (heatmapPalette === 'spectral') {
                    const h = 70 + (ratio * 155);
                    const s = 65 + (ratio * 20);
                    const l = 85 - (ratio * 55);
                    bg = hslToHex(h, s, l);
                    tc = l < 55 ? '#ffffff' : '#065f46';
                  } else {
                    const h = 210 + (ratio * 15);
                    const s = 60 + (ratio * 35);
                    const l = 90 - (ratio * 65);
                    bg = hslToHex(h, s, l);
                    tc = l < 55 ? '#ffffff' : '#1e3a8a';
                  }
                }
                return `<td style="padding: 1px; border: none; width: 44px; height: 32px;">
                  <svg width="44" height="32" viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg">
                    <rect width="44" height="32" rx="5" fill="${bg}" />
                    <text x="22" y="20.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="800" fill="${tc}">${count || ''}</text>
                  </svg>
                </td>`;
              }).join('')}
            </tr>
          `).join('')}
        </table>
      `;
    };

    const buildSubjectDeepDive = (subject: string) => {
      const qns = rawQuestions.filter(q => getAnalyticsSubject(q) === subject);
      const sectionMap: Record<string, number> = {};
      const microMap: Record<string, number> = {};
      const subtopicMap: Record<string, number> = {};
      const sectionYearMap: Record<string, Record<string, number>> = {};
      const microYearMap: Record<string, Record<string, number>> = {};
      const subtopicYearMap: Record<string, Record<string, number>> = {};

      qns.forEach(q => {
        const year = String(getAnalyticsYear(q) || '');
        if (!year) return;
        const section = q.section_group || 'General';
        const micro = q.micro_topic || q.microTopic || 'Other';
        const subtopic = q.subTopic || q.sub_topic || 'Other';

        sectionMap[section] = (sectionMap[section] || 0) + 1;
        microMap[micro] = (microMap[micro] || 0) + 1;
        subtopicMap[subtopic] = (subtopicMap[subtopic] || 0) + 1;

        if (!sectionYearMap[section]) sectionYearMap[section] = {};
        sectionYearMap[section][year] = (sectionYearMap[section][year] || 0) + 1;

        if (!microYearMap[micro]) microYearMap[micro] = {};
        microYearMap[micro][year] = (microYearMap[micro][year] || 0) + 1;

        if (!subtopicYearMap[subtopic]) subtopicYearMap[subtopic] = {};
        subtopicYearMap[subtopic][year] = (subtopicYearMap[subtopic][year] || 0) + 1;
      });

      const sectionRows = Object.entries(sectionMap)
        .map(([name, value]) => ({ name, value, byYear: sectionYearMap[name] || {} }))
        .sort((a, b) => b.value - a.value);
      const microRows = Object.entries(microMap)
        .map(([name, value]) => ({ name, value, byYear: microYearMap[name] || {} }))
        .sort((a, b) => b.value - a.value);
      const subtopicRows = Object.entries(subtopicMap)
        .map(([name, value]) => ({ name, value, byYear: subtopicYearMap[name] || {} }))
        .sort((a, b) => b.value - a.value);

      const subjectSeries = [{ label: subject, values: years.map(year => heatmapData[year]?.[subject] || 0) }];

      const isMains = examStage?.toLowerCase() === 'mains';

      return `
        <div class="page-break"></div>
        <h2>${esc(subject)} — Deep Dive</h2>
        ${renderLineChart(`${subject} Momentum`, years, subjectSeries, ['#2563eb'])}
        ${renderBarChart(`${subject} Section Distribution`, sectionRows.slice(0, 14).map(item => ({ name: item.name, value: item.value })), '#2563eb')}
        ${renderBarChart(`${subject} Micro Topic Distribution`, microRows.slice(0, 20).map(item => ({ name: item.name, value: item.value })), '#1d4ed8')}
        ${isMains ? renderBarChart(`${subject} Sub Topic Distribution`, subtopicRows.slice(0, 20).map(item => ({ name: item.name, value: item.value })), '#4f46e5') : ''}
        ${renderHeatmap(`${subject} Section Group x Year Heatmap`, 'Section', sectionRows.slice(0, 14).map(item => ({ key: `sec-${item.name}`, label: item.name, byYear: item.byYear })), '#2563eb', 8)}
        ${renderHeatmap(`${subject} Micro Topic x Year Heatmap`, 'Micro Topic', microRows.slice(0, 20).map(item => ({ key: `micro-${item.name}`, label: item.name, byYear: item.byYear })), '#1d4ed8', 8)}
        ${isMains ? renderHeatmap(`${subject} Sub Topic x Year Heatmap`, 'Sub Topic', subtopicRows.slice(0, 20).map(item => ({ key: `subtopic-${item.name}`, label: item.name, byYear: item.byYear })), '#4f46e5', 8) : ''}
      `;
    };

    const focusedLabel = focusMicro !== 'All' ? focusMicro : focusSection !== 'All' ? `${focusSubject} / ${focusSection}` : focusSubject;
    const subjectCountRows = distributionData.map(item => [item.name, item.value]);

    const blocks: string[] = [];
    const includeAll = mode === 'all';

    if (includeAll || mode === 'momentum') {
      blocks.push(renderLineChart('Subject Momentum', years, overviewSeries, overviewSeries.map(item => trendColorMap[item.label] || '#2563eb')));
    }

    if (includeAll || mode === 'distribution') {
      blocks.push(renderDonut('Subject Distribution (Donut)', distributionData));
      blocks.push(renderBarChart('Subject Distribution (Bar)', distributionData.slice(0, 20)));
    }

    if (includeAll || mode === 'focused') {
      blocks.push(renderLineChart('Focused Trend', years, focusTrendSeries, ['#2563eb']));
    }

    if (includeAll || mode === 'heatmaps') {
      blocks.push(renderHeatmap('Subject x Year Heatmap', 'Subject', subjectHeatmapRows, '#2563eb', 14));
      blocks.push(renderHeatmap('Top 20 Topics x Year Heatmap', 'Topic', topicHeatmapRows, '#1d4ed8', 10));
    }

    if (includeAll) {
      exportSubjects.forEach(subject => {
        blocks.push(buildSubjectDeepDive(subject));
      });
    }

    if (mode === 'subject_one') {
      const subject = subjectOverride || exportSubject || exportSubjects[0];
      if (subject) blocks.push(buildSubjectDeepDive(subject));
    }

    if (mode === 'subject_all') {
      // First Page: Combined Overview for All Subjects
      blocks.push(renderLineChart('All Subjects Momentum', years, overviewSeries, overviewSeries.map(item => trendColorMap[item.label] || '#2563eb')));
      blocks.push(renderDonut('All Subjects Distribution', distributionData));
      blocks.push(renderHeatmap('All Subjects x Year Heatmap', 'Subject', subjectHeatmapRows, '#2563eb', 14));

      // Subsequent Pages: Deep Dive for each Subject
      exportSubjects.forEach(subject => {
        blocks.push(buildSubjectDeepDive(subject));
      });
    }

    const html = `
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; padding: 22px; color: #0f172a; }
          h1 { margin: 0 0 8px; font-size: 24px; }
          h2 { margin: 20px 0 10px; font-size: 17px; color: #1e293b; }
          .meta { margin: 0 0 12px; color: #475569; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; table-layout: auto; }
          td, th { border: 1px solid #d1d5db; padding: 6px; font-size: 11px; vertical-align: middle; }
          th { background: #f8fafc; text-align: left; }
          td:first-child, th:first-child { width: 200px; min-width: 200px; }
          .chart-card { border: 1px solid #d1d5db; border-radius: 12px; padding: 10px; margin-bottom: 16px; background: #fff; }
          .bar-card { border: 1px solid #d1d5db; border-radius: 12px; padding: 12px; margin-bottom: 16px; }
          .bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
          .bar-label { width: 210px; font-size: 11px; color: #334155; }
          .bar-track { flex: 1; background: #e2e8f0; height: 10px; border-radius: 999px; overflow: hidden; }
          .bar-fill { height: 100%; border-radius: 999px; }
          .bar-value { width: 44px; text-align: right; font-size: 11px; font-weight: 700; }
          .legend-wrap { margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 8px; }
          .legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: #334155; }
          .legend-dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; }
          .donut-wrap { border: 1px solid #d1d5db; border-radius: 12px; display: flex; gap: 18px; padding: 12px; align-items: center; margin-bottom: 16px; }
          .donut-legend { flex: 1; }
          .donut-legend-row { display: flex; align-items: center; justify-content: space-between; font-size: 11px; padding: 4px 0; }
          .donut-legend-dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; margin-right: 7px; }
          .page-break { page-break-before: always; }
          
          /* Prevent cutting and force background colors */
          table, tr, .chart-card, .bar-card, .donut-wrap { 
            page-break-inside: avoid; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          }
          td, th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          thead { display: table-header-group; }
          tr { page-break-after: auto; }
        </style>
      </head>
      <body>
        <h1>${esc(`${examStage}${selectedPaper ? ' ' + selectedPaper : ''} PYQ Analysis`)}</h1>
        <div class="meta">Range: ${esc(selectedRange)}${selectedRange === 'Custom Range' ? ` (${esc(customYearStart)} - ${esc(customYearEnd)})` : ''}</div>
        <div class="meta">Questions fetched: ${rawQuestions.length} | Subjects: ${distributionData.length} | Years: ${years.join(', ')}</div>
        ${blocks.join('')}
      </body>
      </html>
    `;

    console.log(`[PDFExport] HTML generated. Length: ${html.length}`);

      const canShare = await Sharing.isAvailableAsync();
      console.log(`[PDFExport] Sharing available: ${canShare}`);
      if (canShare && Platform.OS !== 'web') {
        console.log(`[PDFExport] Printing to file...`);
        const { uri } = await Print.printToFileAsync({ html });
        console.log(`[PDFExport] File printed to: ${uri}. Opening share menu...`);
        
        // Small delay to ensure the overlay is fully gone from the UI hierarchy
        await new Promise(resolve => setTimeout(resolve, 300));

        try {
          // Fire-and-forget share with generous timeout for large PDFs
          await Promise.race([
            Sharing.shareAsync(uri, { 
              mimeType: 'application/pdf', 
              dialogTitle: 'PYQ Analysis Report',
              UTI: 'com.adobe.pdf' 
            }),
            new Promise<void>((resolve) => setTimeout(resolve, 20000)), // 20 second timeout
          ]).catch(() => {
            console.warn('[PDFExport] Share operation timed out or was dismissed (non-fatal)');
          });
        } catch (shareErr) {
          console.error('[PDFExport] Sharing failed, falling back to Print dialog', shareErr);
          await Print.printAsync({ html });
        }
      } else {
        console.log(`[PDFExport] Printing directly...`);
        await Print.printAsync({ html });
      }
    } catch (error: any) {
      console.error('PDF export failed', error);
      Alert.alert('Export failed', error?.message || 'Unable to export PDF right now.');
    } finally {
      setExporting(false);
    }
  };

  const renderHeader = () => (
    <View style={[styles.header, { 
      borderBottomColor: colors.border, 
      backgroundColor: colors.bg,
      paddingTop: isEmbedded ? 12 : Math.max(insets.top, 16)
    }]}>
      {!isEmbedded ? (
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <ChevronLeft color={colors.textPrimary} size={22} />
        </TouchableOpacity>
      ) : <View style={styles.headerIcon} />}
      <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>PYQ Analysis</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity 
          onPress={() => {
            Alert.alert(
              "How to Use Heatmap",
              "• Tap a row label (left) to open deep-dive sections & micro-topics.\n\n• Tap any cell number to directly open those questions in Learn Mode.\n\n• Tap the 📚 question-bank icon on a row to open all questions for that topic."
            );
          }} 
          style={[styles.headerIcon, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <HelpCircle color={colors.primary} size={18} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setQuestionExportVisible(true)} style={[styles.headerIcon, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Download color={colors.primary} size={18} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderOverview = () => (
    <View style={styles.blockGap}>
      <View style={styles.topCardRow}>
        {topThreeSubjects.map((item, idx) => (
          <View key={item.name} style={[styles.topCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.topRank, { color: colors.primary }]}>Top {idx + 1}</Text>
            <Text style={[styles.topName, { color: colors.textPrimary }]} numberOfLines={2}>{item.name}</Text>
            <Text style={[styles.topCount, { color: colors.textSecondary }]}>{item.value} questions</Text>
          </View>
        ))}
      </View>

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.panelTitle, { color: colors.textPrimary }]}>Subject Momentum</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {distributionData.map(item => {
            const active = trendSubjects.includes(item.name);
            const seriesColor = trendColorMap[item.name] || colors.primary;
            return (
              <TouchableOpacity
                key={item.name}
                activeOpacity={0.7}
                style={[
                  styles.seriesChip,
                  { borderColor: active ? seriesColor : colors.border, backgroundColor: active ? seriesColor : colors.surfaceStrong },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTrendSubjects(prev => {
                    if (prev.includes(item.name)) return prev.filter(v => v !== item.name);
                    if (prev.length >= 12) return [...prev.slice(1), item.name];
                    return [...prev, item.name];
                  });
                }}
              >
                <View style={[styles.seriesDot, { backgroundColor: active ? '#ffffff' : seriesColor }]} />
                <Text style={[styles.seriesChipText, { color: active ? '#ffffff' : colors.textSecondary }]}>{item.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {overviewSeries.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <LineChart
              labels={years}
              data={overviewSeries}
              colors={overviewSeries.map(series => trendColorMap[series.label] || colors.primary)}
              height={320}
              width={Math.max(width * 1.45, years.length * 96, 420)}
              topInset={30}
              showValues
            />
          </ScrollView>
        ) : (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Select subjects to compare their year-wise momentum.</Text>
        )}
      </View>

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.panelTitle, { color: colors.textPrimary }]}>Subject Distribution</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pieScroll}>
          <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={styles.pieVerticalScroll}>
        <PieChart
          data={donutData}
          size={258}
          canvasWidth={640}
          canvasHeight={390}
          centerLabel={`${donutData.reduce((sum, item) => sum + item.count, 0)} questions`}
          centerSubLabel=""
          labelPlacement="below"
          colors={donutData.map((_, index) => TREND_PALETTE[index % TREND_PALETTE.length])}
          onPress={tag => {
            if (tag === 'Others') return;
            if (!oneSub) setOneSub(tag);
            else if (!oneSec) setOneSec(tag);
            else if (!oneMicro && examStage?.toLowerCase() === 'mains') setOneMicro(tag);
          }}
        />
      </ScrollView>
    </ScrollView>
    <Text style={[styles.helperText, { color: colors.textSecondary, marginTop: 8 }]}>
      Click on the chart to deep dive from subject to section group to micro topic{examStage?.toLowerCase() === 'mains' ? ' to sub topic' : ''}.
    </Text>
    <View style={[styles.tableWrap, { borderColor: colors.border }]}>
      {breakdownData.slice(0, 12).map((item, index) => (
        <TouchableOpacity
          key={`${item.name}-${index}`}
          style={[styles.tableRow, { borderBottomColor: colors.border + '60' }]}
          onPress={() => {
            if (!oneSub) {
              setOneSub(item.name);
              return;
            }
            if (!oneSec) {
              setOneSec(item.name);
              return;
            }
            if (!oneMicro && examStage?.toLowerCase() === 'mains') {
              setOneMicro(item.name);
              return;
            }
            navigateToLearning({
              subject: oneSub || undefined,
              section: oneSec || undefined,
              micro: oneMicro || item.name,
              subtopic: oneMicro ? item.name : undefined,
            });
          }}
        >
          <Text style={[styles.tableName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.tableValue, { color: colors.textSecondary }]}>{item.value}</Text>
        </TouchableOpacity>
      ))}
    </View>
    {(oneSub || oneSec || oneMicro) ? (
      <TouchableOpacity
        style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
        onPress={() => {
          if (oneMicro) setOneMicro(null);
          else if (oneSec) setOneSec(null);
          else setOneSub(null);
        }}
      >
        <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>Go one level up</Text>
      </TouchableOpacity>
    ) : null}
      </View>
      {renderTopicYearHeatmap()}
    </View>
  );



  const renderTopicYearHeatmap = () => (
    <StickyHeatmapTable
      title="Top 20 Topics x Year"
      labelHeader="Topic"
      years={years}
      rows={topicHeatmapRows}
      baseColor="#1d4ed8"
      colors={colors}
      heatmapPalette={heatmapPalette}
      preferredCellWidth={72}
      onCellPress={(topic, year) => handleHeatmapPress(topic, { micro: topic }, year)}
      onRowPress={(topic) => handleHeatmapPress(topic, { micro: topic })}
    />
  );

  const renderSubjectDeepHeatmaps = () => {
    return (
      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.panelTitle, { color: colors.textPrimary }]}>Heatmap Filtering</Text>
        
        <Text style={[styles.exportGroupLabel, { color: colors.textTertiary, marginLeft: 4, marginBottom: 8 }]}>CHOOSE SUBJECTS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {distributionData.map(item => (
            <TouchableOpacity
              key={`heat-subject-${item.name}`}
              activeOpacity={0.7}
              style={[
                styles.filterChip,
                { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                selSubjects.includes(item.name) && { backgroundColor: colors.primary, borderColor: colors.primaryDark }
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelSubjects(prev => {
                  const next = prev.includes(item.name) ? prev.filter(s => s !== item.name) : [...prev, item.name];
                  return next;
                });
                setSelSections([]);
                setSelMicros([]);
                setSelSubtopics([]);
              }}
            >
            <Text style={[styles.filterChipText, { color: selSubjects.includes(item.name) ? '#FFFFFF' : colors.textSecondary }]}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {selSubjects.length > 0 && (
          <>
            <Text style={[styles.exportGroupLabel, { color: colors.textTertiary, marginLeft: 4, marginTop: 12, marginBottom: 8 }]}>FILTER BY SECTIONS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {allSections.map(sec => (
                <TouchableOpacity
                  key={`heat-sec-${sec}`}
                  activeOpacity={0.7}
                  style={[
                    styles.filterChip,
                    { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                    selSections.includes(sec) && { backgroundColor: colors.primary, borderColor: colors.primaryDark }
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelSections(prev => prev.includes(sec) ? prev.filter(s => s !== sec) : [...prev, sec]);
                    setSelMicros([]);
                    setSelSubtopics([]);
                  }}
                >
                  <Text style={[styles.filterChipText, { color: selSections.includes(sec) ? '#FFFFFF' : colors.textSecondary }]}>{sec}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {selSections.length > 0 && (
          <>
            <Text style={[styles.exportGroupLabel, { color: colors.textTertiary, marginLeft: 4, marginTop: 12, marginBottom: 8 }]}>FILTER BY MICRO TOPICS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {allMicros.map(m => (
                <TouchableOpacity
                  key={`heat-micro-${m}`}
                  activeOpacity={0.7}
                  style={[
                    styles.filterChip,
                    { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                    selMicros.includes(m) && { backgroundColor: colors.primary, borderColor: colors.primaryDark }
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelMicros(prev => prev.includes(m) ? prev.filter(s => s !== m) : [...prev, m]);
                    setSelSubtopics([]);
                  }}
                >
                  <Text style={[styles.filterChipText, { color: selMicros.includes(m) ? '#FFFFFF' : colors.textSecondary }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {examStage?.toLowerCase() === 'mains' && selMicros.length > 0 && allSubtopics.length > 0 && (
          <>
            <Text style={[styles.exportGroupLabel, { color: colors.textTertiary, marginLeft: 4, marginTop: 12, marginBottom: 8 }]}>FILTER BY SUB TOPICS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {allSubtopics.map(subtopic => (
                <TouchableOpacity
                  key={`heat-subtopic-${subtopic}`}
                  activeOpacity={0.7}
                  style={[
                    styles.filterChip,
                    { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                    selSubtopics.includes(subtopic) && { backgroundColor: colors.primary, borderColor: colors.primaryDark }
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelSubtopics(prev => prev.includes(subtopic) ? prev.filter(s => s !== subtopic) : [...prev, subtopic]);
                  }}
                >
                  <Text style={[styles.filterChipText, { color: selSubtopics.includes(subtopic) ? '#FFFFFF' : colors.textSecondary }]}>{subtopic}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {selSubjects.length === 0 ? (
          <Text style={[styles.helperText, { color: colors.textSecondary, marginTop: 16 }]}>Choose subjects to open section-group, micro-topic, and subtopic heatmaps.</Text>
        ) : (
          <View style={{ marginTop: 20, gap: 20 }}>
            {selSections.length === 0 && (
              <StickyHeatmapTable
                title="Section Group x Year"
                labelHeader="Section"
                years={years}
                rows={sectionHeatmapRows}
                baseColor="#2563eb"
                colors={colors}
                heatmapPalette={heatmapPalette}
                onCellPress={(section, year) => handleHeatmapPress(section, { subjects: selSubjects, section }, year)}
                onRowPress={(section) => handleHeatmapPress(section, { subjects: selSubjects, section })}
              />
            )}

            {selMicros.length === 0 && (
              <StickyHeatmapTable
                title="Micro Topic x Year"
                labelHeader="Micro Topic"
                years={years}
                rows={microHeatmapRows}
                baseColor="#1d4ed8"
                colors={colors}
                heatmapPalette={heatmapPalette}
                onCellPress={(micro, year) => {
                  if (examStage?.toLowerCase() === 'mains') {
                    setSelMicros([micro]);
                  } else {
                    handleHeatmapPress(micro, { subjects: selSubjects, sections: selSections, micro }, year);
                  }
                }}
                onRowPress={(micro) => {
                  if (examStage?.toLowerCase() === 'mains') {
                    setSelMicros([micro]);
                  } else {
                    handleHeatmapPress(micro, { subjects: selSubjects, sections: selSections, micro });
                  }
                }}
              />
            )}

            {examStage?.toLowerCase() === 'mains' && selMicros.length > 0 && (
              <StickyHeatmapTable
                title="Sub Topic x Year"
                labelHeader="Sub Topic"
                years={years}
                rows={subtopicHeatmapRows}
                baseColor="#4f46e5"
                colors={colors}
                heatmapPalette={heatmapPalette}
                onCellPress={(subtopic, year) => handleHeatmapPress(subtopic, { subjects: selSubjects, sections: selSections, micros: selMicros, subtopic }, year)}
                onRowPress={(subtopic) => handleHeatmapPress(subtopic, { subjects: selSubjects, sections: selSections, micros: selMicros, subtopic })}
              />
            )}
          </View>
        )}
      </View>
    );
  };

  const renderPilot = () => {
    // Filter questions for the selected subject in Pilot mode
    const pilotQuestions = rawQuestions.filter(q => getAnalyticsSubject(q) === pilotSubject);
    
    // Calculate Section Rows for Pilot
    const pilotSectionRows = Array.from(new Set(pilotQuestions.map(q => q.section_group || q.sectionGroup || 'General')))
      .map(sec => ({
        key: `pilot-sec-${sec}`,
        label: sec,
        byYear: years.reduce((acc, y) => {
          const count = pilotQuestions.filter(q => getAnalyticsYear(q) === parseInt(y, 10) && (q.section_group === sec || q.sectionGroup === sec)).length;
          if (count) acc[y] = count;
          return acc;
        }, {} as Record<string, number>)
      }))
      .sort((a, b) => Object.values(b.byYear).reduce((sum, v) => sum + v, 0) - Object.values(a.byYear).reduce((sum, v) => sum + v, 0));

    // Calculate Micro Rows for Pilot (Filtered by Subject AND Section if selected)
    const filteredForMicro = pilotSection 
      ? pilotQuestions.filter(q => q.section_group === pilotSection || q.sectionGroup === pilotSection)
      : pilotQuestions;

    const pilotMicroRows = Array.from(new Set(filteredForMicro.map(q => q.micro_topic || q.microTopic || q.microtopic || 'General')))
      .map(m => ({
        key: `pilot-micro-${m}`,
        label: m,
        byYear: years.reduce((acc, y) => {
          const count = filteredForMicro.filter(q => getAnalyticsYear(q) === parseInt(y, 10) && (q.micro_topic === m || q.microTopic === m || q.microtopic === m)).length;
          if (count) acc[y] = count;
          return acc;
        }, {} as Record<string, number>)
      }))
      .sort((a, b) => Object.values(b.byYear).reduce((sum, v) => sum + v, 0) - Object.values(a.byYear).reduce((sum, v) => sum + v, 0));
    
    // Calculate Subtopic Rows for Pilot (Filtered by Subject AND Section AND Micro topic if selected)
    const filteredForSubtopic = pilotMicro
      ? filteredForMicro.filter(q => q.micro_topic === pilotMicro || q.microTopic === pilotMicro || q.microtopic === pilotMicro)
      : filteredForMicro;

    const pilotSubtopicRows = Array.from(new Set(filteredForSubtopic.map(q => q.subTopic || q.sub_topic || 'General')))
      .map(sub => ({
        key: `pilot-subtopic-${sub}`,
        label: sub,
        byYear: years.reduce((acc, y) => {
          const count = filteredForSubtopic.filter(q => getAnalyticsYear(q) === parseInt(y, 10) && (q.subTopic === sub || q.sub_topic === sub)).length;
          if (count) acc[y] = count;
          return acc;
        }, {} as Record<string, number>)
      }))
      .sort((a, b) => Object.values(b.byYear).reduce((sum, v) => sum + v, 0) - Object.values(a.byYear).reduce((sum, v) => sum + v, 0));
    
    // Dynamic width calculator
    const getLabelWidth = (rows: any[]) => {
      if (!rows || !rows.length) return 120;
      const maxLen = Math.max(...rows.map(r => String(r.label || '').length));
      return Math.min(180, Math.max(100, maxLen * 7.5)); 
    };

    const subjectWidth = 140;
    const sectionWidth = 150;
    const microWidth = 160;

    return (
      <View style={styles.blockGap}>
        <View style={styles.paletteRow}>
          <Text style={[styles.paletteLabel, { color: colors.textTertiary }]}>HEATMAP THEME:</Text>
          <TouchableOpacity 
            style={[styles.paletteChip, heatmapPalette === 'spectral' && { backgroundColor: colors.primary, borderColor: colors.primary }]} 
            onPress={() => setHeatmapPalette('spectral')}
          >
            <Text style={[styles.paletteChipText, { color: heatmapPalette === 'spectral' ? '#fff' : colors.textSecondary }]}>Spectral</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.paletteChip, heatmapPalette === 'ocean' && { backgroundColor: colors.primary, borderColor: colors.primary }]} 
            onPress={() => setHeatmapPalette('ocean')}
          >
            <Text style={[styles.paletteChipText, { color: heatmapPalette === 'ocean' ? '#fff' : colors.textSecondary }]}>Ocean Blue</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.paletteChip, heatmapPalette === 'sunset' && { backgroundColor: colors.primary, borderColor: colors.primary }]} 
            onPress={() => setHeatmapPalette('sunset')}
          >
            <Text style={[styles.paletteChipText, { color: heatmapPalette === 'sunset' ? '#fff' : colors.textSecondary }]}>Sunset</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.paletteChip, heatmapPalette === 'forest' && { backgroundColor: colors.primary, borderColor: colors.primary }]} 
            onPress={() => setHeatmapPalette('forest')}
          >
            <Text style={[styles.paletteChipText, { color: heatmapPalette === 'forest' ? '#fff' : colors.textSecondary }]}>Forest</Text>
          </TouchableOpacity>
        </View>



        {/* TOP HALF: Global Subject Heatmap */}
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: 20 }]}>
          <Text style={[styles.panelTitle, { color: colors.textPrimary }]}>1. Choose a Subject</Text>
          <Text style={[styles.helperText, { color: colors.textSecondary, marginBottom: 16 }]}>
            Click a subject name on the left to see its deep-dive below.
          </Text>
          <StickyHeatmapTable
            title="Global Subject Trends"
            labelHeader="Subject"
            years={years}
            rows={subjectHeatmapRows}
            baseColor={colors.primary}
            colors={colors}
            heatmapPalette={heatmapPalette}
            labelWidth={subjectWidth}
            onRowPress={(subj) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setPilotSubject(subj);
              setPilotSection(null); // Reset section when subject changes
              setPilotMicro(null); // Reset microtopic
            }}
            onLabelActionPress={(subj) => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              handleHeatmapPress(subj, { subject: subj });
            }}
            onYearPress={(year) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleHeatmapPress('', { year }, year);
            }}
            onCellPress={(subj, year) => handleHeatmapPress(subj, { subject: subj }, year)}
          />
        </View>

        {/* BOTTOM HALF: Dynamic Deep Dive */}
        {pilotSubject ? (
          <View
            onLayout={(e) => { deepDivePanelYRef.current = e.nativeEvent.layout.y; }}
            style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 10 }]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={[styles.panelTitle, { color: colors.textPrimary }]}>2. {pilotSubject} Deep-Dive</Text>
                <Text style={[styles.helperText, { color: colors.textSecondary }]}>Sections and Topics for {pilotSubject}</Text>
              </View>
              <TouchableOpacity 
                onPress={() => {
                  setPilotSubject(null);
                  setPilotSection(null);
                  setPilotMicro(null);
                }}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary }}>CLEAR</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 24 }}>
              <StickyHeatmapTable
                title="2. Section Breakdown"
                labelHeader="Section"
                years={years}
                rows={pilotSectionRows}
                baseColor={colors.primary}
                maxValue={6}
                colors={colors}
                heatmapPalette={heatmapPalette}
                labelWidth={sectionWidth}
                onRowPress={(sec) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPilotSection(sec);
                  setPilotMicro(null); // Reset microtopic
                }}
                onLabelActionPress={(sec) => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  handleHeatmapPress(sec, { subject: pilotSubject, section: sec });
                }}
                onYearPress={(year) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handleHeatmapPress('', { subject: pilotSubject, year }, year);
                }}
                onCellPress={(sec, year) => handleHeatmapPress(sec, { subject: pilotSubject, section: sec }, year)}
              />

              <View
                onLayout={(e) => {
                  // y is relative to the inner gap:24 View; add panel y to compute absolute scroll target
                  microTopicsYRef.current = deepDivePanelYRef.current + e.nativeEvent.layout.y + 60;
                }}
              >
              <StickyHeatmapTable
                title={`3. ${pilotSection || 'All'} Micro-Topics`}
                labelHeader="Topic"
                years={years}
                rows={pilotMicroRows}
                baseColor={colors.primary}
                maxValue={6}
                colors={colors}
                heatmapPalette={heatmapPalette}
                labelWidth={microWidth}
                onRowPress={(m) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (examStage?.toLowerCase() === 'mains') {
                    setPilotMicro(m);
                  } else {
                    navigateToLearning({ subject: pilotSubject, section: pilotSection || undefined, micro: m, mode: 'choice' });
                  }
                }}
                onLabelActionPress={(m) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (examStage?.toLowerCase() === 'mains') {
                    setPilotMicro(m);
                  } else {
                    handleHeatmapPress(m, { subject: pilotSubject, section: pilotSection || undefined, micro: m });
                  }
                }}
                onYearPress={(year) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (examStage?.toLowerCase() === 'mains') {
                    // Do not navigate immediately for Mains
                  } else {
                    handleHeatmapPress('', { subject: pilotSubject, section: pilotSection || undefined, year }, year);
                  }
                }}
                onCellPress={(m, year) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (examStage?.toLowerCase() === 'mains') {
                    setPilotMicro(m);
                  } else {
                    handleHeatmapPress(m, { subject: pilotSubject, section: pilotSection || undefined, micro: m }, year);
                  }
                }}
              />
              </View>

              {examStage?.toLowerCase() === 'mains' && pilotMicro && (
                <View>
                  <StickyHeatmapTable
                    title={`4. ${pilotMicro} Sub-Topics`}
                    labelHeader="Sub-Topic"
                    years={years}
                    rows={pilotSubtopicRows}
                    baseColor={colors.primary}
                    maxValue={6}
                    colors={colors}
                    heatmapPalette={heatmapPalette}
                    labelWidth={microWidth}
                    onRowPress={(sub) => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      navigateToLearning({ subject: pilotSubject, section: pilotSection || undefined, micro: pilotMicro, subtopic: sub, mode: 'choice' });
                    }}
                    onLabelActionPress={(sub) => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      handleHeatmapPress(sub, { subject: pilotSubject, section: pilotSection || undefined, micro: pilotMicro, subtopic: sub });
                    }}
                    onYearPress={(year) => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      handleHeatmapPress('', { subject: pilotSubject, section: pilotSection || undefined, micro: pilotMicro, year }, year);
                    }}
                    onCellPress={(sub, year) => handleHeatmapPress(sub, { subject: pilotSubject, section: pilotSection || undefined, micro: pilotMicro, subtopic: sub }, year)}
                  />
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', padding: 40, borderStyle: 'dashed' }]}>
            <TrendingUp size={32} color={colors.textTertiary} style={{ opacity: 0.3, marginBottom: 12 }} />
            <Text style={{ color: colors.textTertiary, fontWeight: '700', textAlign: 'center' }}>
              Select a subject from the heatmap above to see its detailed section-wise and topic-wise breakdown here.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderFocusedTrend = () => (
    <View style={styles.blockGap}>
      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.panelTitle, { color: colors.textPrimary }]}>Focused Trend</Text>
        <Text style={[styles.helperText, { color: colors.textSecondary }]}>
          Subject only, then deeper into section group and micro topic when you need it.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {focusSubjects.map(item => (
            <TouchableOpacity
              key={`subject-${item}`}
              activeOpacity={0.7}
              style={[styles.filterChip, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }, focusSubject === item && { backgroundColor: colors.primary, borderColor: colors.primaryDark }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFocusSubject(item);
                setFocusSection('All');
                setFocusMicro('All');
              }}
            >
              <Text style={[styles.filterChipText, { color: focusSubject === item ? colors.buttonText : colors.textSecondary }]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {focusSubject !== 'All' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {focusSections.map(item => (
              <TouchableOpacity
                key={`section-${item}`}
                style={[styles.filterChip, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }, focusSection === item && { backgroundColor: colors.primary, borderColor: colors.primaryDark }]}
                onPress={() => {
                  setFocusSection(item);
                  setFocusMicro('All');
                }}
              >
                <Text style={[styles.filterChipText, { color: focusSection === item ? colors.buttonText : colors.textSecondary }]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {focusSection !== 'All' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {focusMicros.map(item => (
              <TouchableOpacity
                key={`micro-${item}`}
                style={[styles.filterChip, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }, focusMicro === item && { backgroundColor: colors.primary, borderColor: colors.primaryDark }]}
                onPress={() => setFocusMicro(item)}
              >
                <Text style={[styles.filterChipText, { color: focusMicro === item ? colors.buttonText : colors.textSecondary }]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <LineChart
            labels={years}
            data={focusTrendSeries}
            colors={[colors.primary]}
            height={320}
            width={Math.max(width * 1.65, years.length * 108, 460)}
            topInset={34}
          />
        </ScrollView>

        <TouchableOpacity
          style={[styles.openBtn, { backgroundColor: colors.primary }]}
          onPress={() => navigateToLearning({
            subject: focusSubject === 'All' ? undefined : focusSubject,
            section: focusSection === 'All' ? undefined : focusSection,
            micro: focusMicro === 'All' ? undefined : focusMicro,
          })}
        >
          <Text style={[styles.openBtnText, { color: colors.buttonText }]}>Open This In Learn Mode</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: isEmbedded ? 'transparent' : colors.bg }]}>
      {!isDark && !isEmbedded && (
        <LinearGradient
          colors={['#e0f2fe', '#fef3c7', '#fce7f3', '#d1fae5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {renderHeader()}

      <ScrollView ref={mainScrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Filter chips scroll away with content */}
        <View style={[
          styles.filterWrap, 
          { 
            backgroundColor: !isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(30, 41, 59, 0.45)', 
            borderColor: !isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 255, 255, 0.15)' 
          }
        ]}>
          {[
            { label: 'Stage', value: examStage, type: 'stage' as const },
            ...(selectedPaper ? [{ label: 'Paper', value: selectedPaper, type: 'paper' as const }] : []),
            { label: 'Years', value: selectedRange, type: 'range' as const },
          ].map(item => (
            <TouchableOpacity 
              key={item.label} 
              style={[
                styles.selector, 
                { 
                  borderColor: !isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 255, 255, 0.15)', 
                  backgroundColor: !isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(15, 23, 42, 0.45)' 
                }
              ]} 
              onPress={() => openModal(item.type)}
            >
              <Text style={[styles.selectorLabel, { color: colors.textTertiary }]}>{item.label}</Text>
              <View style={styles.selectorValue}>
                <Text style={[styles.selectorText, { color: colors.textPrimary }]} numberOfLines={1}>{item.value}</Text>
                <ChevronDown size={14} color={colors.textTertiary} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {selectedRange === 'Custom Range' ? (
          <View style={[
            styles.rangeBox, 
            { 
              backgroundColor: !isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(30, 41, 59, 0.45)', 
              borderColor: !isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 255, 255, 0.15)' 
            }
          ]}>
            <View style={styles.rangeInputWrap}>
              <Text style={[styles.rangeLabel, { color: colors.textTertiary }]}>From</Text>
              <TextInput value={customYearStart} onChangeText={setCustomYearStart} keyboardType="number-pad" maxLength={4} style={[styles.yearInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]} />
            </View>
            <View style={styles.rangeInputWrap}>
              <Text style={[styles.rangeLabel, { color: colors.textTertiary }]}>To</Text>
              <TextInput value={customYearEnd} onChangeText={setCustomYearEnd} keyboardType="number-pad" maxLength={4} style={[styles.yearInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]} />
            </View>
          </View>
        ) : null}

        <ActiveFiltersBar
          filters={[
            { id: 'stage', label: examStage },
            ...(selectedPaper ? [{ id: 'paper', label: selectedPaper }] : []),
            { id: 'range', label: selectedRange },
            ...selSubjects.map((s) => ({ id: `sub-${s}`, label: s, onRemove: () => setSelSubjects((p) => p.filter((x) => x !== s)) })),
            ...selSections.map((s) => ({ id: `sec-${s}`, label: s, onRemove: () => setSelSections((p) => p.filter((x) => x !== s)) })),
            ...selMicros.map((s) => ({ id: `mic-${s}`, label: s, onRemove: () => setSelMicros((p) => p.filter((x) => x !== s)) })),
          ] as ActiveFilter[]}
        />
        <SelectionSummaryBar
          subjects={selSubjects.length}
          sections={selSections.length}
          micros={selMicros.length}
          onClear={() => {
            const prev = { selSubjects, selSections, selMicros };
            setSelSubjects([]); setSelSections([]); setSelMicros([]);
            setUndoSpec({
              message: 'Selection cleared',
              onUndo: () => { setSelSubjects(prev.selSubjects); setSelSections(prev.selSections); setSelMicros(prev.selMicros); },
            });
          }}
        />

        {loading ? (
          <View style={[styles.loaderBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Loading PYQ analysis...</Text>
          </View>
        ) : (
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            {rawQuestions.length === 0 ? (
              <View style={[styles.loaderBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.loaderText, { color: colors.textSecondary }]}>No PYQ matched this filter selection.</Text>
              </View>
            ) : (
              <>
                {activeHub === 'overview' && renderOverview()}

                {activeHub === 'focused' && renderFocusedTrend()}
                {activeHub === 'pilot' && renderPilot()}
                {activeHub === 'forecast' && (
                  <PredictiveInsightsPanel
                    rawQuestions={rawQuestions}
                    getYear={getAnalyticsYear}
                    getSubject={getAnalyticsSubject}
                    level="micro_topic"
                    onRowPress={(level, key) => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      // Find the subject for this topic and open in learn mode (same as heatmap behavior)
                      const matchingQ = rawQuestions.find(q => {
                        const topic = level === 'micro_topic' ? q.micro_topic : level === 'subject' ? getAnalyticsSubject(q) : q.section_group;
                        return topic === key;
                      });
                      navigateToLearning({
                        subject: matchingQ ? getAnalyticsSubject(matchingQ) : undefined,
                        micro: level === 'micro_topic' ? key : undefined,
                        section: level === 'section_group' ? key : undefined,
                        mode: 'choice',
                      });
                    }}
                  />
                )}
                {activeHub === 'compare' && (
                  <CompareWindowsPanel
                    rawQuestions={rawQuestions}
                    getYear={getAnalyticsYear}
                    getSubject={getAnalyticsSubject}
                    level="subject"
                  />
                )}
              </>
            )}
          </Animated.View>
        )}
      </ScrollView>

      {/* Learn/Exam FAB removed as per request - interaction moved to heatmap cells */}

      {exporting && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }]}>
          <View style={{ backgroundColor: colors.surface, padding: 24, borderRadius: 20, alignItems: 'center', gap: 12 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>Generating PDF Report...</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>This may take a few seconds</Text>
          </View>
        </View>
      )}

      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {[
          { key: 'pilot', label: 'Deep Dive', icon: Target },
          { key: 'overview', label: 'Overview', icon: TrendingUp },
          { key: 'focused', label: 'Focused', icon: LineIcon },
          { key: 'forecast', label: 'Forecast', icon: TrendingUp },
          { key: 'compare', label: 'Compare', icon: Grid },
        ].map(item => {
          const Icon = item.icon;
          const active = activeHub === item.key;
          return (
            <TouchableOpacity key={item.key} style={styles.tabItem} onPress={() => setActiveHub(item.key as HubKey)}>
              <Icon size={18} color={active ? colors.primary : colors.textTertiary} />
              <Text style={[styles.tabLabel, { color: active ? colors.primary : colors.textTertiary }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal visible={exportModalVisible} transparent animationType="fade" onRequestClose={() => setExportModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setExportModalVisible(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}> 
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Export PYQ PDF</Text>
              <TouchableOpacity onPress={() => setExportModalVisible(false)}><X size={22} color={colors.textPrimary} /></TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={[styles.exportGroupLabel, { color: colors.textTertiary }]}>QUICK EXPORTS</Text>
              <TouchableOpacity style={[styles.exportActionBtn, { backgroundColor: colors.primary }]} onPress={() => { setExportModalVisible(false); exportPdf('all'); }}>
                <Text style={[styles.exportActionText, { color: colors.buttonText }]}>Export Full Report (All Sections)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.exportActionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }]} onPress={() => { setExportModalVisible(false); exportPdf('momentum'); }}>
                <Text style={[styles.exportActionText, { color: colors.textPrimary }]}>Export Subject Momentum</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.exportActionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }]} onPress={() => { setExportModalVisible(false); exportPdf('distribution'); }}>
                <Text style={[styles.exportActionText, { color: colors.textPrimary }]}>Export Subject Distribution</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.exportActionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }]} onPress={() => { setExportModalVisible(false); exportPdf('heatmaps'); }}>
                <Text style={[styles.exportActionText, { color: colors.textPrimary }]}>Export Heatmaps</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.exportActionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }]} onPress={() => { setExportModalVisible(false); exportPdf('focused'); }}>
                <Text style={[styles.exportActionText, { color: colors.textPrimary }]}>Export Focused Trend</Text>
              </TouchableOpacity>

              <Text style={[styles.exportGroupLabel, { color: colors.textTertiary, marginTop: 14 }]}>QUESTION BANK EXPORT (UNIFIED ENGINE)</Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 8 }}>
                Export full PYQ questions with content scope, appendix answer placement, margins, typography and Q&A highlight controls.
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                    questionExportScope === 'selected_subject' && { backgroundColor: colors.primary, borderColor: colors.primaryDark },
                  ]}
                  onPress={() => { setQuestionExportScope('selected_subject'); setQuestionExportSections([]); setQuestionExportMicros([]); }}
                >
                  <Text style={[styles.filterChipText, { color: questionExportScope === 'selected_subject' ? colors.buttonText : colors.textSecondary }]}>Selected Subject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                    questionExportScope === 'all_subjects' && { backgroundColor: colors.primary, borderColor: colors.primaryDark },
                  ]}
                  onPress={() => { setQuestionExportScope('all_subjects'); setQuestionExportSections([]); setQuestionExportMicros([]); }}
                >
                  <Text style={[styles.filterChipText, { color: questionExportScope === 'all_subjects' ? colors.buttonText : colors.textSecondary }]}>All Subjects</Text>
                </TouchableOpacity>
              </ScrollView>

              <Text style={[styles.exportGroupLabel, { color: colors.textTertiary }]}>FILTER LIST</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                    questionExportFilterList === 'subject' && { backgroundColor: colors.primary, borderColor: colors.primaryDark },
                  ]}
                  onPress={() => setQuestionExportFilterList('subject')}
                >
                  <Text style={[styles.filterChipText, { color: questionExportFilterList === 'subject' ? colors.buttonText : colors.textSecondary }]}>Subject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                    questionExportFilterList === 'section_group' && { backgroundColor: colors.primary, borderColor: colors.primaryDark },
                  ]}
                  onPress={() => setQuestionExportFilterList('section_group')}
                >
                  <Text style={[styles.filterChipText, { color: questionExportFilterList === 'section_group' ? colors.buttonText : colors.textSecondary }]}>Section Group</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                    questionExportFilterList === 'micro_topic' && { backgroundColor: colors.primary, borderColor: colors.primaryDark },
                  ]}
                  onPress={() => setQuestionExportFilterList('micro_topic')}
                >
                  <Text style={[styles.filterChipText, { color: questionExportFilterList === 'micro_topic' ? colors.buttonText : colors.textSecondary }]}>Micro Topic</Text>
                </TouchableOpacity>
              </ScrollView>

              {questionExportFilterList === 'subject' ? (
                questionExportScope === 'selected_subject' ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {exportSubjects.map(subject => (
                      <TouchableOpacity
                        key={`q-export-sub-${subject}`}
                        style={[
                          styles.filterChip,
                          { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                          questionExportSubject === subject && { backgroundColor: colors.primary, borderColor: colors.primaryDark },
                        ]}
                        onPress={() => {
                          setQuestionExportSubject(subject);
                          setQuestionExportSections([]);
                          setQuestionExportMicros([]);
                        }}
                      >
                        <Text style={[styles.filterChipText, { color: questionExportSubject === subject ? colors.buttonText : colors.textSecondary }]}>{subject}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 10 }}>
                    Subject scope: All subjects selected.
                  </Text>
                )
              ) : null}

              {questionExportFilterList === 'section_group' ? (
                questionExportSectionOptions.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {questionExportSectionOptions.map(section => {
                      const active = questionExportSections.includes(section);
                      return (
                        <TouchableOpacity
                          key={`q-export-sec-${section}`}
                          style={[
                            styles.filterChip,
                            { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                            active && { backgroundColor: colors.primary, borderColor: colors.primaryDark },
                          ]}
                          onPress={() => {
                            setQuestionExportSections((prev) => prev.includes(section) ? prev.filter((item) => item !== section) : [...prev, section]);
                          }}
                        >
                          <Text style={[styles.filterChipText, { color: active ? colors.buttonText : colors.textSecondary }]}>{section}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 10 }}>No section groups available for this scope.</Text>
                )
              ) : null}

              {questionExportFilterList === 'micro_topic' ? (
                questionExportMicroOptions.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {questionExportMicroOptions.map(micro => {
                      const active = questionExportMicros.includes(micro);
                      return (
                        <TouchableOpacity
                          key={`q-export-micro-${micro}`}
                          style={[
                            styles.filterChip,
                            { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                            active && { backgroundColor: colors.primary, borderColor: colors.primaryDark },
                          ]}
                          onPress={() => {
                            setQuestionExportMicros((prev) => prev.includes(micro) ? prev.filter((item) => item !== micro) : [...prev, micro]);
                          }}
                        >
                          <Text style={[styles.filterChipText, { color: active ? colors.buttonText : colors.textSecondary }]}>{micro}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 10 }}>
                    {questionExportSections.length > 0 ? 'No micro topics for selected section groups.' : 'Select section groups (optional) to narrow micro topics.'}
                  </Text>
                )
              ) : null}

              <Text style={[styles.exportGroupLabel, { color: colors.textTertiary }]}>YEAR FILTER</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                    questionExportYearMode === 'all' && { backgroundColor: colors.primary, borderColor: colors.primaryDark },
                  ]}
                  onPress={() => setQuestionExportYearMode('all')}
                >
                  <Text style={[styles.filterChipText, { color: questionExportYearMode === 'all' ? colors.buttonText : colors.textSecondary }]}>All Years</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                    questionExportYearMode === 'single' && { backgroundColor: colors.primary, borderColor: colors.primaryDark },
                  ]}
                  onPress={() => setQuestionExportYearMode('single')}
                >
                  <Text style={[styles.filterChipText, { color: questionExportYearMode === 'single' ? colors.buttonText : colors.textSecondary }]}>Single Year</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                    questionExportYearMode === 'range' && { backgroundColor: colors.primary, borderColor: colors.primaryDark },
                  ]}
                  onPress={() => setQuestionExportYearMode('range')}
                >
                  <Text style={[styles.filterChipText, { color: questionExportYearMode === 'range' ? colors.buttonText : colors.textSecondary }]}>Year Range</Text>
                </TouchableOpacity>
              </ScrollView>

              {questionExportYearMode === 'single' ? (
                questionExportYearOptions.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {questionExportYearOptions.map((year) => {
                      const active = questionExportSingleYear === year;
                      return (
                        <TouchableOpacity
                          key={`q-export-year-${year}`}
                          style={[
                            styles.filterChip,
                            { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                            active && { backgroundColor: colors.primary, borderColor: colors.primaryDark },
                          ]}
                          onPress={() => setQuestionExportSingleYear(year)}
                        >
                          <Text style={[styles.filterChipText, { color: active ? colors.buttonText : colors.textSecondary }]}>{year}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 10 }}>No years available in this filter scope.</Text>
                )
              ) : null}

              {questionExportYearMode === 'range' ? (
                <>
                  <Text style={{ fontSize: 10, color: colors.textTertiary, fontWeight: '800', marginBottom: 6 }}>FROM</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {questionExportYearOptions.map((year) => {
                      const active = questionExportYearStart === year;
                      return (
                        <TouchableOpacity
                          key={`q-export-year-start-${year}`}
                          style={[
                            styles.filterChip,
                            { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                            active && { backgroundColor: colors.primary, borderColor: colors.primaryDark },
                          ]}
                          onPress={() => setQuestionExportYearStart(year)}
                        >
                          <Text style={[styles.filterChipText, { color: active ? colors.buttonText : colors.textSecondary }]}>{year}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <Text style={{ fontSize: 10, color: colors.textTertiary, fontWeight: '800', marginBottom: 6 }}>TO</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {questionExportYearOptions.map((year) => {
                      const active = questionExportYearEnd === year;
                      return (
                        <TouchableOpacity
                          key={`q-export-year-end-${year}`}
                          style={[
                            styles.filterChip,
                            { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                            active && { backgroundColor: colors.primary, borderColor: colors.primaryDark },
                          ]}
                          onPress={() => setQuestionExportYearEnd(year)}
                        >
                          <Text style={[styles.filterChipText, { color: active ? colors.buttonText : colors.textSecondary }]}>{year}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              ) : null}

              <TouchableOpacity
                style={[styles.exportActionBtn, { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: colors.primary + '15' }]}
                onPress={() => {
                  setExportModalVisible(false);
                  setQuestionExportVisible(true);
                }}
              >
                <Text style={[styles.exportActionText, { color: colors.primary }]}>Open Unified Question Export</Text>
              </TouchableOpacity>

              <Text style={[styles.exportGroupLabel, { color: colors.textTertiary, marginTop: 14 }]}>SUBJECT-WISE EXPORTS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {exportSubjects.map(subject => (
                  <TouchableOpacity
                    key={`export-sub-${subject}`}
                    style={[
                      styles.filterChip,
                      { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                      exportSubject === subject && { backgroundColor: colors.primary, borderColor: colors.primaryDark },
                    ]}
                    onPress={() => setExportSubject(subject)}
                  >
                    <Text style={[styles.filterChipText, { color: exportSubject === subject ? colors.buttonText : colors.textSecondary }]}>{subject}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[styles.exportActionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
                onPress={() => {
                  setExportModalVisible(false);
                  if (exportSubject) exportPdf('subject_one', exportSubject);
                }}
              >
                <Text style={[styles.exportActionText, { color: colors.textPrimary }]}>Export Selected Subject Deep Dive</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exportActionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
                onPress={() => {
                  setExportModalVisible(false);
                  exportPdf('subject_all');
                }}
              >
                <Text style={[styles.exportActionText, { color: colors.textPrimary }]}>Export All Subjects Deep Dive</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <AnalysisExportSheet
        visible={questionExportVisible}
        onClose={() => setQuestionExportVisible(false)}
        reportVariant="pyq"
        title="Dr. UPSC PYQ Analysis"
        questions={rawQuestions.map((q: any) => ({
          id: String(q.id),
          question_text: q.question_text || q.statement_line || '',
          options: q.options,
          correct_answer: q.correct_answer,
          explanation_markdown: q.explanation_markdown,
          subject: getAnalyticsSubject(q),
          section_group: q.section_group || 'General',
          micro_topic: q.micro_topic || 'Other',
          exam_year: getAnalyticsYear(q) || undefined,
          is_pyq: !!q.is_pyq,
          is_ncert: !!q.is_ncert,
          difficulty: q.difficulty || q.difficulty_level,
          review_tags: q.review_tags,
          _explanations: Array.isArray(q._explanations) ? q._explanations : [],
          _institutes: Array.isArray(q._institutes) ? q._institutes : [],
        }))}
        buildForecastRows={(rows) => {
          const predictive = buildPredictive(
            rows,
            (entry: any) => {
              const y = Number(entry.exam_year);
              return Number.isFinite(y) ? y : null;
            },
            {
              level: 'micro_topic',
              getSubject: (entry: any) => String(entry.subject || 'General'),
            }
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
        }}
        pyqMeta={{
          examStage,
          selectedPaper,
          selectedRange: selectedRange === 'Custom Range'
            ? `Custom Range (${customYearStart}-${customYearEnd})`
            : selectedRange,
          customYearStart,
          customYearEnd,
          heatmapPalette,
        }}
      />

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select {modalType}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><X size={22} color={colors.textPrimary} /></TouchableOpacity>
            </View>
            <ScrollView>
              {(modalType === 'stage' 
                ? currentStages 
                : modalType === 'paper' 
                  ? (currentPapersByStage[examStage as keyof typeof currentPapersByStage] || []).filter(Boolean)
                  : RANGE_OPTIONS
              ).map(item => (
                <TouchableOpacity key={item} style={[styles.modalItem, { borderBottomColor: colors.border }]} onPress={() => handleSelect(item)}>
                  <Text style={[styles.modalItemText, { color: colors.textPrimary }]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <UndoToast spec={undoSpec} onDismiss={() => setUndoSpec(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 14, borderBottomWidth: 0.5 },
  headerTitle: { fontSize: 22, fontWeight: '900' },
  headerIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  filterWrap: { flexDirection: 'row', gap: 10, marginHorizontal: 12, marginTop: 12, padding: 12, borderRadius: 20, borderWidth: 1 },
  selector: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 10 },
  selectorLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  selectorValue: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  selectorText: { fontSize: 12, fontWeight: '700', flex: 1 },
  rangeBox: { marginHorizontal: 12, marginTop: 10, borderRadius: 20, borderWidth: 1, padding: 12, flexDirection: 'row', gap: 12 },
  rangeInputWrap: { flex: 1 },
  rangeLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 },
  yearInput: { borderRadius: 12, borderWidth: 1, padding: 10, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  content: { paddingBottom: 100 },
  blockGap: { gap: 16, padding: 12 },
  topCardRow: { flexDirection: 'row', gap: 10 },
  topCard: { flex: 1, padding: 16, borderRadius: 20, borderWidth: 1 },
  topRank: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 },
  topName: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  topCount: { fontSize: 11, fontWeight: '600' },
  panel: { padding: 16, borderRadius: 24, borderWidth: 1 },
  panelTitle: { fontSize: 16, fontWeight: '900', marginBottom: 16 },
  chipRow: { gap: 8, marginBottom: 12 },
  pieScroll: { paddingHorizontal: 8, minWidth: '100%' },
  pieVerticalScroll: { paddingBottom: 12, paddingRight: 12 },
  seriesChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1, gap: 8 },
  seriesDot: { width: 8, height: 8, borderRadius: 4 },
  seriesChipText: { fontSize: 12, fontWeight: '700' },
  emptyText: { textAlign: 'center', padding: 40, fontSize: 14, fontStyle: 'italic' },
  backBtn: { alignSelf: 'center', marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  backBtnText: { fontSize: 12, fontWeight: '700' },
  heatmapFrame: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  heatmapStickyHeaderRow: { flexDirection: 'row' },
  heatmapStickyLabelHeader: {
    width: HEATMAP_LABEL_WIDTH,
    height: HEATMAP_ROW_HEIGHT,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRightWidth: 1,
  },
  heatmapLabelHeaderText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  heatmapYearHeaderTrack: { flexDirection: 'row' },
  heatmapYearHeaderCell: {
    width: HEATMAP_CELL_WIDTH,
    height: HEATMAP_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatmapYearHeaderText: { fontSize: 10, fontWeight: '800' },
  heatmapBodyScroll: { maxHeight: HEATMAP_MAX_BODY_HEIGHT },
  heatmapBodyLayout: { flexDirection: 'row' },
  heatmapStickyLabelColumn: { width: HEATMAP_LABEL_WIDTH, borderRightWidth: 1 },
  heatmapStickyLabelCell: {
    width: HEATMAP_LABEL_WIDTH,
    height: HEATMAP_ROW_HEIGHT,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  heatmapStickyLabelText: { fontSize: 11, fontWeight: '700' },
  heatmapDataRow: { flexDirection: 'row', height: HEATMAP_ROW_HEIGHT },
  heatmapDataCell: {
    width: HEATMAP_CELL_WIDTH,
    height: HEATMAP_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatCellText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  heatmapLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  labelActionBtn: {
    padding: 4,
    marginLeft: 4,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 6,
  },
  helperText: { fontSize: 12, marginBottom: 16, lineHeight: 18 },
  tableWrap: { marginTop: 12, borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  tableName: { flex: 1, fontSize: 12, fontWeight: '700', paddingRight: 12 },
  tableValue: { fontSize: 12, fontWeight: '800' },
  filterChip: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 14, 
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4
  },
  filterChipText: { fontSize: 13, fontWeight: '800' },
  openBtn: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  openBtnText: { fontSize: 14, fontWeight: '800' },
  loaderBox: { height: 300, alignItems: 'center', justifyContent: 'center', margin: 12, borderRadius: 24, borderWidth: 1 },
  loaderText: { marginTop: 16, fontSize: 14, fontWeight: '600' },
  tabBar: { flexDirection: 'row', height: 70, borderTopWidth: 1, paddingBottom: 15 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabLabel: { fontSize: 11, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  modalItem: { paddingVertical: 18, borderBottomWidth: 1 },
  modalItemText: { fontSize: 16, fontWeight: '700' },
  exportGroupLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8, marginBottom: 8 },
  exportActionBtn: { minHeight: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, marginBottom: 10 },
  exportActionText: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  paletteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 4 },
  paletteLabel: { fontSize: 10, fontWeight: '800', marginRight: 4 },
  paletteChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  paletteChipText: { fontSize: 11, fontWeight: '700' },
  actionFab: {
    position: 'absolute',
    bottom: 85,
    left: 20,
    right: 20,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    overflow: 'hidden'
  },
  actionFabPart: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: '100%',
  },
  actionFabDivider: {
    width: 1,
    height: '50%',
  },
  actionFabText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});

