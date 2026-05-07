import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, ActivityIndicator, StyleSheet, Animated, TextInput, Dimensions } from 'react-native';
import Markdown from 'react-native-markdown-display';
import * as Haptics from 'expo-haptics';
import { 
  ChevronRight, ExternalLink, Zap, BookOpen, Flag, Check, X, Sparkles, 
  AlertCircle, Copy, ThumbsDown, Bookmark, BookmarkCheck, Lightbulb, 
  PenTool, Hash, Star, Info, Info as InfoIcon, Save as SaveIcon, 
  RotateCcw, Trash2, Send, Plus, Edit2
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
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

const { width, height } = Dimensions.get('window');

const OptionButton = ({ label, text, isSelected, isCorrect, isWrong, showResult, onSelect, disabled, fontSize = 16 }: any) => {
  const { colors } = useTheme();
  
  let borderColor = colors.border;
  let backgroundColor = colors.surface;
  let textColor = colors.textPrimary;
  let letterBg = colors.surfaceStrong;
  let letterColor = colors.textSecondary;

  if (isSelected) {
    borderColor = colors.primary;
    backgroundColor = colors.primary + '10';
    letterBg = colors.primary;
    letterColor = colors.buttonText;
  }

  if (showResult) {
    if (isCorrect) {
      borderColor = '#22c55e';
      backgroundColor = '#dcfce7';
      textColor = '#15803d';
      letterBg = '#22c55e';
      letterColor = '#fff';
    } else if (isWrong) {
      borderColor = '#ef4444';
      backgroundColor = '#fee2e2';
      textColor = '#b91c1c';
      letterBg = '#ef4444';
      letterColor = '#fff';
    }
  }

  return (
    <TouchableOpacity
      onPress={onSelect}
      disabled={disabled}
      style={[
        styles.optionBtn,
        { backgroundColor, borderColor, borderWidth: isSelected || showResult ? 2 : 1 },
      ]}
    >
      <View style={[styles.optionLabel, { backgroundColor: letterBg }]}>
        <Text style={[styles.optionLabelText, { color: letterColor }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.optionText, { color: textColor, fontWeight: (isCorrect && showResult) || isSelected ? '700' : '500', fontSize: Math.max(12, fontSize - 1), lineHeight: Math.max(18, (fontSize - 1) * 1.35) }]}>{text}</Text>
      {showResult && isCorrect && <Check size={18} color="#22c55e" style={{ marginLeft: 'auto' }} />}
      {showResult && isWrong && <X size={18} color="#ef4444" style={{ marginLeft: 'auto' }} />}
    </TouchableOpacity>
  );
};

const renderAIText = (text: string, style: any) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*|__.*?__)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <Text key={i} style={[style, { fontWeight: '900' }]}>{part.slice(2, -2)}</Text>;
    }
    if (part.startsWith('__') && part.endsWith('__')) {
      return <Text key={i} style={[style, { textDecorationLine: 'underline' }]}>{part.slice(2, -2)}</Text>;
    }
    return <Text key={i} style={style}>{part}</Text>;
  });
};

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

