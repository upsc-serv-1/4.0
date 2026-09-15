import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Markdown from 'react-native-markdown-display';
import { Award, ExternalLink, ChevronDown, Copy, Bookmark } from 'lucide-react-native';

import {
  ConsolidatedAnswer,
  isTopperAnswer,
  getTopperName,
  getAir,
  getTopperPageUrls,
} from '../../utils/topperHelpers';
import { ConsolidatedQuestion } from '../../data/mainsConsolidatedLoader';
import AttachedTopperStrip from './AttachedTopperStrip';
import { TopperImageCacheService } from '../../services/TopperImageCacheService';
import {
  KeyBoxColor,
  getMarkdownRules,
  getMarkdownStyles,
  cleanMarkdown,
  parseIntroductoryBox,
  ApproachBox,
  getCleanAvailableAnswers,
  highlightKeywords,
  buildAnswerSnippet,
  getWordCount,
  renderTaxonomyStrip,
} from '../../utils/mainsCardHelpers';

export type MainsQuestionCardProps = {
  question: ConsolidatedQuestion;
  colors: any;
  isDark: boolean;
  isTablet?: boolean;
  zoomFontSize?: number;
  textColorMode?: 'default' | 'black';
  keyBoxMode?: 'boxed' | 'bold';
  keyBoxColor?: KeyBoxColor;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCardLayout?: (event: LayoutChangeEvent) => void;
  selectedInstitute?: string;
  onSelectInstitute?: (inst: string) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (id: string) => void;
  onOpenDetailed: (q: ConsolidatedQuestion) => void;
  onCopyQuestion?: (q: ConsolidatedQuestion) => void;
  onOpenTopperViewer: (
    images: string[],
    index: number,
    name?: string,
    air?: string | number,
    qText?: string
  ) => void;
  attachedToppers?: ConsolidatedAnswer[];
  searchQuery?: string;
  searchAcross?: string[];
};

