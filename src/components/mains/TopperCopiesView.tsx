import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  Dimensions,
  Platform,
  FlatList,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
  ListRenderItem,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  Award,
  Calendar,
  Sparkles,
  Tag,
  Bookmark,
  Check,
  Zap,
  Plus,
  RefreshCw,
} from 'lucide-react-native';
import { ConsolidatedQuestion, ConsolidatedAnswer } from '../../data/mainsConsolidatedLoader';
import TopperImageViewerModal from './TopperImageViewerModal';
import { TopperImageCacheService } from '../../services/TopperImageCacheService';
import {
  isGenuineTopperAnswer,
  getTopperName,
  getAir,
  getTopperPageUrls,
  getAllTopperQuestions,
} from '../../utils/topperHelpers';

interface TopperCopiesViewProps {
  colors: any;
  isTablet: boolean;
  insets: { top: number; bottom: number; left: number; right: number };
  questions: ConsolidatedQuestion[];
  onBack: () => void;
  savedIds?: string[] | Set<string>;
  onToggleSaved?: (id: string) => void;
  // Flashcard Parity (Requirement R5)
  flashcardedIds?: Set<string>;
  savingFlashcard?: Record<string, boolean>;
  onAddFlashcard?: (item: ConsolidatedQuestion, topperAnswer?: ConsolidatedAnswer) => void;
  // Review Tags Parity (Requirement R5)
  userTags?: string[];
  userQuestionStates?: Record<
    string,
    { reviewTags?: string[]; confidence?: string | null; difficulty?: string | null }
  >;
  onToggleQuestionTag?: (questionId: string, tag: string) => void | Promise<void>;
  onCreateTag?: (newTag: string) => void | Promise<void>;
  // Sync Database Integration (Requirement R4)
  onForceSync?: () => void;
  syncing?: boolean;
}

// Preset review tags matching Mains Question Bank
const PRESET_REVIEW_TAGS = [
  'Imp. Concept',
  'Trap Question',
  'Imp. Fact',
  'Must Revise',
  'Memorize',
];

/**
 * Strict helper to identify genuine topper answers (Requirement R1).
 * Re-exported from shared domain helper for backward compatibility.
 */
export { isGenuineTopperAnswer };

// Multi-select toggle helper matching Question Bank
const toggleFilterValue = (
  currentVal: string,
  valueToToggle: string,
  delimiter: string = '|'
): string => {
  if (!currentVal || currentVal === 'All') {
    return valueToToggle;
  }
  const parts = currentVal.split(delimiter).filter(Boolean);
  if (parts.includes(valueToToggle)) {
    const updated = parts.filter(p => p !== valueToToggle);
    return updated.length === 0 ? 'All' : updated.join(delimiter);
  } else {
    return [...parts, valueToToggle].join(delimiter);
  }
};

// Reusable SidebarFilterRow component matching Question Bank
interface SidebarFilterRowProps {
  label: string;
  items: string[];
  selected: string;
  onSelect: (val: string) => void;
  colors: any;
  delimiter?: string;
  visible?: boolean;
  defaultExpanded?: boolean;
  itemPrefix?: string;
}

