import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, ActivityIndicator, StyleSheet, Animated, TextInput, Dimensions, Alert } from 'react-native';
import Markdown from 'react-native-markdown-display';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { 
  ChevronRight, ExternalLink, Zap, BookOpen, Flag, Check, X, Rocket, Sparkles, 
  AlertCircle, Copy, ThumbsDown, Bookmark, BookmarkCheck, Lightbulb, 
  PenTool, Hash, Star, Info, Info as InfoIcon, Save as SaveIcon, 
  RotateCcw, Trash2, Send, Plus, Edit2, MessageCircle
} from 'lucide-react-native';
import { OptionButton } from './OptionButton';
import { renderAIText } from '../../utils/renderAIText';
import RenderHtml from 'react-native-render-html';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  buildCanonicalExplanations, 
  getPYQCategorization, 
  normalizeInstituteLabel, 
  normalizeProgramLabel, 
  normalizeExplText, 
  extractYearFromText, 
  toBool, 
  getExamInfo 
} from '../../utils/questionUtils';
import { AIExplanationChat } from './AIExplanationChat';

const { width, height } = Dimensions.get('window');

const CONFIDENCE_LEVELS = [
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
  { label: 'Guess', value: 'guess' }
];

const DIFFICULTIES = [
  { label: 'Easy', value: 'easy', color: '#22c55e' },
  { label: 'Medium', value: 'medium', color: '#eab308' },
  { label: 'Hard', value: 'hard', color: '#ef4444' }
];

const ERROR_TYPES = [
  'Fact Mistake',
  'Concept Gap',
  'Silly Mistake',
  'Overthinking',
  'Skipped'
];