export default function MainsQuestionCard({
  question: q,
  colors,
  isDark,
  zoomFontSize = 16,
  textColorMode = 'default',
  keyBoxMode = 'boxed',
  keyBoxColor = 'blue',
  isExpanded,
  onToggleExpand,
  onCardLayout,
  selectedInstitute,
  onSelectInstitute,
  isBookmarked = false,
  onToggleBookmark,
  onOpenDetailed,
  onCopyQuestion,
  onOpenTopperViewer,
  attachedToppers = [],
  searchQuery = '',
  searchAcross,
}: MainsQuestionCardProps) {
  const zoomScale = zoomFontSize / 16;

  // Dynamically scaled markdown styles for expanded model answers
  const dynamicMarkdownStyles = useMemo(() => {
    const base = getMarkdownStyles(colors, textColorMode, keyBoxColor);
    const ratio = zoomFontSize / 16;
    return {
      ...base,
      body: {
        ...base.body,
        fontSize: Math.round(14 * ratio),
        lineHeight: Math.round(14 * ratio * 1.5),
      },
      heading1: { ...base.heading1, fontSize: Math.round(18 * ratio) },
      heading2: { ...base.heading2, fontSize: Math.round(16 * ratio) },
      heading3: { ...base.heading3, fontSize: Math.round(15 * ratio) },
      heading4: { ...base.heading4, fontSize: Math.round(14 * ratio) },
    };
  }, [colors, zoomFontSize, keyBoxColor, textColorMode]);

  const isOptionalQ =
    !q.paper ||
    q.paper.trim().toLowerCase() === 'optional' ||
    q.paper.trim().toLowerCase().includes('anthro') ||
    q.paper.trim().toLowerCase().includes('socio');

  let displayPaperOrSubject = '';
  if (isOptionalQ) {
    const rawSub =
      (q.subject && q.subject.trim().toLowerCase() !== 'optional' ? q.subject.trim() : null) ||
      (q.hierarchy_path?.[0] && q.hierarchy_path[0].trim().toLowerCase() !== 'optional' ? q.hierarchy_path[0].trim() : null) ||
      'Optional';
    displayPaperOrSubject =
      rawSub.length > 3 && rawSub === rawSub.toUpperCase()
        ? rawSub.charAt(0) + rawSub.slice(1).toLowerCase()
        : rawSub;
  } else {
    displayPaperOrSubject = q.paper;
  }

  const authorOrSource =
    q.topper_name ||
    q.source_attribution_label ||
    q.institute ||
    (q.answers || []).find(a => a.institute && a.institute.trim() && a.institute.toLowerCase() !== 'model answer')?.institute ||
    (q.answers || []).find(a => a.topper && a.topper.trim())?.topper ||
    '';

  const qTitle = q.questionText || (q as any).question_text || (q as any).title || '';

  return (
    <View
      key={q.id}
      onLayout={onCardLayout}
      style={[
        styles.figmaQuestionCard,
        {
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.65)' : 'rgba(255, 255, 255, 0.75)',
          borderColor: q.is_pyq ? 'rgba(34, 197, 94, 0.6)' : 'rgba(59, 130, 246, 0.55)',
          borderWidth: 1.2,
          borderLeftWidth: 3.5,
          borderLeftColor: q.is_pyq ? '#16a34a' : '#2563eb',
          marginBottom: 12,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onToggleExpand}
        style={styles.qCardHeaderSpacious}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.badgeRow}>
            {!!q.is_pyq ? (
              <View style={{
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                borderColor: 'rgba(34, 197, 94, 0.3)',
                borderWidth: 1,
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 1,
                marginRight: 6,
              }}>
                <Text style={{
                  color: '#16a34a',
                  fontSize: Math.round(zoomFontSize * 0.65),
                  fontWeight: '900',
                }}>PYQ</Text>
              </View>
            ) : (
              <View style={{
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                borderColor: 'rgba(59, 130, 246, 0.3)',
                borderWidth: 1,
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 1,
                marginRight: 6,
              }}>
                <Text style={{
                  color: '#2563eb',
                  fontSize: Math.round(zoomFontSize * 0.65),
                  fontWeight: '900',
                }}>PRACTICE</Text>
              </View>
            )}
            {attachedToppers.length > 0 && (
              <View style={{
                backgroundColor: 'rgba(249, 115, 22, 0.12)',
                borderColor: 'rgba(249, 115, 22, 0.35)',
                borderWidth: 1,
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 1,
                marginRight: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
              }}>
                <Award size={10} color="#ea580c" />
                <Text style={{
                  color: '#ea580c',
                  fontSize: Math.round(zoomFontSize * 0.65),
                  fontWeight: '900',
                }}>
                  {attachedToppers.length} TOPPER COP{attachedToppers.length > 1 ? 'IES' : 'Y'}
                </Text>
              </View>
            )}
            <Text style={[styles.paperBadgeText, { color: '#3b82f6', fontSize: Math.round(zoomFontSize * 0.7), fontWeight: '700' }]}>
              {displayPaperOrSubject}
            </Text>
            {!!authorOrSource && (
              <>
                <Text style={[styles.metaTextDot, { color: colors.textTertiary, fontSize: Math.round(zoomFontSize * 0.7) }]}>•</Text>
                <Text style={[styles.metaText, { color: q.is_pyq ? '#15803d' : '#2563eb', fontWeight: '800', fontSize: Math.round(zoomFontSize * 0.7) }]}>
                  {authorOrSource}
                </Text>
              </>
            )}
            {!!q.year && (!authorOrSource || !String(authorOrSource).includes(String(q.year))) && (
              <>
                <Text style={[styles.metaTextDot, { color: colors.textTertiary, fontSize: Math.round(zoomFontSize * 0.7) }]}>•</Text>
                <Text style={[styles.metaText, { color: colors.textTertiary, fontSize: Math.round(zoomFontSize * 0.7) }]}>{q.year}</Text>
              </>
            )}
            {!!q.marks && (
              <>
                <Text style={[styles.metaTextDot, { color: colors.textTertiary, fontSize: Math.round(zoomFontSize * 0.7) }]}>•</Text>
                <Text style={[styles.metaText, { color: colors.textTertiary, fontSize: Math.round(zoomFontSize * 0.7) }]}>{q.marks} Marks</Text>
              </>
            )}
          </View>
          <Text style={[styles.questionTitleText, { color: colors.textPrimary, fontSize: zoomFontSize, lineHeight: Math.round(zoomFontSize * 1.35) }]}>
            {highlightKeywords(qTitle, searchQuery)}
          </Text>
          {/* Answer match snippet if matched in answers */}
          {(() => {
            const searchInAnswers = !searchAcross || searchAcross.includes('Answers') || searchAcross.includes('Explanation');
            if (!searchQuery.trim() || !searchInAnswers) return null;
            const snippet = buildAnswerSnippet(q.answers || [], searchQuery);
            if (!snippet) return null;
            return (
              <View style={{
                marginTop: 6,
                padding: 8,
                borderRadius: 8,
                backgroundColor: isDark ? 'rgba(234, 88, 12, 0.08)' : '#fff7ed',
                borderColor: isDark ? 'rgba(234, 88, 12, 0.25)' : '#ffedd5',
                borderWidth: 1,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 6,
              }}>
                <View style={{
                  backgroundColor: '#ea580c',
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  borderRadius: 4,
                  marginTop: 1,
                }}>
                  <Text style={{ color: '#ffffff', fontSize: 8.5, fontWeight: '900' }}>ANSWER</Text>
                </View>
                <Text style={{ color: isDark ? '#cbd5e1' : '#475569', fontSize: 11, lineHeight: 16, flex: 1 }} numberOfLines={2}>
                  {snippet}
                </Text>
              </View>
            );
          })()}
        </View>
        <View style={styles.cardActionsRow}>
          {onToggleBookmark && (
            <TouchableOpacity onPress={() => onToggleBookmark(q.id)} style={styles.actionIconButton}>
              <Bookmark
                size={20}
                color={isBookmarked ? '#f59e0b' : colors.textTertiary}
                fill={isBookmarked ? '#f59e0b' : 'transparent'}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => onOpenDetailed(q)} style={styles.actionIconButton}>
            <ExternalLink size={20} color={colors.textTertiary} />
          </TouchableOpacity>
          <ChevronDown
            size={22}
            color={colors.textTertiary}
            style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] as any }}
          />
        </View>
      </TouchableOpacity>

      {/* ── ATTACHED TOPPER COPIES STRIP ── */}
      {attachedToppers.length > 0 && (
        <AttachedTopperStrip
          question={q}
          attachedToppers={attachedToppers}
          colors={colors}
          isDark={isDark}
          onOpenViewer={onOpenTopperViewer}
        />
      )}

      {isExpanded && (
        <View style={[
          styles.answerContainerSpacious,
          {
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            borderTopWidth: 1,
          }
        ]}>
          {(() => {
            const cleanAnsList = getCleanAvailableAnswers(q.answers || []);
            const combinedAnsList: ConsolidatedAnswer[] = [...cleanAnsList];
            (attachedToppers || []).forEach(at => {
              if (!combinedAnsList.some(a => (a.id && a.id === at.id) || (a.institute && a.institute === at.institute))) {
                combinedAnsList.push(at);
              }
            });

            if (combinedAnsList.length === 0) {
              return (
                <View style={{ padding: 12 }}>
                  <Text style={{ fontSize: 13, color: colors.textTertiary, fontStyle: 'italic' }}>
                    No solved answers available for this question.
                  </Text>
                </View>
              );
            }
            
            const currentInst = selectedInstitute || combinedAnsList[0].institute;
            const activeAnswer = combinedAnsList.find(ans => ans.institute === currentInst) || combinedAnsList[0];

            return (
              <View>
                {/* Horizontal Tab Bar of Institutes & Copy Button */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, marginRight: 8 }}>
                    {combinedAnsList.map(ans => {
                      const isTopperAns = isTopperAnswer(ans);
                      const isSelected = currentInst === ans.institute;
                      const activeColor = isTopperAns ? '#f97316' : '#3b82f6';

                      return (
                        <TouchableOpacity
                          key={ans.institute}
                          onPress={() => onSelectInstitute?.(ans.institute)}
                          style={[
                            styles.segmentButton,
                            {
                              marginRight: 6,
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 8,
                              borderWidth: 0.5,
                              borderColor: isSelected ? activeColor : (isTopperAns ? 'rgba(249, 115, 22, 0.4)' : colors.border),
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                            },
                            isSelected
                              ? { backgroundColor: activeColor }
                              : { backgroundColor: isTopperAns ? 'rgba(249, 115, 22, 0.08)' : colors.surface + '88' }
                          ]}
                        >
                          {isTopperAns && (
                            <Award size={12} color={isSelected ? '#ffffff' : '#f97316'} />
                          )}
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '800',
                              color: isSelected ? '#ffffff' : (isTopperAns ? '#ea580c' : colors.textTertiary)
                            }}
                          >
                            {ans.institute}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  
                  {onCopyQuestion && (
                    <TouchableOpacity
                      onPress={() => onCopyQuestion(q)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.surface + 'dd',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: colors.border
                      }}
                    >
                      <Copy size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Render Answer Text / Topper Handwritten Pages */}
                {(() => {
                  const isCurTopper = isTopperAnswer(activeAnswer);
                  const topperPages = isCurTopper ? getTopperPageUrls(activeAnswer) : [];
                  const topperName = getTopperName(activeAnswer, q);
                  const topperAir = getAir(activeAnswer, q);

                  if (isCurTopper && topperPages.length > 0) {
                    return (
                      <View style={{ marginTop: 8 }}>
                        {/* Topper Header Row */}
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 10,
                          paddingHorizontal: 4,
                        }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                            <Award size={14} color="#ea580c" />
                            <Text style={{ fontSize: 13, fontWeight: '800', color: '#ea580c' }}>
                              {topperName}
                            </Text>
                            {topperAir !== undefined && (
                              <View style={{
                                backgroundColor: '#ffedd5',
                                paddingHorizontal: 6,
                                paddingVertical: 1,
                                borderRadius: 4,
                                borderWidth: 0.5,
                                borderColor: '#fdba74'
                              }}>
                                <Text style={{ fontSize: 10, fontWeight: '800', color: '#c2410c' }}>
                                  AIR {topperAir}
                                </Text>
                              </View>
                            )}
                            <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                              · {topperPages.length} {topperPages.length === 1 ? 'page' : 'pages'}
                            </Text>
                          </View>

                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => onOpenTopperViewer(topperPages, 0, topperName, topperAir, qTitle)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              borderRadius: 8,
                              backgroundColor: isDark ? 'rgba(249, 115, 22, 0.15)' : '#ffedd5',
                              borderWidth: 0.5,
                              borderColor: '#fdba74',
                            }}
                          >
                            <ExternalLink size={12} color="#ea580c" />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#ea580c' }}>
                              Fullscreen Gallery
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Large Handwritten Page Previews */}
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingHorizontal: 2 }}
                        >
                          {topperPages.map((url, pIdx) => {
                            const resolvedUri = TopperImageCacheService.resolveImageUri(url);
                            return (
                              <TouchableOpacity
                                key={`page-${pIdx}`}
                                activeOpacity={0.85}
                                onPress={() => onOpenTopperViewer(topperPages, pIdx, topperName, topperAir, qTitle)}
                                style={{
                                  width: 125,
                                  height: 168,
                                  borderRadius: 10,
                                  overflow: 'hidden',
                                  borderWidth: 1.5,
                                  borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(234, 88, 12, 0.35)',
                                  backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                  shadowColor: '#ea580c',
                                  shadowOffset: { width: 0, height: 2 },
                                  shadowOpacity: 0.15,
                                  shadowRadius: 4,
                                  elevation: 3,
                                }}
                              >
                                <ExpoImage
                                  source={{ uri: resolvedUri }}
                                  style={{ width: '100%', height: '100%' }}
                                  contentFit="cover"
                                  cachePolicy="memory-disk"
                                  transition={150}
                                />
                                <View style={{
                                  position: 'absolute',
                                  bottom: 4,
                                  right: 4,
                                  backgroundColor: 'rgba(0, 0, 0, 0.75)',
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 4,
                                }}>
                                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#ffffff' }}>
                                    Page {pIdx + 1}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>

                        {/* If non-empty textual content is available in answerText, show below */}
                        {!!activeAnswer.answerText && !activeAnswer.answerText.trim().startsWith('[Handwritten Topper Copy') && (
                          <View style={{ marginTop: 14 }}>
                            <Markdown key={`${keyBoxMode}-${keyBoxColor}-${textColorMode}-${zoomFontSize}`} style={dynamicMarkdownStyles} rules={getMarkdownRules(colors, isDark)}>
                              {cleanMarkdown(activeAnswer.answerText, keyBoxMode)}
                            </Markdown>
                          </View>
                        )}
                      </View>
                    );
                  }

                  const parsed = parseIntroductoryBox(activeAnswer.answerText);
                  if (parsed) {
                    const approachZoom = Math.round(14 * zoomScale);
                    const remText = activeAnswer.answerText.replace(parsed.rawMatch, '').trim();
                    return (
                      <View style={{ marginTop: 8 }}>
                        <ApproachBox content={parsed.body} title={parsed.title} colors={colors} zoomFontSize={approachZoom} isDark={isDark} />
                        <Markdown key={`${keyBoxMode}-${keyBoxColor}-${textColorMode}-${zoomFontSize}`} style={dynamicMarkdownStyles} rules={getMarkdownRules(colors, isDark)}>
                          {cleanMarkdown(remText, keyBoxMode)}
                        </Markdown>
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, paddingRight: 8, opacity: 0.7 }}>
                          <Text style={{ fontSize: 11, color: colors.textTertiary, fontStyle: 'italic', fontWeight: '600' }}>
                            (~{getWordCount(remText)} words)
                          </Text>
                        </View>
                      </View>
                    );
                  }
                  return (
                    <View style={{ marginTop: 8 }}>
                      <Markdown key={`${keyBoxMode}-${keyBoxColor}-${textColorMode}-${zoomFontSize}`} style={dynamicMarkdownStyles} rules={getMarkdownRules(colors, isDark)}>
                        {cleanMarkdown(activeAnswer.answerText, keyBoxMode)}
                      </Markdown>
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, paddingRight: 8, opacity: 0.7 }}>
                        <Text style={{ fontSize: 11, color: colors.textTertiary, fontStyle: 'italic', fontWeight: '600' }}>
                          (~{getWordCount(activeAnswer.answerText)} words)
                        </Text>
                      </View>
                    </View>
                  );
                })()}
              </View>
            );
          })()}
          {renderTaxonomyStrip(q, colors, isDark)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  figmaQuestionCard: {
    borderRadius: 24,
    borderWidth: 1.2,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: Platform.OS === 'ios' ? 1 : 0,
  },
  qCardHeaderSpacious: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  paperBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  metaText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaTextDot: {
    marginHorizontal: 6,
    fontSize: 11,
  },
  questionTitleText: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  actionIconButton: {
    marginRight: 10,
    padding: 6,
  },
  answerContainerSpacious: {
    borderTopWidth: 1,
    padding: 16,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