function SidebarFilterRow({
  label,
  items,
  selected,
  onSelect,
  colors,
  delimiter = '|',
  visible = true,
  defaultExpanded = false,
  itemPrefix = '',
}: SidebarFilterRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  React.useEffect(() => {
    if (defaultExpanded) {
      setExpanded(true);
    }
  }, [defaultExpanded]);

  if (!visible || !items || items.length === 0) return null;

  const selectedList = selected === 'All' ? [] : selected.split(delimiter).filter(Boolean);
  const isAll = selectedList.length === 0;

  return (
    <View style={{ marginVertical: 3 }}>
      {/* Collapsible Header matching Question Bank */}
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={({ pressed }) => [
          styles.sidebarSectionHeader,
          (expanded || !isAll) && styles.sidebarSectionHeaderActive,
          { opacity: pressed ? 0.75 : 1 },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
          <Text
            style={[
              styles.sidebarHeaderLabel,
              { color: isAll ? colors.textTertiary : '#f97316' },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
          <View
            style={[
              styles.sidebarHeaderBadge,
              { backgroundColor: isAll ? colors.border + '60' : '#f97316' },
            ]}
          >
            <Text
              style={[
                styles.sidebarHeaderBadgeText,
                { color: isAll ? colors.textTertiary : '#ffffff' },
              ]}
            >
              {isAll ? items.length : `${selectedList.length}/${items.length}`}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
          <View
            style={[
              styles.sidebarChevronCircle,
              { backgroundColor: expanded ? 'rgba(249, 115, 22, 0.12)' : 'transparent' },
            ]}
          >
            {expanded ? (
              <ChevronUp size={13} color={colors.textSecondary} />
            ) : (
              <ChevronDown size={13} color={colors.textTertiary} />
            )}
          </View>
        </View>
      </Pressable>

      {/* Collapsed Summary */}
      {!expanded && !isAll && (
        <View style={{ paddingHorizontal: 6, paddingTop: 2, paddingBottom: 4 }}>
          <Text style={{ fontSize: 10, color: '#f97316', fontWeight: '600' }} numberOfLines={1}>
            {selectedList.map(s => `${itemPrefix}${s}`).join(', ')}
          </Text>
        </View>
      )}

      {/* Accordion Content with Question Bank-style Round Button Chips */}
      {expanded && (
        <View style={styles.sidebarChipsContainer}>
          {/* 'All' Pill */}
          <Pressable
            onPress={() => onSelect('All')}
            style={({ pressed }) => [
              styles.sidebarFchip,
              {
                backgroundColor: isAll ? '#f97316' : colors.surface,
                borderColor: isAll ? '#f97316' : colors.border,
              },
              isAll && styles.sidebarFchipSel,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Text
              style={[
                styles.sidebarFchipText,
                { color: isAll ? '#ffffff' : colors.textSecondary },
              ]}
            >
              All
            </Text>
            {isAll && <Check size={10} color="#ffffff" style={{ marginLeft: 4 }} />}
          </Pressable>

          {/* Individual Items */}
          {items.map(item => {
            const isSelected = selectedList.includes(item);
            return (
              <Pressable
                key={item}
                onPress={() => onSelect(toggleFilterValue(selected, item, delimiter))}
                style={({ pressed }) => [
                  styles.sidebarFchip,
                  {
                    backgroundColor: isSelected ? '#f97316' : colors.surface,
                    borderColor: isSelected ? '#f97316' : colors.border,
                  },
                  isSelected && styles.sidebarFchipSel,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Text
                  style={[
                    styles.sidebarFchipText,
                    {
                      color: isSelected ? '#ffffff' : colors.textSecondary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {itemPrefix}
                  {item}
                </Text>
                {isSelected && <Check size={10} color="#ffffff" style={{ marginLeft: 4 }} />}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function TopperCopiesView({
  colors,
  isTablet,
  insets,
  questions,
  onBack,
  savedIds,
  onToggleSaved,
  flashcardedIds,
  savingFlashcard,
  onAddFlashcard,
  userTags,
  userQuestionStates,
  onToggleQuestionTag,
  onCreateTag,
  onForceSync,
  syncing = false,
}: TopperCopiesViewProps) {
  const { width: windowWidth } = useWindowDimensions();
  const isTwoColumn = isTablet || windowWidth >= 700;

  // Filter States (multi-select aware)
  const [selectedPaper, setSelectedPaper] = useState('All');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedSection, setSelectedSection] = useState('All');
  const [selectedMicrotopic, setSelectedMicrotopic] = useState('All');
  const [selectedSubtopic, setSelectedSubtopic] = useState('All');
  const [selectedNanotopic, setSelectedNanotopic] = useState('All');
  const [selectedTopper, setSelectedTopper] = useState('All');
  const [selectedCognitive, setSelectedCognitive] = useState('All');
  const [selectedActionWord, setSelectedActionWord] = useState('All');
  const [selectedReviewTag, setSelectedReviewTag] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Sidebar Collapse State (Requirement R2)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Tag Picker Modal/Inline State (Requirement R5)
  const [activeTagPickerQuestionId, setActiveTagPickerQuestionId] = useState<string | null>(null);
  const [newCustomTagText, setNewCustomTagText] = useState('');

  // Fullscreen Viewer State
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerTopperName, setViewerTopperName] = useState('');
  const [viewerAir, setViewerAir] = useState<string | number | undefined>(undefined);
  const [viewerQuestionText, setViewerQuestionText] = useState('');

  // 1. Data Purity (Requirement R1): Strict Topper Copies Ingestion
  const allTopperQuestions = useMemo(() => {
    return getAllTopperQuestions(questions || []);
  }, [questions]);

  // Determine if Optional labeling applies
  const isOptional = useMemo(() => {
    if (selectedPaper !== 'All') {
      const pList = selectedPaper.split('|');
      if (pList.includes('Optional')) return true;
      if (!pList.some(p => ['GS1', 'GS2', 'GS3', 'GS4', 'Essay'].includes(p))) return true;
    }
    if (selectedSubject !== 'All') {
      const sList = selectedSubject.toLowerCase();
      if (
        sList.includes('anthropology') ||
        sList.includes('sociology') ||
        sList.includes('medical') ||
        sList.includes('optional')
      ) {
        return true;
      }
    }
    return false;
  }, [selectedPaper, selectedSubject]);

  // 2. Derive options for hierarchy filters (multi-select aware)
  const paperOptions = useMemo(() => {
    const set = new Set<string>();
    allTopperQuestions.forEach(q => {
      if (q.paper) set.add(q.paper);
    });
    const arr = Array.from(set);
    const order = ['GS1', 'GS2', 'GS3', 'GS4', 'Essay', 'Optional'];
    return [...order.filter(p => arr.includes(p)), ...arr.filter(p => !order.includes(p))];
  }, [allTopperQuestions]);

  const subjectOptions = useMemo(() => {
    const paperFilter = selectedPaper !== 'All' ? selectedPaper.split('|') : [];
    const set = new Set<string>();
    allTopperQuestions.forEach(q => {
      const matchPaper = paperFilter.length === 0 || (q.paper ? paperFilter.includes(q.paper) : false);
      if (matchPaper && q.subject) set.add(q.subject);
    });
    return Array.from(set).sort();
  }, [allTopperQuestions, selectedPaper]);

  const sectionOptions = useMemo(() => {
    const paperFilter = selectedPaper !== 'All' ? selectedPaper.split('|') : [];
    const subjectFilter = selectedSubject !== 'All' ? selectedSubject.split('|') : [];
    const set = new Set<string>();
    allTopperQuestions.forEach(q => {
      const matchPaper = paperFilter.length === 0 || (q.paper ? paperFilter.includes(q.paper) : false);
      const matchSubject = subjectFilter.length === 0 || (q.subject ? subjectFilter.includes(q.subject) : false);
      if (matchPaper && matchSubject && q.sectionGroup) {
        set.add(q.sectionGroup);
      }
    });
    return Array.from(set).sort();
  }, [allTopperQuestions, selectedPaper, selectedSubject]);

  const microtopicOptions = useMemo(() => {
    const paperFilter = selectedPaper !== 'All' ? selectedPaper.split('|') : [];
    const subjectFilter = selectedSubject !== 'All' ? selectedSubject.split('|') : [];
    const sectionFilter = selectedSection !== 'All' ? selectedSection.split('|') : [];
    const set = new Set<string>();
    allTopperQuestions.forEach(q => {
      const matchPaper = paperFilter.length === 0 || (q.paper ? paperFilter.includes(q.paper) : false);
      const matchSubject = subjectFilter.length === 0 || (q.subject ? subjectFilter.includes(q.subject) : false);
      const matchSection = sectionFilter.length === 0 || (q.sectionGroup ? sectionFilter.includes(q.sectionGroup) : false);
      if (matchPaper && matchSubject && matchSection && q.microTopic) {
        set.add(q.microTopic);
      }
    });
    return Array.from(set).sort();
  }, [allTopperQuestions, selectedPaper, selectedSubject, selectedSection]);

  const subtopicOptions = useMemo(() => {
    const paperFilter = selectedPaper !== 'All' ? selectedPaper.split('|') : [];
    const subjectFilter = selectedSubject !== 'All' ? selectedSubject.split('|') : [];
    const sectionFilter = selectedSection !== 'All' ? selectedSection.split('|') : [];
    const microFilter = selectedMicrotopic !== 'All' ? selectedMicrotopic.split('|') : [];
    const set = new Set<string>();
    allTopperQuestions.forEach(q => {
      const matchPaper = paperFilter.length === 0 || (q.paper ? paperFilter.includes(q.paper) : false);
      const matchSubject = subjectFilter.length === 0 || (q.subject ? subjectFilter.includes(q.subject) : false);
      const matchSection = sectionFilter.length === 0 || (q.sectionGroup ? sectionFilter.includes(q.sectionGroup) : false);
      const matchMicro = microFilter.length === 0 || (q.microTopic ? microFilter.includes(q.microTopic) : false);
      if (matchPaper && matchSubject && matchSection && matchMicro && q.subTopic) {
        set.add(q.subTopic);
      }
    });
    return Array.from(set).sort();
  }, [allTopperQuestions, selectedPaper, selectedSubject, selectedSection, selectedMicrotopic]);

  const nanotopicOptions = useMemo(() => {
    const paperFilter = selectedPaper !== 'All' ? selectedPaper.split('|') : [];
    const subjectFilter = selectedSubject !== 'All' ? selectedSubject.split('|') : [];
    const sectionFilter = selectedSection !== 'All' ? selectedSection.split('|') : [];
    const microFilter = selectedMicrotopic !== 'All' ? selectedMicrotopic.split('|') : [];
    const subFilter = selectedSubtopic !== 'All' ? selectedSubtopic.split('|') : [];
    const set = new Set<string>();
    allTopperQuestions.forEach(q => {
      const matchPaper = paperFilter.length === 0 || (q.paper ? paperFilter.includes(q.paper) : false);
      const matchSubject = subjectFilter.length === 0 || (q.subject ? subjectFilter.includes(q.subject) : false);
      const matchSection = sectionFilter.length === 0 || (q.sectionGroup ? sectionFilter.includes(q.sectionGroup) : false);
      const matchMicro = microFilter.length === 0 || (q.microTopic ? microFilter.includes(q.microTopic) : false);
      const matchSub = subFilter.length === 0 || (q.subTopic ? subFilter.includes(q.subTopic) : false);
      if (matchPaper && matchSubject && matchSection && matchMicro && matchSub && q.nanoTopic) {
        set.add(q.nanoTopic);
      }
    });
    return Array.from(set).sort();
  }, [allTopperQuestions, selectedPaper, selectedSubject, selectedSection, selectedMicrotopic, selectedSubtopic]);

  // Questions filtered strictly by active syllabus hierarchy selections (Paper, Subject, Section, Unit/Microtopic, Subtopic, Nanotopic)
  const hierarchyFilteredQuestions = useMemo(() => {
    const paperFilter = selectedPaper !== 'All' ? selectedPaper.split('|') : [];
    const subjectFilter = selectedSubject !== 'All' ? selectedSubject.split('|') : [];
    const sectionFilter = selectedSection !== 'All' ? selectedSection.split('|') : [];
    const microFilter = selectedMicrotopic !== 'All' ? selectedMicrotopic.split('|') : [];
    const subFilter = selectedSubtopic !== 'All' ? selectedSubtopic.split('|') : [];
    const nanoFilter = selectedNanotopic !== 'All' ? selectedNanotopic.split('|') : [];

    if (
      paperFilter.length === 0 &&
      subjectFilter.length === 0 &&
      sectionFilter.length === 0 &&
      microFilter.length === 0 &&
      subFilter.length === 0 &&
      nanoFilter.length === 0
    ) {
      return allTopperQuestions;
    }

    return allTopperQuestions.filter(q => {
      if (paperFilter.length > 0 && (!q.paper || !paperFilter.includes(q.paper))) return false;
      if (subjectFilter.length > 0 && (!q.subject || !subjectFilter.includes(q.subject))) return false;
      if (sectionFilter.length > 0 && (!q.sectionGroup || !sectionFilter.includes(q.sectionGroup))) return false;
      if (microFilter.length > 0 && (!q.microTopic || !microFilter.includes(q.microTopic))) return false;
      if (subFilter.length > 0 && (!q.subTopic || !subFilter.includes(q.subTopic))) return false;
      if (nanoFilter.length > 0 && (!q.nanoTopic || !nanoFilter.includes(q.nanoTopic))) return false;
      return true;
    });
  }, [
    allTopperQuestions,
    selectedPaper,
    selectedSubject,
    selectedSection,
    selectedMicrotopic,
    selectedSubtopic,
    selectedNanotopic,
  ]);

  // Topper names (strictly genuine toppers who wrote answers for the selected syllabus topics)
  const topperOptions = useMemo(() => {
    const set = new Set<string>();
    hierarchyFilteredQuestions.forEach(q => {
      q.answers?.forEach(a => {
        if (isGenuineTopperAnswer(a)) {
          const name = getTopperName(a);
          if (name && name !== 'Topper') set.add(name);
        }
      });
    });
    return Array.from(set).sort();
  }, [hierarchyFilteredQuestions]);

  const cognitiveOptions = useMemo(() => {
    const set = new Set<string>();
    hierarchyFilteredQuestions.forEach(q => {
      if (q.cognitive_tag) set.add(q.cognitive_tag);
    });
    return Array.from(set).sort();
  }, [hierarchyFilteredQuestions]);

  const actionWordOptions = useMemo(() => {
    const set = new Set<string>();
    hierarchyFilteredQuestions.forEach(q => {
      if (q.action_words && q.action_words !== 'N/A') set.add(q.action_words);
    });
    return Array.from(set).sort();
  }, [hierarchyFilteredQuestions]);

  // Review Tag Options for Sidebar (Requirement R5)
  const reviewTagOptions = useMemo(() => {
    const set = new Set<string>();
    PRESET_REVIEW_TAGS.forEach(t => set.add(t));
    (userTags || []).forEach(t => set.add(t));
    if (userQuestionStates) {
      Object.values(userQuestionStates).forEach(st => {
        st.reviewTags?.forEach(t => set.add(t));
      });
    }
    return Array.from(set).sort();
  }, [userTags, userQuestionStates]);

  // Auto-prune selectedTopper if active topper selection is not in the filtered topperOptions
  useEffect(() => {
    if (selectedTopper !== 'All') {
      const currentList = selectedTopper.split('|');
      const valid = currentList.filter(t => topperOptions.includes(t));
      if (valid.length === 0) {
        setSelectedTopper('All');
      } else if (valid.length !== currentList.length) {
        setSelectedTopper(valid.join('|'));
      }
    }
  }, [topperOptions, selectedTopper]);

  // 3. Filter Questions Matching Selections & Strict Search (Requirement R1)
  const filteredQuestions = useMemo(() => {
    const topperFilter = selectedTopper !== 'All' ? selectedTopper.split('|') : [];
    const cogFilter = selectedCognitive !== 'All' ? selectedCognitive.split('|') : [];
    const actFilter = selectedActionWord !== 'All' ? selectedActionWord.split('|') : [];
    const tagFilter = selectedReviewTag !== 'All' ? selectedReviewTag.split('|') : [];

    const qTerm = searchQuery.trim().toLowerCase();

    return hierarchyFilteredQuestions.filter(q => {
      if (cogFilter.length > 0 && !cogFilter.includes(q.cognitive_tag || '')) return false;
      if (actFilter.length > 0 && !actFilter.includes(q.action_words || '')) return false;

      // Topper filter
      if (topperFilter.length > 0) {
        const matchesTopper = q.answers?.some(a => {
          if (!isGenuineTopperAnswer(a)) return false;
          const name = getTopperName(a);
          return name ? topperFilter.includes(name) : false;
        });
        if (!matchesTopper) return false;
      }

      // Review tag filter
      if (tagFilter.length > 0) {
        const qTags = userQuestionStates?.[q.id]?.reviewTags || [];
        const matchesTag = tagFilter.some(t => qTags.includes(t));
        if (!matchesTag) return false;
      }

      // Requirement R1 Strict Search: Match ONLY actual question text
      if (qTerm) {
        const qText = (
          q.questionText ||
          (q as any).question_text ||
          (q as any).question ||
          ''
        ).toLowerCase();
        if (!qText.includes(qTerm)) return false;
      }

      return true;
    });
  }, [
    hierarchyFilteredQuestions,
    searchQuery,
    selectedTopper,
    selectedCognitive,
    selectedActionWord,
    selectedReviewTag,
    userQuestionStates,
  ]);

  // Open Full-screen Zoomable Lightbox (Requirement R3)
  const handleOpenViewer = (
    images: string[],
    index: number,
    topper?: string,
    air?: string | number,
    qText?: string
  ) => {
    setViewerImages(images);
    setViewerIndex(index);
    setViewerTopperName(topper || '');
    setViewerAir(air);
    setViewerQuestionText(qText || '');
    setViewerVisible(true);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedPaper('All');
    setSelectedSubject('All');
    setSelectedSection('All');
    setSelectedMicrotopic('All');
    setSelectedSubtopic('All');
    setSelectedNanotopic('All');
    setSelectedTopper('All');
    setSelectedCognitive('All');
    setSelectedActionWord('All');
    setSelectedReviewTag('All');
    setSearchQuery('');
  };

  const hasActiveFilters =
    selectedPaper !== 'All' ||
    selectedSubject !== 'All' ||
    selectedSection !== 'All' ||
    selectedMicrotopic !== 'All' ||
    selectedSubtopic !== 'All' ||
    selectedNanotopic !== 'All' ||
    selectedTopper !== 'All' ||
    selectedCognitive !== 'All' ||
    selectedActionWord !== 'All' ||
    selectedReviewTag !== 'All' ||
    searchQuery !== '';

  // Render Sidebar Accordion Hierarchy matching Question Bank
  const renderSidebarContent = () => {
    const labels = {
      paper: 'Paper',
      subject: 'Subject',
      section: isOptional ? 'Optional Paper' : 'Section Group',
      microtopic: isOptional ? 'Unit' : 'Microtopic',
      subtopic: isOptional ? 'Macro Topic / Sub-Unit' : 'Sub-Topic',
      nanotopic: isOptional ? 'Nano Theme / Topic' : 'Nanotopic',
    };

    return (
      <ScrollView
        showsVerticalScrollIndicator={true}
        style={styles.sidebarScroll}
        contentContainerStyle={{ paddingBottom: 60, paddingTop: isTablet ? 6 : 0 }}
      >
        {/* Header matching Question Bank */}
        <View style={styles.sidebarHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: '#f97316' }} />
            <Text style={[styles.sidebarTitle, { color: colors.textPrimary }]}>
              FILTERS
            </Text>
            <View style={[styles.sidebarCountBadge, { backgroundColor: colors.border + '60' }]}>
              <Text style={[styles.sidebarCountBadgeText, { color: colors.textTertiary }]}>{filteredQuestions.length}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: isTablet ? 36 : 0 }}>
            {hasActiveFilters && (
              <TouchableOpacity onPress={handleResetFilters} style={styles.resetButton}>
                <Text style={styles.resetButtonText}>Reset All</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── GROUP: SYLLABUS ── */}
        <View style={{ marginBottom: 4, marginTop: 4 }}>
          <Text style={styles.sidebarGroupLabel}>
            SYLLABUS
          </Text>

          {/* 1. Paper */}
          <SidebarFilterRow
            label="PAPER"
            items={paperOptions}
            selected={selectedPaper}
            onSelect={(val) => {
              setSelectedPaper(val);
              setSelectedSubject('All');
              setSelectedSection('All');
              setSelectedMicrotopic('All');
              setSelectedSubtopic('All');
              setSelectedNanotopic('All');
            }}
            colors={colors}
            defaultExpanded={true}
          />

          {/* 2. Subject */}
          <SidebarFilterRow
            label="SUBJECT"
            items={subjectOptions}
            selected={selectedSubject}
            onSelect={(val) => {
              setSelectedSubject(val);
              setSelectedSection('All');
              setSelectedMicrotopic('All');
              setSelectedSubtopic('All');
              setSelectedNanotopic('All');
            }}
            colors={colors}
            visible={selectedPaper !== 'All'}
            defaultExpanded={true}
          />

          {/* 3. Section Group / Optional Paper */}
          <SidebarFilterRow
            label={labels.section.toUpperCase()}
            items={sectionOptions}
            selected={selectedSection}
            onSelect={(val) => {
              setSelectedSection(val);
              setSelectedMicrotopic('All');
              setSelectedSubtopic('All');
              setSelectedNanotopic('All');
            }}
            colors={colors}
            visible={selectedSubject !== 'All'}
            defaultExpanded={true}
          />

          {/* 4. Unit / Microtopic */}
          <SidebarFilterRow
            label={labels.microtopic.toUpperCase()}
            items={microtopicOptions}
            selected={selectedMicrotopic}
            onSelect={(val) => {
              setSelectedMicrotopic(val);
              setSelectedSubtopic('All');
              setSelectedNanotopic('All');
            }}
            colors={colors}
            visible={selectedSection !== 'All'}
            defaultExpanded={true}
          />

          {/* 5. Subtopic / Macro Topic */}
          <SidebarFilterRow
            label={labels.subtopic.toUpperCase()}
            items={subtopicOptions}
            selected={selectedSubtopic}
            onSelect={(val) => {
              setSelectedSubtopic(val);
              setSelectedNanotopic('All');
            }}
            colors={colors}
            visible={selectedMicrotopic !== 'All'}
            defaultExpanded={true}
          />

          {/* 6. 5th Layer: Nanotopic / Nano Theme / Topic */}
          <SidebarFilterRow
            label={labels.nanotopic.toUpperCase()}
            items={nanotopicOptions}
            selected={selectedNanotopic}
            onSelect={setSelectedNanotopic}
            colors={colors}
            visible={selectedSubtopic !== 'All' && nanotopicOptions.length > 0}
            defaultExpanded={true}
          />
        </View>

        {/* ── GROUP: TOPPERS & DIRECTIVES ── */}
        <View style={{ marginBottom: 4, marginTop: 10 }}>
          <Text style={styles.sidebarGroupLabel}>
            TOPPERS & DIRECTIVES
          </Text>

          {/* Topper Filter */}
          <SidebarFilterRow
            label="TOPPER / RANK"
            items={topperOptions}
            selected={selectedTopper}
            onSelect={setSelectedTopper}
            colors={colors}
            defaultExpanded={false}
            itemPrefix="🏆 "
          />

          {/* Review Tags Filter (Requirement R5) */}
          {reviewTagOptions.length > 0 && (
            <SidebarFilterRow
              label="REVIEW TAGS"
              items={reviewTagOptions}
              selected={selectedReviewTag}
              onSelect={setSelectedReviewTag}
              colors={colors}
              defaultExpanded={false}
              itemPrefix="🏷️ "
            />
          )}

          {/* Cognitive Directive */}
          {cognitiveOptions.length > 0 && (
            <SidebarFilterRow
              label="DIRECTIVE (COGNITIVE)"
              items={cognitiveOptions}
              selected={selectedCognitive}
              onSelect={setSelectedCognitive}
              colors={colors}
              defaultExpanded={false}
            />
          )}

          {/* Action Words */}
          {actionWordOptions.length > 0 && (
            <SidebarFilterRow
              label="ACTION WORD"
              items={actionWordOptions}
              selected={selectedActionWord}
              onSelect={setSelectedActionWord}
              colors={colors}
              defaultExpanded={false}
            />
          )}
        </View>

        {/* Sync Mains Database Button (Requirement R4) */}
        {onForceSync && (
          <View style={styles.syncSection}>
            <TouchableOpacity
              onPress={onForceSync}
              disabled={syncing}
              style={[
                styles.syncBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
                syncing && { opacity: 0.6 },
              ]}
            >
              <RefreshCw
                size={14}
                color="#f97316"
                style={syncing ? { transform: [{ rotate: '45deg' }] } : undefined}
              />
              <Text style={[styles.syncBtnText, { color: colors.textPrimary }]}>
                {syncing ? 'Syncing...' : 'Sync Mains Database'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  // Render Question Card (Requirements R1, R2, R4, R5)
  const renderQuestionCard: ListRenderItem<ConsolidatedQuestion> = ({ item }) => {
    // Strictly find genuine topper answer (Requirement R1)
    const topperAnswer = item.answers?.find(a => isGenuineTopperAnswer(a));
    if (!topperAnswer) return null;

    const topperName = getTopperName(topperAnswer);
    const air = getAir(topperAnswer);

    let topperSubtitle = '';
    if (air && item.year) {
      topperSubtitle = ` (AIR ${air} - ${item.year})`;
    } else if (air) {
      topperSubtitle = ` (AIR ${air})`;
    } else if (item.year) {
      topperSubtitle = ` (${item.year})`;
    }

    const pageUrls: string[] = getTopperPageUrls(topperAnswer);
    const isSaved = Array.isArray(savedIds)
      ? savedIds.includes(item.id)
      : Boolean((savedIds as Set<string>)?.has?.(item.id));

    // Review Tags Parity (Requirement R5)
    const activeTags = userQuestionStates?.[item.id]?.reviewTags || [];
    const isTagPickerOpen = activeTagPickerQuestionId === item.id;
    const isFlashcarded = Boolean(flashcardedIds?.has(item.id));
    const isSavingCard = Boolean(savingFlashcard?.[item.id]);

    const handleCreateCustomTag = async () => {
      if (!newCustomTagText.trim()) return;
      const clean = newCustomTagText.trim();
      await onCreateTag?.(clean);
      await onToggleQuestionTag?.(item.id, clean);
      setNewCustomTagText('');
    };

    return (
      <View
        style={[
          styles.card,
          isTwoColumn && styles.cardTwoColumn,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {/* 1. Question Text with Marks at the end on the right */}
        <Text style={[styles.questionText, { color: colors.textPrimary }]}>
          {item.questionText}
          {item.marks ? (
            <Text style={[styles.inlineMarksBadge, { color: '#ea580c' }]}>
              {' '}({item.marks} Marks)
            </Text>
          ) : null}
        </Text>

        {/* 2. Below Question: Topper Name without trophy */}
        <View style={styles.topperRowBelowQuestion}>
          <Text style={[styles.topperNameText, { color: '#ea580c' }]}>
            {topperName}
            {topperSubtitle}
          </Text>
        </View>

        {/* Large Handwritten Page Previews - Direct Tap opens full-screen at that index (Requirements R2, R3, R4) */}
        {pageUrls.length > 0 ? (
          <View style={styles.pagePreviewContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pageScroll}>
              {pageUrls.map((url, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.85}
                  onPress={() => handleOpenViewer(pageUrls, idx, topperName, air, item.questionText)}
                  style={[
                    styles.pageThumbWrapper,
                    {
                      width: isTwoColumn ? 130 : 120,
                      height: isTwoColumn ? 175 : 160,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <ExpoImage
                    source={{ uri: TopperImageCacheService.resolveImageUri(url) }}
                    style={styles.pageThumbImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={150}
                  />
                  <View style={styles.pageThumbOverlay}>
                    <Text style={styles.pageNumberTag}>Page {idx + 1}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={[styles.emptyPagesBox, { backgroundColor: colors.bg }]}>
            <Text style={[styles.emptyPagesText, { color: colors.textTertiary }]}>
              {topperAnswer?.answerText ? 'Text-based model answer available' : 'No handwritten copy scanned yet'}
            </Text>
          </View>
        )}

        {/* Active Review Tags Display (Requirement R5) */}
        {activeTags.length > 0 && (
          <View style={styles.activeTagsRow}>
            {activeTags.map(tag => (
              <View
                key={tag}
                style={[
                  styles.activeTagChip,
                  { backgroundColor: 'rgba(249, 115, 22, 0.1)', borderColor: 'rgba(249, 115, 22, 0.3)' },
                ]}
              >
                <Tag size={10} color="#ea580c" style={{ marginRight: 4 }} />
                <Text style={styles.activeTagChipText}>{tag}</Text>
                {onToggleQuestionTag && (
                  <TouchableOpacity
                    onPress={() => onToggleQuestionTag(item.id, tag)}
                    style={styles.removeTagBtn}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <X size={10} color="#ea580c" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Card Action Bar (Requirements R2, R5) */}
        <View style={[styles.cardActionBar, { borderTopColor: colors.border }]}>
          <View style={styles.cardActionsLeft}>
            {/* Tag Button (Requirement R5) */}
            {onToggleQuestionTag && (
              <TouchableOpacity
                onPress={() =>
                  setActiveTagPickerQuestionId(prev => (prev === item.id ? null : item.id))
                }
                style={[
                  styles.cardActionBtn,
                  isTagPickerOpen && { backgroundColor: 'rgba(249, 115, 22, 0.12)', borderColor: '#f97316' },
                ]}
                activeOpacity={0.7}
              >
                <Tag size={14} color={isTagPickerOpen ? '#f97316' : colors.textSecondary} />
                <Text
                  style={[
                    styles.cardActionBtnText,
                    { color: isTagPickerOpen ? '#f97316' : colors.textSecondary },
                  ]}
                >
                  Tag
                </Text>
              </TouchableOpacity>
            )}

            {/* Flashcard Button (Requirement R5) */}
            {onAddFlashcard && (
              <TouchableOpacity
                onPress={() => onAddFlashcard(item, topperAnswer)}
                disabled={isSavingCard}
                style={[
                  styles.cardActionBtn,
                  isFlashcarded && {
                    backgroundColor: 'rgba(139, 92, 246, 0.12)',
                    borderColor: '#8b5cf6',
                  },
                ]}
                activeOpacity={0.7}
              >
                {isSavingCard ? (
                  <ActivityIndicator size="small" color="#8b5cf6" />
                ) : (
                  <Zap
                    size={14}
                    color={isFlashcarded ? '#8b5cf6' : colors.textSecondary}
                    fill={isFlashcarded ? '#8b5cf6' : 'transparent'}
                  />
                )}
                <Text
                  style={[
                    styles.cardActionBtnText,
                    { color: isFlashcarded ? '#8b5cf6' : colors.textSecondary },
                  ]}
                >
                  {isFlashcarded ? 'In Flashcards' : 'Flashcard'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Bookmark Button */}
          {onToggleSaved && (
            <TouchableOpacity
              onPress={() => onToggleSaved(item.id)}
              style={styles.saveButton}
              accessibilityLabel="Bookmark Question"
            >
              <Bookmark
                size={18}
                color={isSaved ? '#f97316' : colors.textTertiary}
                fill={isSaved ? '#f97316' : 'transparent'}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Inline Review Tag Picker (Requirement R5) */}
        {isTagPickerOpen && onToggleQuestionTag && (
          <View
            style={[
              styles.inlineTagPicker,
              { backgroundColor: colors.bg, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.inlineTagPickerTitle, { color: colors.textSecondary }]}>
              Assign Review Tags:
            </Text>
            <View style={styles.inlineTagList}>
              {Array.from(new Set([...PRESET_REVIEW_TAGS, ...(userTags || [])])).map(t => {
                const assigned = activeTags.includes(t);
                return (
                  <Pressable
                    key={t}
                    onPress={() => onToggleQuestionTag(item.id, t)}
                    style={({ pressed }) => [
                      styles.inlineTagItem,
                      {
                        backgroundColor: assigned ? '#f97316' : colors.surface,
                        borderColor: assigned ? '#f97316' : colors.border,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    {assigned && <Check size={11} color="#ffffff" style={{ marginRight: 3 }} />}
                    <Text
                      style={[
                        styles.inlineTagItemText,
                        { color: assigned ? '#ffffff' : colors.textPrimary },
                      ]}
                    >
                      {t}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Custom Tag Input */}
            {onCreateTag && (
              <View style={styles.customTagInputRow}>
                <TextInput
                  style={[
                    styles.customTagInput,
                    { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary },
                  ]}
                  placeholder="New custom tag..."
                  placeholderTextColor={colors.textTertiary}
                  value={newCustomTagText}
                  onChangeText={setNewCustomTagText}
                />
                <TouchableOpacity
                  onPress={handleCreateCustomTag}
                  disabled={!newCustomTagText.trim()}
                  style={[
                    styles.customTagAddBtn,
                    !newCustomTagText.trim() && { opacity: 0.5 },
                  ]}
                >
                  <Plus size={14} color="#ffffff" />
                  <Text style={styles.customTagAddBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Top Bar Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={onBack}
            style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <ChevronLeft size={20} color={colors.textPrimary} />
            <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>Hub</Text>
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Topper Copies Hub</Text>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{filteredQuestions.length} Copies</Text>
            </View>
          </View>

          {/* Clean header: floating button on feed handles restore */}
        </View>

        {/* Mobile-Only Filter Button (Requirement R2: Redundant header filter removed from Tablet) */}
        {!isTablet && (
          <TouchableOpacity
            onPress={() => setSidebarOpen(true)}
            style={[
              styles.filterTriggerBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              hasActiveFilters && { borderColor: '#f97316' },
            ]}
          >
            <Filter size={16} color={hasActiveFilters ? '#f97316' : colors.textSecondary} />
            <Text
              style={[
                styles.filterTriggerText,
                { color: hasActiveFilters ? '#f97316' : colors.textSecondary },
              ]}
            >
              Filters
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Strict Search Bar (Requirement R1) */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Search size={18} color={colors.textTertiary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search questions by keyword in question text..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.mainContent}>
        {/* Tablet Left Panel (Collapsible, Requirement R2) */}
        {isTablet && !sidebarCollapsed && (
          <View
            style={[
              styles.tabletSidebar,
              { backgroundColor: colors.surface, borderRightColor: colors.border },
            ]}
          >
            {/* Floating Close Button matching Question Bank */}
            <TouchableOpacity
              onPress={() => setSidebarCollapsed(true)}
              style={[
                styles.floatingCloseSidebarBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              accessibilityLabel="Collapse Sidebar"
            >
              <ChevronLeft size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            {renderSidebarContent()}
          </View>
        )}

        {/* Question Feed (Expands to 100% width when sidebar collapsed) */}
        <View style={styles.feedContainer}>
          {/* Floating Expand Filters Button when collapsed on Tablet (matching Question Bank) */}
          {isTablet && sidebarCollapsed && (
            <TouchableOpacity
              onPress={() => setSidebarCollapsed(false)}
              style={[
                styles.floatingExpandSidebarBtn,
                {
                  backgroundColor: colors.surface + 'f0',
                  borderColor: colors.border,
                },
              ]}
              accessibilityLabel="Restore Filters Sidebar"
            >
              <ChevronRight size={18} color="#f97316" />
              <Text style={[styles.floatingExpandSidebarBtnText, { color: colors.textPrimary }]}>Filters</Text>
            </TouchableOpacity>
          )}
          {filteredQuestions.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Award size={48} color={colors.textTertiary} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>
                No Topper Copies Found
              </Text>
              <Text style={[styles.emptyStateSubtitle, { color: colors.textSecondary }]}>
                Try selecting a different syllabus topic or resetting your filters.
              </Text>
              {hasActiveFilters && (
                <TouchableOpacity onPress={handleResetFilters} style={styles.emptyResetBtn}>
                  <Text style={styles.emptyResetBtnText}>Reset All Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              key={isTwoColumn ? 'topper-grid-2' : 'topper-list-1'}
              data={filteredQuestions}
              keyExtractor={item => item.id}
              numColumns={isTwoColumn ? 2 : 1}
              columnWrapperStyle={isTwoColumn ? styles.columnWrapper : undefined}
              renderItem={renderQuestionCard}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>

      {/* Mobile Slide-Out Filter Modal */}
      {!isTablet && (
        <Modal
          visible={sidebarOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setSidebarOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Filter Topper Copies
                </Text>
                <TouchableOpacity onPress={() => setSidebarOpen(false)} style={styles.modalCloseBtn}>
                  <X size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              {renderSidebarContent()}
              <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  onPress={() => setSidebarOpen(false)}
                  style={styles.applyFilterBtn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.applyFilterBtnText}>Show {filteredQuestions.length} Copies</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Direct iPhone Photos-Style Zoom Viewer (Requirement R3) */}
      {viewerVisible && (
        <TopperImageViewerModal
          visible={viewerVisible}
          images={viewerImages}
          initialIndex={viewerIndex}
          topperName={viewerTopperName}
          air={viewerAir}
          questionText={viewerQuestionText}
          onClose={() => setViewerVisible(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  countPill: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countPillText: {
    color: '#f97316',
    fontSize: 11,
    fontWeight: '700',
  },
  floatingCloseSidebarBtn: {
    position: 'absolute',
    top: 14,
    right: 12,
    zIndex: 100,
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  floatingExpandSidebarBtn: {
    position: 'absolute',
    left: 16,
    top: 14,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingExpandSidebarBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  filterTriggerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  tabletSidebar: {
    width: 290,
    borderRightWidth: 1,
    position: 'relative',
  },
  sidebarScroll: {
    flex: 1,
    padding: 14,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sidebarTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sidebarCountBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sidebarCountBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  sidebarGroupLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
    paddingHorizontal: 4,
    marginBottom: 4,
    opacity: 0.6,
  },
  sidebarSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'transparent',
    marginVertical: 1,
  },
  sidebarSectionHeaderActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.06)',
    borderColor: 'rgba(249, 115, 22, 0.15)',
  },
  sidebarHeaderLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sidebarHeaderBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sidebarHeaderBadgeText: {
    fontSize: 8,
    fontWeight: '800',
  },
  sidebarChevronCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 2,
  },
  sidebarFchip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    backgroundColor: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
    marginRight: 4,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: Platform.OS === 'ios' ? 1 : 0,
  },
  sidebarFchipSel: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
    shadowColor: '#f97316',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: Platform.OS === 'ios' ? 2 : 0,
  },
  sidebarFchipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: 'rgba(150, 150, 150, 0.15)',
    marginVertical: 12,
  },
  resetButton: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  resetButtonText: {
    fontSize: 12,
    color: '#f97316',
    fontWeight: '600',
  },
  syncSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  syncBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  feedContainer: {
    flex: 1,
    position: 'relative',
  },
  listContent: {
    padding: 16,
    paddingBottom: 60,
    gap: 16,
  },
  columnWrapper: {
    gap: 16,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1.2,
    padding: 18,
    elevation: 2,
    shadowColor: '#64748b',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  cardTwoColumn: {
    flex: 1,
    maxWidth: '49.2%',
  },
  inlineMarksBadge: {
    fontSize: 13,
    fontWeight: '700',
  },
  questionText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 6,
  },
  topperRowBelowQuestion: {
    marginBottom: 10,
  },
  topperNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ea580c',
  },
  pagePreviewContainer: {
    marginTop: 4,
    marginBottom: 10,
  },
  pageScroll: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  pageThumbWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
    backgroundColor: '#1e293b',
  },
  pageThumbImage: {
    width: '100%',
    height: '100%',
  },
  pageThumbOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  pageNumberTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptyPagesBox: {
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 6,
  },
  emptyPagesText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  activeTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    marginBottom: 10,
  },
  activeTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  activeTagChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ea580c',
    marginRight: 4,
  },
  removeTagBtn: {
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  cardActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.25)',
    gap: 5,
  },
  cardActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  saveButton: {
    padding: 6,
    borderRadius: 12,
  },
  inlineTagPicker: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  inlineTagPickerTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inlineTagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  inlineTagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  inlineTagItemText: {
    fontSize: 11,
    fontWeight: '600',
  },
  customTagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  customTagInput: {
    flex: 1,
    fontSize: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    height: 32,
  },
  customTagAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f97316',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  customTagAddBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyResetBtn: {
    backgroundColor: '#f97316',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  emptyResetBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    height: '80%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
  },
  applyFilterBtn: {
    backgroundColor: '#f97316',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  applyFilterBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