export const SharedQuestionCard = ({
  item, index, answerData, isRevealed, arenaMode, isZenMode, colors,
  activeExplSource, onExplSourceChange, aiExplanation, isAiLoading,
  isSavingFlashcard, isFlashcarded, bookmarkedExplanations,
  onRevealExplanation, onOptionSelect, onAddFlashcard, onToggleBookmark,
  onAiExplain, onViewSource, onToggleReview, onNoteDraft,
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
}: any) => {
    const { colors: themeColors } = useTheme();
    const effectiveColors = colors || themeColors;
    
    if (!item) return null;
    const effectiveAnswerData = answerData || { selectedAnswer: null, confidence: null, difficulty: null, isReview: false, studyTags: [] };
    const showExplanation = arenaMode === 'learning' && isRevealed;

    const normalizedExplanations = buildCanonicalExplanations(item);

    const formatMetaLine = (e: any): string => {
      return String(e?.source || '').toUpperCase().trim();
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
    inferredInstitutes.forEach((label: string) => {
      const key = String(label || '').toLowerCase();
      if (key && !availableExplSourceMap.has(key)) {
        availableExplSourceMap.set(key, label);
      }
    });

    const availableExplSources = Array.from(availableExplSourceMap.entries()).map(([key, label]) => ({ key, label }));

    const selectedExplSourceRaw = activeExplSource || 'all';
    const selectedExplSource = (
      selectedExplSourceRaw === 'all'
      || selectedExplSourceRaw === 'ai'
      || selectedExplSourceRaw === 'vitamin'
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

    let viewerKind: 'markdown' | 'ai' | 'vitamin' = 'markdown';
    if (selectedExplSource === 'ai') {
      effectiveExplanationText = aiExplanation || effectiveExplanationText;
      viewerKind = 'ai';
    } else if (selectedExplSource === 'vitamin') {
      effectiveExplanationText = bestAnswers[item.id]?.answer_text || '';
      viewerKind = 'vitamin';
    }

    ensureBestAnswerLoaded(item.id);
    const savedBest = bestAnswers[item.id] || null;

    return (
      <View style={[styles.questionCard, { backgroundColor: isZenMode ? 'transparent' : effectiveColors.surface, borderColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : effectiveColors.border, borderWidth: isZenMode ? 0 : 1 }]}>
        <View style={styles.qHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={[styles.qNumberBadge, { backgroundColor: isZenMode ? '#433422' : effectiveColors.primary }]}>
                <Text style={[styles.qNumberText, { color: isZenMode ? '#F4ECD8' : effectiveColors.buttonText }]}>{index + 1}</Text>
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
          </View>
        </View>

        <Markdown style={mdStyles} rules={mdRules}>
          {item.statement_line || item.question_text}
        </Markdown>

        <View style={styles.optionsContainer}>
          {Object.entries(item.options || {}).map(([label, text]) => {
            const isSelected = effectiveAnswerData.selectedAnswer === label;
            const isCorrect = label.toLowerCase() === item.correct_answer?.toLowerCase();
            const isWrong = isSelected && !isCorrect;
            return (
              <OptionButton
                key={label}
                label={label}
                text={text}
                isSelected={isSelected}
                isCorrect={isCorrect}
                isWrong={isWrong}
                showResult={arenaMode === 'learning' && !!effectiveAnswerData.selectedAnswer}
                onSelect={() => onOptionSelect(item.id, label)}
                disabled={arenaMode === 'learning' && showExplanation}
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
                      style={[styles.difficultyBtn, { borderColor: effectiveColors.border }, effectiveAnswerData.difficulty === diff.value && { backgroundColor: diff.color + '20', borderColor: diff.color }]}
                    >
                      <Text style={[styles.difficultyText, { color: effectiveAnswerData.difficulty === diff.value ? diff.color : effectiveColors.textSecondary }]}>{diff.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          <View style={styles.controlRow}>
            <Text style={[styles.controlLabel, { color: effectiveColors.textTertiary }]}>STUDY TAGS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              {[...userStudyTags].map(tag => {
                const selected = (effectiveAnswerData.studyTags || []).includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => toggleStudyTag && toggleStudyTag(item.id, effectiveAnswerData.studyTags || [], tag)}
                    style={[styles.chip, { backgroundColor: effectiveColors.surfaceStrong, borderColor: effectiveColors.border }, selected && { backgroundColor: effectiveColors.primary + '20', borderColor: effectiveColors.primary }]}
                  >
                    <Text style={[styles.chipText, { color: selected ? effectiveColors.primary : effectiveColors.textSecondary }]}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
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
                      onPress={() => onAiExplain(item)}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        paddingHorizontal: 12, paddingVertical: 6,
                        borderRadius: 20, borderWidth: 1,
                        backgroundColor: selectedExplSource === 'ai' ? '#7c3aed' : '#7c3aed18',
                        borderColor:     selectedExplSource === 'ai' ? '#7c3aed' : '#7c3aed40',
                      }}
                    >
                      {isAiLoading
                        ? <ActivityIndicator size="small" color={selectedExplSource === 'ai' ? '#fff' : '#7c3aed'} />
                        : <Sparkles size={11} color={selectedExplSource === 'ai' ? '#fff' : '#7c3aed'} />
                      }
                      <Text style={{ fontSize: 10, fontWeight: '900', color: selectedExplSource === 'ai' ? '#fff' : '#7c3aed' }}>
                        {aiExplanation ? '🧠 AI' : '+ AI EXPLAIN'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}



                {viewerKind === 'markdown' ? (
                  <Markdown style={mdStyles} rules={mdRules}>
                    {effectiveExplanationText}
                  </Markdown>
                ) : viewerKind === 'ai' && isAiLoading && !aiExplanation ? (
                  <View style={{ paddingVertical: 28, alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator size="small" color="#7c3aed" />
                    <Text style={{ fontSize: 11, color: effectiveColors.textTertiary, fontWeight: '700', letterSpacing: 0.6 }}>
                      GEMINI IS THINKING…
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: fontSize, color: effectiveColors.textPrimary, lineHeight: fontSize * 1.6, fontWeight: '500' }}>
                    {renderAIText(effectiveExplanationText, { fontSize: fontSize, color: effectiveColors.textPrimary, lineHeight: fontSize * 1.6, fontWeight: '500' })}
                  </Text>
                )}

                {(viewerKind === 'ai' || viewerKind === 'vitamin') && !!effectiveExplanationText && !modifyOpen[item.id] && (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                    {viewerKind === 'ai' && !savedBest && (
                      <>
                        <TouchableOpacity
                          onPress={() => handleSaveBest && handleSaveBest(item)}
                          disabled={!!savingBest[item.id]}
                          activeOpacity={0.7}
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
                          onPress={() => handleOpenModify && handleOpenModify(item)}
                          activeOpacity={0.7}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 5,
                            paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10,
                            backgroundColor: effectiveColors.surfaceStrong,
                            borderWidth: 1, borderColor: effectiveColors.border,
                          }}
                        >
                          <Edit2 size={12} color={effectiveColors.textSecondary} />
                          <Text style={{ fontSize: 11, fontWeight: '800', color: effectiveColors.textSecondary }}>
                            Modify & Save
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}
              </View>
            </>
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
  explanationBox: { padding: 16, borderRadius: 16, gap: 8 },
  explanationHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  explanationTitle: { fontSize: 11, fontWeight: '900' },
});