export const SharedQuestionCard = ({
  item, index, answerData, isRevealed, arenaMode, isZenMode, colors,
  activeExplSource, onExplSourceChange, aiExplanation, isAiLoading,
  isSavingFlashcard, isFlashcarded, bookmarkedExplanations,
  onRevealExplanation, onOptionSelect, onAddFlashcard, onToggleBookmark,
  onAiExplain, onAiChat, onEditVitamin, onViewSource, onToggleReview, onNoteDraft,
  activeExplanationText, mdStyles, mdRules, mdStylesZen, mdRulesZen,
  optionTextSize, showPYQTags = true, footerContent,
  // Additional props for review mode consistency
  userStudyTags = [],
  toggleStudyTag,
  toggleGuess,
  toggleDifficulty,
  activeExplIndex = {},
  setActiveExplIndex,
  bestAnswers = {},
  ensureBestAnswerLoaded = () => {},
  handleSaveBest,
  handleOpenModify,
  handleDeleteBest,
  handleImproveSubmit,
  modifyOpen = {},
  setModifyOpen,
  modifyText = {},
  setModifyText,
  improving = {},
  improvePromptOpen = {},
  setImprovePromptOpen,
  improvePromptText = {},
  setImprovePromptText,
  savingBest = {},
  aiSummaries = {},
  aiSumLoading = {},
  handleAiSummarize,
  openNotebookFromQuestion,
  openHardnoteFromQuestion,
  savedFlash = {},
  fontSize = 15,
  showNotebookButton = false,
  onCreateTag,
  onQuickSave,
  onNoteChange,
  onCommitToMemory,
  showMistakes = true, // Default to true for backward compatibility
  toggleMistakeType,
}: any) => {
    const { colors: themeColors } = useTheme();
    const effectiveColors = colors || themeColors;
    
    if (!item) return null;
    const effectiveAnswerData = answerData || { 
      selectedAnswer: item.selectedAnswer || null, 
      confidence: item.confidence || null, 
      difficulty: item.difficulty || null, 
      isReview: item.isReview || false, 
      studyTags: item.reviewTags || [],
      note: item.note || null,
      errorCategory: null
    };
    
    // Practice mode state - Initialize from stored answer data to preserve selections across mode switches
    const [localPracticeAnswer, setLocalPracticeAnswer] = useState<string | null>(
      effectiveAnswerData?.selectedAnswer || null
    );
    
    // Initialize showNoteField based on whether note exists
    // Also watch for changes to automatically show/hide if note is cleared
    const [showNoteField, setShowNoteField] = useState<boolean>(!!effectiveAnswerData?.note);
    
    // Update showNoteField whenever note content changes
    useEffect(() => {
      if (effectiveAnswerData?.note) {
        setShowNoteField(true);
      }
    }, [effectiveAnswerData?.note]);
    
    // FIX: Sync localPracticeAnswer with stored answer when switching modes
    // This ensures option selections persist when moving between exam and paper modes
    // Also clears localPracticeAnswer when parent explicitly passes null (e.g. Practice Mode toggle)
    useEffect(() => {
      if (effectiveAnswerData?.selectedAnswer) {
        setLocalPracticeAnswer(effectiveAnswerData.selectedAnswer);
      } else {
        setLocalPracticeAnswer(null);
      }
    }, [item.id, effectiveAnswerData?.selectedAnswer]);
    const showExplanation = showMistakes 
      ? (arenaMode === 'learning' && isRevealed) 
      : (localPracticeAnswer !== null || isRevealed);

    const normalizedExplanations = buildCanonicalExplanations(item);

    const formatMetaLine = (e: any): string => {
      const source = String(e?.source || '').toUpperCase().trim();
      const program = String(e?.program || '').toUpperCase().trim();
      return program ? `${source} - ${program}` : source;
    };

    const inferredInstitutes = (() => {
      const list = Array.isArray((item as any)._institutes)
        ? (item as any)._institutes
        : [];
      const normalized = list
        .map((value: any) => normalizeInstituteLabel(value))
        .filter(Boolean);
      const primary = normalizeInstituteLabel(item.tests?.institute || item.source?.institute || '');
      if (primary && !normalized.includes(primary)) normalized.push(primary);
      return Array.from(new Set(normalized));
    })();

    const availableExplSourceMap = new Map<string, string>();
    normalizedExplanations.forEach((e: any) => {
      availableExplSourceMap.set(e.sourceKey, e.source);
    });
    (inferredInstitutes as string[]).forEach((label: string) => {
      const key = String(label || '').toLowerCase();
      if (key && !availableExplSourceMap.has(key)) {
        availableExplSourceMap.set(key, label);
      }
    });

    if (effectiveAnswerData.note) {
      availableExplSourceMap.set('my_note', 'My Note');
    }

    const availableExplSources = Array.from(availableExplSourceMap.entries()).map(([key, label]) => ({ key, label }));

    const selectedExplSourceRaw = activeExplSource || 'all';
    const selectedExplSource = (
      selectedExplSourceRaw === 'all'
      || selectedExplSourceRaw === 'ai'
      || selectedExplSourceRaw === 'vitamin'
      || selectedExplSourceRaw === 'my_note'
      || availableExplSourceMap.has(selectedExplSourceRaw)
    ) ? selectedExplSourceRaw : 'all';

    const sourceFilteredExplanations = selectedExplSource === 'all'
      ? normalizedExplanations
      : normalizedExplanations.filter((e: any) => e.sourceKey === selectedExplSource);

    const displayExplanations = sourceFilteredExplanations.length > 0
      ? sourceFilteredExplanations
      : (selectedExplSource !== 'all'
          ? [{
              source: availableExplSourceMap.get(selectedExplSource) || selectedExplSource,
              sourceKey: selectedExplSource,
              program: String(item.tests?.program_name || '').trim(),
              year: String(item.exam_year || '').trim(),
              answer: String(item.correct_answer || '').trim().toUpperCase(),
              text: '',
            }]
          : normalizedExplanations);

    const rawIdx = activeExplIndex[item.id] ?? -1;
    const safeIdx = rawIdx >= 0 && rawIdx < displayExplanations.length ? rawIdx : -1;
    
    let effectiveExplanationText: string = activeExplanationText;
    
    if (!effectiveExplanationText) {
      effectiveExplanationText = safeIdx === -1
        ? (displayExplanations.length > 1
            ? displayExplanations
                .map((e: any) => `**${formatMetaLine(e) || e.source}**:\n\n${e.text || '*No explanation provided.*'}`)
                .join('\n\n---\n\n')
            : (displayExplanations[0]?.text || item.explanation_markdown || 'No explanation available.'))
        : (displayExplanations[safeIdx]
            ? (displayExplanations[safeIdx].text || '*No explanation provided by this source.*')
            : (item.explanation_markdown || 'No explanation available.'));
    }

    // Ensure best answer is loaded
    ensureBestAnswerLoaded(item.id);
    const savedBest = bestAnswers[item.id] || null;

    // Determine viewer kind and effective text
    let viewerKind: 'markdown' | 'ai' | 'vitamin' = 'markdown';
    if (selectedExplSource === 'ai') {
      effectiveExplanationText = aiExplanation || effectiveExplanationText;
      viewerKind = 'ai';
    } else if (selectedExplSource === 'vitamin' && savedBest) {
      effectiveExplanationText = savedBest.answer_text || '';
      viewerKind = 'vitamin';
    } else if (selectedExplSource === 'vitamin' && !savedBest && aiExplanation) {
      // Fallback: if vitamin selected but not saved yet, show AI explanation (in transition)
      effectiveExplanationText = aiExplanation;
      viewerKind = 'ai';
    } else if (selectedExplSource === 'my_note') {
      effectiveExplanationText = effectiveAnswerData.note || '';
      viewerKind = 'markdown';
    }

    const handleCopy = async (text: string) => {
      await Clipboard.setStringAsync(text);
      if (Platform.OS === 'android') {
        (global as any).ToastAndroid?.show('Copied to clipboard', (global as any).ToastAndroid?.SHORT);
      } else {
        Alert.alert('Copied', 'Copied to clipboard');
      }
    };

    return (
      <View style={[styles.questionCard, { backgroundColor: isZenMode ? 'transparent' : effectiveColors.surface, borderColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : effectiveColors.border, borderWidth: isZenMode ? 0 : 1 }]}>
        <View style={styles.qHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={[styles.qNumberBadge, { backgroundColor: isZenMode ? '#433422' : effectiveColors.primary, width: Math.max(30, fontSize + 14), height: Math.max(30, fontSize + 14), borderRadius: Math.max(8, (fontSize + 14)/3.5) }]}>
                <Text style={[styles.qNumberText, { color: isZenMode ? '#F4ECD8' : effectiveColors.buttonText, fontSize: Math.max(12, fontSize - 2) }]}>{index + 1}</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            {(() => {
              const pyq = getPYQCategorization(item);
              const hasTags = showPYQTags && (pyq.hasPYQData || item.is_ncert || item.exam_info?.is_ncert || item.source?.is_ncert);
              if (!hasTags) return null;

              const chips: { label: string; bg: string; fg: string; border: string }[] = [];
              if (pyq.hasPYQData && pyq.isUPSC) chips.push({ label: `${pyq.groupName} ${pyq.year}`.trim(), bg: isZenMode ? 'rgba(67, 52, 34, 0.05)' : '#dcfce7', fg: isZenMode ? '#433422' : '#15803d', border: isZenMode ? 'rgba(67, 52, 34, 0.2)' : '#22c55e' });
              if (pyq.hasPYQData && pyq.isAllied) chips.push({ label: `${pyq.groupName} ${pyq.year}`.trim(), bg: isZenMode ? 'rgba(67, 52, 34, 0.05)' : '#fef9c3', fg: isZenMode ? '#433422' : '#a16207', border: isZenMode ? 'rgba(67, 52, 34, 0.2)' : '#eab308' });
              if (pyq.hasPYQData && pyq.isOther) chips.push({ label: `${pyq.groupName} ${pyq.year}`.trim(), bg: isZenMode ? 'rgba(67, 52, 34, 0.05)' : '#f1f5f9', fg: isZenMode ? '#433422' : '#475569', border: isZenMode ? 'rgba(67, 52, 34, 0.2)' : '#94a3b8' });
              if (pyq.hasPYQData && pyq.isGenericPYQ) chips.push({ label: `${pyq.groupName} ${pyq.year}`.trim(), bg: isZenMode ? 'rgba(67, 52, 34, 0.05)' : effectiveColors.primary + '10', fg: isZenMode ? '#433422' : effectiveColors.primary, border: isZenMode ? 'rgba(67, 52, 34, 0.2)' : effectiveColors.primary });
              if (item.is_ncert || item.exam_info?.is_ncert || item.source?.is_ncert || item.micro_topic === 'NCERT') chips.push({ label: 'NCERT', bg: isZenMode ? 'rgba(67, 52, 34, 0.05)' : '#e0f2fe', fg: isZenMode ? '#433422' : '#0369a1', border: isZenMode ? 'rgba(67, 52, 34, 0.2)' : '#0ea5e9' });

              if (chips.length === 0) return null;

              return (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {chips.map((chip, idx) => (
                    <View key={`chip-${item.id}-${idx}`} style={[styles.inlineBadge, { backgroundColor: chip.bg, borderColor: chip.border, paddingHorizontal: 6, paddingVertical: 2, height: 20 }]}> 
                      <Text style={{ color: chip.fg, fontWeight: '900', fontSize: 9 }}>{chip.label}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}
            
            <TouchableOpacity 
              onPress={() => onToggleReview && onToggleReview(item.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: effectiveAnswerData.isReview ? (isZenMode ? '#43342220' : '#fef9c3') : 'transparent' }}
            >
               <Flag size={18} color={effectiveAnswerData.isReview ? (isZenMode ? '#433422' : '#eab308') : (isZenMode ? '#43342240' : effectiveColors.textTertiary)} fill={effectiveAnswerData.isReview ? (isZenMode ? '#433422' : '#eab308') : 'transparent'} />
            </TouchableOpacity>
            
             <TouchableOpacity 
              onPress={() => onAddFlashcard(item)}
              disabled={isSavingFlashcard}
            >
               {isSavingFlashcard ? (
                 <ActivityIndicator size="small" color={effectiveColors.primary} />
               ) : (
                 <Zap 
                   size={20} 
                   color={isFlashcarded ? (isZenMode ? '#433422' : effectiveColors.primary) : (isZenMode ? '#43342240' : effectiveColors.textTertiary)} 
                   fill={isFlashcarded ? (isZenMode ? '#433422' : effectiveColors.primary) : 'transparent'} 
                 />
               )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => openNotebookFromQuestion && openNotebookFromQuestion(item, effectiveExplanationText, 'pilot-v2')}
              style={{ padding: 4, marginRight: 4 }}
              testID={`pilot-save-shortcut-${item.id}`}
            >
              <Rocket size={19} color={isZenMode ? '#433422' : '#5B4EFA'} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onEditVitamin && onEditVitamin(item)}
              style={{ padding: 4 }}
              testID={`vitamin-editor-shortcut-${item.id}`}
            >
               <Plus
                 size={20} 
                 color={isZenMode ? '#433422' : effectiveColors.primary} 
               />
            </TouchableOpacity>

            {arenaMode !== 'exam' && (
              <TouchableOpacity
                onPress={() => setShowNoteField(prev => !prev)}
                style={{ padding: 4, backgroundColor: showNoteField ? (isZenMode ? 'rgba(67,52,34,0.1)' : effectiveColors.primary + '15') : 'transparent', borderRadius: 6 }}
                testID={`note-toggle-shortcut-${item.id}`}
              >
                 <PenTool
                   size={18}
                   color={isZenMode ? '#433422' : (showNoteField ? effectiveColors.primary : effectiveColors.textTertiary)}
                 />
              </TouchableOpacity>
            )}
          </View>
        </View>


        <Markdown style={mdStyles} rules={mdRules}>
          {item.statement_line || item.question_text}
        </Markdown>

        <View style={styles.optionsContainer}>
          {Object.entries(item.options || {}).map(([label, text]) => {
            const historySelected = effectiveAnswerData.selectedAnswer === label;
            const practiceSelected = localPracticeAnswer === label;
            
            const isSelected = showMistakes ? historySelected : practiceSelected;
            const isCorrect = label.toLowerCase() === item.correct_answer?.toLowerCase();
            
            // 🐛 FIX: In exam mode, never show result (correct/wrong) — that's only for learning mode
            const showResult = arenaMode === 'exam' ? false : (showMistakes ? !!effectiveAnswerData.selectedAnswer : practiceSelected);
            const isWrong = isSelected && !isCorrect;

            return (
              <OptionButton
                key={label}
                label={label}
                text={text}
                isSelected={isSelected}
                isCorrect={isCorrect}
                isWrong={isWrong}
                showResult={showResult}
                onSelect={() => {
                  if (!showMistakes) {
                    setLocalPracticeAnswer(label);
                    // CRITICAL FIX: Also persist exam mode selections to the store
                    // so answers persist when switching between exam and paper modes
                    if (onOptionSelect) {
                      onOptionSelect(item.id, label);
                    }
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  } else if (onOptionSelect) {
                    onOptionSelect(item.id, label);
                  }
                }}
                disabled={showMistakes && !!effectiveAnswerData.selectedAnswer}
                fontSize={fontSize}
              />
            );
          })}
        </View>

        {arenaMode === 'learning' && !showExplanation && (
          <TouchableOpacity 
            style={[styles.revealBtn, { borderColor: effectiveColors.primary }]}
            onPress={() => { onRevealExplanation(item.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
          >
            <Lightbulb size={16} color={effectiveColors.primary} />
            <Text style={[styles.revealBtnText, { color: effectiveColors.primary }]}>Show Answer & Explanation</Text>
          </TouchableOpacity>
        )}

        <View style={[styles.controls, { borderTopColor: effectiveColors.border }]}>
          {arenaMode === 'exam' && (
            <>
              <View style={styles.controlRow}>
                <Text style={[styles.controlLabel, { color: effectiveColors.textTertiary }]}>CONFIDENCE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                  {CONFIDENCE_LEVELS.map(level => (
                    <TouchableOpacity
                      key={level.value}
                      onPress={() => toggleGuess && toggleGuess(item.id, effectiveAnswerData.selectedAnswer, level.value)}
                      style={[styles.chip, { backgroundColor: effectiveColors.bg, borderColor: effectiveColors.border }, effectiveAnswerData.confidence === level.value && { backgroundColor: effectiveColors.primary, borderColor: effectiveColors.primary }]}
                    >
                      <Text style={[styles.chipText, { color: effectiveAnswerData.confidence === level.value ? effectiveColors.buttonText : effectiveColors.textSecondary }]}>{level.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.controlRow}>
                <Text style={[styles.controlLabel, { color: effectiveColors.textTertiary }]}>DIFFICULTY</Text>
                <View style={styles.difficultyRow}>
                  {DIFFICULTIES.map(diff => (
                    <TouchableOpacity
                      key={diff.value}
                      onPress={() => toggleDifficulty && toggleDifficulty(item.id, diff.value)}
                      style={[styles.difficultyBtn, { borderColor: effectiveColors.border }, effectiveAnswerData.difficulty === diff.value && { backgroundColor: effectiveColors.primary, borderColor: diff.color }]}
                    >
                      <Text style={[styles.difficultyText, { color: effectiveAnswerData.difficulty === diff.value ? effectiveColors.buttonText : effectiveColors.textSecondary }]}>{diff.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          <View style={styles.controlRow}>
            <Text style={[styles.controlLabel, { color: effectiveColors.textTertiary }]}>REVISION TAGS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={userStudyTags && userStudyTags.length > 3} contentContainerStyle={styles.chipScroll}>
              {(!userStudyTags || userStudyTags.length === 0) ? (
                <Text style={{ color: effectiveColors.textTertiary, fontSize: 11, marginTop: 8 }}>No revision tags created yet</Text>
              ) : (
                <>
                  {[...userStudyTags].map(tag => {
                    const selected = (effectiveAnswerData.studyTags || []).includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => toggleStudyTag && toggleStudyTag(item.id, effectiveAnswerData.studyTags || [], tag)}
                        style={[styles.chip, { backgroundColor: effectiveColors.surfaceStrong, borderColor: effectiveColors.border }, selected && { backgroundColor: effectiveColors.primary, borderColor: effectiveColors.primary }]}
                      >
                        <Text style={[styles.chipText, { color: selected ? effectiveColors.buttonText : effectiveColors.textSecondary }]}>{tag}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {onCreateTag && (
                    <TouchableOpacity
                      onPress={onCreateTag}
                      style={[styles.chip, { backgroundColor: effectiveColors.primary + '10', borderColor: effectiveColors.primary + '40', paddingHorizontal: 8 }]}
                      testID="create-tag-shared-btn"
                    >
                      <Plus size={10} color={effectiveColors.primary} />
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ScrollView>
          </View>

          {/* Mistake Type - Moved below Revision Tags */}
          <View style={[styles.controlRow, { marginTop: 12 }]}>
            <Text style={[styles.controlLabel, { color: effectiveColors.textTertiary }]}>MISTAKE TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              {ERROR_TYPES.map(type => (
                <TouchableOpacity
                  key={type}
                  onPress={() => toggleMistakeType && toggleMistakeType(item.id, type)}
                  style={[styles.chip, { backgroundColor: effectiveColors.surface, borderColor: effectiveColors.border }, effectiveAnswerData.errorCategory === type && { backgroundColor: effectiveColors.primary, borderColor: effectiveColors.primary }]}
                >
                  <Text style={[styles.chipText, { color: effectiveAnswerData.errorCategory === type ? effectiveColors.buttonText : effectiveColors.textSecondary }]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {arenaMode === 'learning' && showExplanation && (
            <>
              <View style={[styles.explanationBox, { backgroundColor: effectiveColors.bg, marginBottom: 16 }]}>
                <View style={styles.explanationHeader}>
                   <InfoIcon size={16} color={effectiveColors.primary} />
                   <Text style={[styles.explanationTitle, { color: effectiveColors.primary }]}>EXPLANATION</Text>
                </View>

                {(availableExplSources.length > 0 || aiExplanation || savedBest) && (
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    {savedBest && (
                      <TouchableOpacity
                        onPress={() => {
                          onExplSourceChange('vitamin');
                          setActiveExplIndex && setActiveExplIndex((prev: any) => ({ ...prev, [item.id]: -1 }));
                        }}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 5,
                          paddingHorizontal: 14, paddingVertical: 6,
                          borderRadius: 20, borderWidth: 1.5,
                          backgroundColor: selectedExplSource === 'vitamin' ? '#f59e0b' : '#f59e0b18',
                          borderColor:     selectedExplSource === 'vitamin' ? '#f59e0b' : '#f59e0b40',
                        }}
                      >
                        <Star size={11} color={selectedExplSource === 'vitamin' ? '#fff' : '#f59e0b'} fill={selectedExplSource === 'vitamin' ? '#fff' : '#f59e0b'} />
                        <Text style={{ fontSize: 10, fontWeight: '900', color: selectedExplSource === 'vitamin' ? '#fff' : '#f59e0b' }}>
                          MY VITAMIN
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => {
                        onExplSourceChange('all');
                        setActiveExplIndex && setActiveExplIndex((prev: any) => ({ ...prev, [item.id]: -1 }));
                      }}
                      activeOpacity={0.7}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                        backgroundColor: selectedExplSource === 'all' ? effectiveColors.primary : effectiveColors.surfaceStrong,
                        borderWidth: 1, borderColor: effectiveColors.border,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '900', color: selectedExplSource === 'all' ? '#fff' : effectiveColors.textTertiary }}>
                        ALL INSTITUTES
                      </Text>
                    </TouchableOpacity>

                    {availableExplSources.map(({ key, label }: any) => (
                      <TouchableOpacity
                        key={`src-${item.id}-${key}`}
                        onPress={() => {
                          onExplSourceChange(key);
                          setActiveExplIndex && setActiveExplIndex((prev: any) => ({ ...prev, [item.id]: -1 }));
                        }}
                        activeOpacity={0.7}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                          backgroundColor: selectedExplSource === key ? effectiveColors.primary : effectiveColors.surfaceStrong,
                          borderWidth: 1, borderColor: effectiveColors.border,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '900', color: selectedExplSource === key ? '#fff' : effectiveColors.textTertiary }}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}

                    <TouchableOpacity
                      onPress={() => onAiExplain && onAiExplain(item)}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        paddingHorizontal: 12, paddingVertical: 6,
                        borderRadius: 20, borderWidth: 1,
                        backgroundColor: selectedExplSource === 'ai' ? effectiveColors.primary : effectiveColors.primary + '18',
                        borderColor:     selectedExplSource === 'ai' ? effectiveColors.primary : effectiveColors.primary + '40',
                      }}
                    >
                      {isAiLoading
                        ? <ActivityIndicator size="small" color={selectedExplSource === 'ai' ? '#fff' : effectiveColors.primary} />
                        : <Sparkles size={11} color={selectedExplSource === 'ai' ? '#fff' : effectiveColors.primary} />
                      }
                      <Text style={{ fontSize: Math.max(9, fontSize - 7), fontWeight: '900', color: selectedExplSource === 'ai' ? '#fff' : effectiveColors.primary }}>
                        {aiExplanation ? '🧠 AI' : '+ AI EXPLAIN'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => onAiChat && onAiChat(item)}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        paddingHorizontal: 12, paddingVertical: 6,
                        borderRadius: 20, borderWidth: 1,
                        backgroundColor: effectiveColors.surfaceStrong,
                        borderColor:     effectiveColors.border,
                      }}
                    >
                      <MessageCircle size={11} color={effectiveColors.textTertiary} />
                      <Text style={{ fontSize: Math.max(9, fontSize - 7), fontWeight: '900', color: effectiveColors.textTertiary }}>
                        ASK AI
                      </Text>
                    </TouchableOpacity>


                    {/* Plus Button to Add/Edit Note */}
                    <TouchableOpacity
                      onPress={() => onEditVitamin && onEditVitamin(item)}
                      activeOpacity={0.7}
                      style={{
                        width: 28, height: 28, borderRadius: 14,
                        backgroundColor: effectiveColors.surfaceStrong,
                        alignItems: 'center', justifyContent: 'center',
                        borderWidth: 1, borderColor: effectiveColors.border,
                        marginLeft: 4
                      }}
                    >
                      <Plus size={16} color={effectiveColors.primary} />
                    </TouchableOpacity>
                  </View>
                )}

                {viewerKind === 'markdown' ? (
                  <Markdown style={mdStyles} rules={mdRules}>
                    {effectiveExplanationText}
                  </Markdown>
                ) : viewerKind === 'vitamin' ? (
                  <RenderHtml
                    source={{ html: effectiveExplanationText || '' }}
                    contentWidth={Dimensions.get('window').width - 64}
                    baseStyle={{ 
                      color: effectiveColors.textPrimary, 
                      fontSize: fontSize || 15, 
                      lineHeight: (fontSize || 15) * 1.5 
                    }}
                    tagsStyles={{
                      b: { fontWeight: 'bold' as const, color: effectiveColors.textPrimary },
                      strong: { fontWeight: 'bold' as const, color: effectiveColors.textPrimary },
                      i: { fontStyle: 'italic' as const },
                      em: { fontStyle: 'italic' as const },
                      p: { marginBottom: 10 },
                      ul: { marginBottom: 10, paddingLeft: 20 },
                      ol: { marginBottom: 10, paddingLeft: 20 },
                      li: { marginBottom: 4 },
                      h1: { fontSize: 22, fontWeight: '900', marginBottom: 12, color: effectiveColors.textPrimary },
                      h2: { fontSize: 18, fontWeight: '800', marginBottom: 10, color: effectiveColors.textPrimary },
                      blockquote: {
                        borderLeftWidth: 4,
                        borderLeftColor: effectiveColors.primary,
                        paddingLeft: 12,
                        marginVertical: 10,
                        backgroundColor: effectiveColors.primary + '08',
                        fontStyle: 'italic' as const,
                      }
                    }}
                  />
                ) : viewerKind === 'ai' && isAiLoading && !aiExplanation ? (
                  <View style={{ paddingVertical: 28, alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator size="small" color={effectiveColors.primary} />
                    <Text style={{ fontSize: 11, color: effectiveColors.textTertiary, fontWeight: '700', letterSpacing: 0.6 }}>
                      GEMINI IS THINKING…
                    </Text>
                  </View>
                ) : (
                  <Markdown style={mdStyles} rules={mdRules}>
                    {effectiveExplanationText}
                  </Markdown>
                )}

                {/* Copy to Clipboard shortcut for Institute Explanations */}
                {showExplanation && selectedExplSource !== 'my_note' && viewerKind !== 'vitamin' && effectiveExplanationText && (
                  <TouchableOpacity
                    onPress={() => handleCopy(effectiveExplanationText)}
                    style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      gap: 6, 
                      marginTop: 12, 
                      padding: 8, 
                      borderRadius: 8, 
                      backgroundColor: effectiveColors.primary + '10',
                      alignSelf: 'flex-start'
                    }}
                  >
                    <Copy size={14} color={effectiveColors.primary} />
                    <Text style={{ fontSize: 11, fontWeight: '800', color: effectiveColors.primary }}>Copy</Text>
                  </TouchableOpacity>
                )}

                {/* Vitamin Actions */}
                {viewerKind === 'vitamin' && savedBest && (
                   <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                      <TouchableOpacity
                        onPress={() => onEditVitamin && onEditVitamin(item)}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 5,
                          paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10,
                          backgroundColor: effectiveColors.surfaceStrong,
                          borderWidth: 1, borderColor: effectiveColors.border,
                        }}
                      >
                        <Edit2 size={12} color={effectiveColors.textSecondary} />
                        <Text style={{ fontSize: 11, fontWeight: '800', color: effectiveColors.textSecondary }}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleCopy(savedBest.answer_text + (savedBest.key_points ? `\n\n**✨ Key Points**\n\n${savedBest.key_points}` : ''))}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 5,
                          paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10,
                          backgroundColor: effectiveColors.surfaceStrong,
                          borderWidth: 1, borderColor: effectiveColors.border,
                        }}
                      >
                        <Copy size={12} color={effectiveColors.textSecondary} />
                        <Text style={{ fontSize: 11, fontWeight: '800', color: effectiveColors.textSecondary }}>Copy</Text>
                      </TouchableOpacity>
                   </View>
                )}

                {viewerKind === 'ai' && !!effectiveExplanationText && !savedBest && (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <TouchableOpacity
                      onPress={() => handleSaveBest && handleSaveBest(item)}
                      disabled={!!savingBest[item.id]}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10,
                        backgroundColor: savedFlash[item.id] ? '#22c55e22' : effectiveColors.surfaceStrong,
                        borderWidth: 1, borderColor: savedFlash[item.id] ? '#22c55e' : effectiveColors.border,
                      }}
                    >
                      {savingBest[item.id] ? (
                        <ActivityIndicator size="small" color={effectiveColors.primary} />
                      ) : (
                        <SaveIcon size={12} color={savedFlash[item.id] ? '#22c55e' : effectiveColors.textSecondary} />
                      )}
                      <Text style={{ fontSize: 11, fontWeight: '800', color: savedFlash[item.id] ? '#22c55e' : effectiveColors.textSecondary }}>
                        {savedFlash[item.id] ? 'Saved ✓' : '★ Save to MyVitamin'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setImprovePromptOpen && setImprovePromptOpen((prev: any) => ({ ...prev, [item.id]: true }));
                        setImprovePromptText && setImprovePromptText((prev: any) => ({ ...prev, [item.id]: '' }));
                      }}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10,
                        backgroundColor: effectiveColors.surfaceStrong,
                        borderWidth: 1, borderColor: effectiveColors.border,
                      }}
                    >
                      <RotateCcw size={12} color={effectiveColors.textSecondary} />
                      <Text style={{ fontSize: 11, fontWeight: '800', color: effectiveColors.textSecondary }}>Regenerate</Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                {viewerKind === 'ai' && improvePromptOpen?.[item.id] && (
                  <View style={{ marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: effectiveColors.bg, borderWidth: 1, borderColor: effectiveColors.border }}>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: effectiveColors.textSecondary, marginBottom: 8 }}>REGENERATE WITH CUSTOM PROMPT</Text>
                    <TextInput
                      placeholder="e.g., Explain like I'm 5... Make it simpler... Add examples..."
                      placeholderTextColor={effectiveColors.textTertiary}
                      style={{
                        backgroundColor: effectiveColors.surface,
                        borderWidth: 1,
                        borderColor: effectiveColors.border,
                        borderRadius: 6,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        fontSize: 12,
                        color: effectiveColors.textPrimary,
                        minHeight: 60,
                        textAlignVertical: 'top',
                      }}
                      multiline
                      value={improvePromptText?.[item.id] || ''}
                      onChangeText={(text) => setImprovePromptText && setImprovePromptText((prev: any) => ({ ...prev, [item.id]: text }))}
                    />
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <TouchableOpacity
                        onPress={() => setImprovePromptOpen && setImprovePromptOpen((prev: any) => ({ ...prev, [item.id]: false }))}
                        style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: effectiveColors.surfaceStrong, borderWidth: 1, borderColor: effectiveColors.border, alignItems: 'center' }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '800', color: effectiveColors.textSecondary }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          handleImproveSubmit && handleImproveSubmit(item, improvePromptText?.[item.id] || '');
                          setImprovePromptOpen && setImprovePromptOpen((prev: any) => ({ ...prev, [item.id]: false }));
                        }}
                        disabled={improving?.[item.id]}
                        style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: effectiveColors.primary, alignItems: 'center' }}
                      >
                        {improving?.[item.id] ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>Regenerate</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Notes Box moved below */}
              </View>
            </>
          )}
          
          {/* 🐛 FIX: Hide notes in exam mode to prevent cheating */}
          {arenaMode !== 'exam' && showNoteField && (
            <View style={{
              marginTop: 16,
              backgroundColor: effectiveColors.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: effectiveColors.primary + '30',
              padding: 14,
              gap: 10,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <PenTool size={14} color={effectiveColors.primary} />
                  {/* 🐛 FIX #37: Removed "QUICK NOTE" label - redundant floating UI */}
                </View>
                {/* 🐛 FIX #38: Save button always visible - content persists via onNoteChange */}
                {onCommitToMemory && (
                  <TouchableOpacity 
                    onPress={() => onCommitToMemory(item.id)}
                    style={{
                      paddingVertical: 5,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      backgroundColor: effectiveColors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>Save Note</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <TextInput
                style={{
                  width: '100%',
                  minHeight: 80,
                  maxHeight: 200,
                  color: effectiveColors.textPrimary,
                  fontSize: 13,
                  lineHeight: 18,
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: effectiveColors.surfaceStrong,
                  borderWidth: 1,
                  borderColor: effectiveColors.border,
                  textAlignVertical: 'top',
                }}
                placeholder="Jot down a quick mnemonics or observation..."
                placeholderTextColor={effectiveColors.textTertiary}
                multiline
                // 🐛 FIX #38: Added scrollEnabled to allow scrolling when keyboard is open
                scrollEnabled={true}
                value={effectiveAnswerData.note || ''}
                onChangeText={(val) => onNoteChange && onNoteChange(item.id, val)}
                onBlur={() => {
                  // 🐛 FIX #38: Auto-save on blur (keyboard dismiss)
                  if (onQuickSave && effectiveAnswerData.note) {
                    onQuickSave(item.id);
                  }
                }}
              />
            </View>
          )}
        </View>
        {footerContent}
      </View>
    );
};

const styles = StyleSheet.create({
  questionCard: { borderRadius: 24, padding: 20, borderWidth: 1, marginBottom: 16 },
  qHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  qNumberBadge: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  qNumberText: { fontWeight: '900' },
  inlineBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  optionsContainer: { marginVertical: 20, gap: 12 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  optionLabel: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  optionLabelText: { fontSize: 14, fontWeight: '900' },
  optionText: { fontSize: 15, flex: 1 },
  revealBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', marginBottom: 20, gap: 8 },
  revealBtnText: { fontWeight: '800' },
  controls: { borderTopWidth: 1, paddingTop: 16 },
  controlRow: { marginBottom: 16 },
  controlLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  chipScroll: { gap: 8, flexDirection: 'row' },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginRight: 8 },
  chipText: { fontSize: 11, fontWeight: '700' },
  difficultyRow: { flexDirection: 'row', gap: 10 },
  difficultyBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1 },
  difficultyText: { fontSize: 11, fontWeight: '800' },
  explanationBox: { padding: 16, borderRadius: 16, gap: 8, position: 'relative' },
  explanationHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  explanationTitle: { fontSize: 11, fontWeight: '900' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 16 },
  actionBtn: { flex: 1, minWidth: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  actionBtnText: { fontSize: 10, fontWeight: '800' },
  noteSection: { marginTop: 20, padding: 16, borderRadius: 16, borderWidth: 1 },
  noteInputWrapper: { borderStyle: 'dashed', borderWidth: 1, borderRadius: 12, marginTop: 8 },
  noteInput: { minHeight: 80, fontSize: 13, padding: 12, textAlignVertical: 'top' },
});
