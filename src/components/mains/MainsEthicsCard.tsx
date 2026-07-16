import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { cleanMarkdownContent, getMarkdownStyles, getDiagramUri, markdownRules } from '../../../app/mains';

// Strip markdown bold markers (**text** or __text__) from a plain text string
const stripMarkdownBold = (text: string): string => {
  if (!text) return '';
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/__(.*?)__/g, '$1').trim();
};

export default function MainsEthicsCard({
  item,
  colors,
  ethicsTab,
  zoomScale,
  onImagePress
}: {
  item: any;
  colors: any;
  ethicsTab: string;
  zoomScale: number;
  onImagePress?: (uri: string) => void;
}) {
  const isDark = colors.isDark;

  const subPartBodyMarkdownStyle = {
    ...getMarkdownStyles(colors),
    body: {
      color: colors.textSecondary,
      fontSize: 13 * zoomScale,
      lineHeight: 18 * zoomScale,
      fontWeight: '600',
    }
  };

  const comparePointsMarkdownStyle = {
    ...getMarkdownStyles(colors),
    body: {
      color: colors.textSecondary,
      fontSize: 12 * zoomScale,
      lineHeight: 16 * zoomScale,
      fontWeight: '600',
    }
  };

  // Issue 5: PYQ quote uses amber/gold blockquote style
  const pyqQuoteMarkdownStyle = {
    ...getMarkdownStyles(colors),
    body: {
      color: colors.textPrimary,
      fontSize: 14 * zoomScale,
      lineHeight: 20 * zoomScale,
      fontWeight: '600',
    },
    blockquote: {
      backgroundColor: isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.06)',
      borderLeftWidth: 4,
      borderLeftColor: '#d97706',
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginVertical: 6,
      borderRadius: 6,
    },
    blockquote_text: {
      color: isDark ? '#fbbf24' : '#92400e',
      fontSize: 15 * zoomScale,
      fontWeight: '700',
      fontStyle: 'italic',
      lineHeight: 22 * zoomScale,
    },
    // UPSC question bullet under the quote stays in standard text color
    bullet_list_icon: { color: colors.textSecondary },
  };

  // If inside the Khemka Sir Hub tab, render cards based on their individual database types
  const type = (ethicsTab && ethicsTab !== 'khemka_toolkit' && ethicsTab !== 'all_formats')
    ? (ethicsTab === 'diagrams' ? 'diagram' :
       ethicsTab === 'dimensions' ? 'dimension' :
       ethicsTab === 'comparisons' ? 'comparison' :
       ethicsTab === 'innovations' ? 'innovation' :
       ethicsTab === 'pyq_quotes' ? 'pyq_quote' :
       ethicsTab === 'keywords' ? 'keyword' :
       ethicsTab === 'philosophies' ? 'philosophy' :
       ethicsTab === 'dilemmas' ? 'dilemma' :
       ethicsTab === 'phrases' ? 'phrase' : ethicsTab)
    : (item.core_values === 'philosophy' ? 'philosophy' :
       item.core_values === 'dilemma' ? 'dilemma' :
       item.core_values === 'phrase' ? 'phrase' : item.ethicsType);

  // Soft pastel box colors for sub-theme blocks (cycles through palette), replicated from Data & Facts
  const boxPalette = [
    { bg: 'rgba(59, 130, 246, 0.05)', border: 'rgba(59, 130, 246, 0.25)', title: '#1d4ed8' },
    { bg: 'rgba(16, 185, 129, 0.05)', border: 'rgba(16, 185, 129, 0.25)', title: '#065f46' },
    { bg: 'rgba(245, 158, 11, 0.06)', border: 'rgba(245, 158, 11, 0.28)', title: '#92400e' },
    { bg: 'rgba(139, 92, 246, 0.05)', border: 'rgba(139, 92, 246, 0.25)', title: '#5b21b6' },
    { bg: 'rgba(244, 63, 94, 0.05)', border: 'rgba(244, 63, 94, 0.25)', title: '#9f1239' },
    { bg: 'rgba(6, 182, 212, 0.05)', border: 'rgba(6, 182, 212, 0.25)', title: '#0e7490' },
  ];

  // Select a palette color based on item.id or title hash
  const seedStr = item.id || item.title || '';
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = boxPalette[Math.abs(hash) % boxPalette.length];

  return (
    <View style={{ gap: 8 }}>
      {/* 1. Diagrams - Issue 2: premium box + image fallback */}
      {(type === 'diagram' || type === 'diagrams') && (
        <View style={[
          localStyles.templateBox,
          {
            backgroundColor: palette.bg,
            borderColor: palette.border,
            padding: 10,
            gap: 12
          }
        ]}>
          {item.ethicsData?.diagramsList && item.ethicsData.diagramsList.length > 0 ? (
            <View style={{ gap: 14 }}>
              {item.ethicsData.diagramsList.map((d: any, pIdx: number) => (
                <View key={pIdx} style={{ gap: 6 }}>
                  {d.title ? (
                    <Text style={{ color: colors.textPrimary, fontSize: 13 * zoomScale, fontWeight: '700' }}>
                      {d.title}
                    </Text>
                  ) : null}
                  <TouchableOpacity 
                    activeOpacity={0.9}
                    onPress={() => onImagePress?.(getDiagramUri(d.imagePath))}
                    style={{
                      borderRadius: 12,
                      overflow: 'hidden',
                      backgroundColor: '#ffffff',
                      padding: 8,
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                      borderWidth: 1,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.05,
                      shadowRadius: 4,
                      elevation: 2
                    }}
                  >
                    <Image
                      source={{ uri: getDiagramUri(d.imagePath) }}
                      style={{ width: '100%', height: 240 }}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : item.diagramImagePath ? (() => {
            const paths = item.diagramImagePath.split(',').map((p: string) => p.trim()).filter(Boolean);
            return (
              <View style={{ gap: 12 }}>
                {paths.map((path: string, pIdx: number) => (
                  <TouchableOpacity 
                    activeOpacity={0.9}
                    onPress={() => onImagePress?.(getDiagramUri(path))}
                    style={{
                      borderRadius: 12,
                      overflow: 'hidden',
                      backgroundColor: '#ffffff',
                      padding: 8,
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                      borderWidth: 1,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.05,
                      shadowRadius: 4,
                      elevation: 2
                    }}
                  >
                    <Image
                      source={{ uri: getDiagramUri(path) }}
                      style={{ width: '100%', height: 240 }}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            );
          })() : (
            <View style={{
              height: 100,
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              borderRadius: 12,
              justifyContent: 'center',
              alignItems: 'center',
              borderStyle: 'dashed',
              borderWidth: 1.5,
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
            }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 * zoomScale, fontWeight: '600' }}>
                📷 Diagram image updating soon
              </Text>
            </View>
          )}

          {/* Render PYQ content from content_markdown using proper Markdown */}
          {item.rawContent && item.rawContent.trim().length > 0 && (
            <View style={{ marginTop: 4 }}>
              <Markdown style={subPartBodyMarkdownStyle} rules={markdownRules}>
                {cleanMarkdownContent(item.rawContent.replace(/^---+\s*\n?/gm, '').trim())}
              </Markdown>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#0284c7' }} />
            <Text style={{ color: '#0284c7', fontSize: 11 * zoomScale, fontWeight: '800', letterSpacing: 0.5 }}>
              DIAGRAM TYPE: {item.title || 'Standard'}
            </Text>
          </View>
        </View>
      )}

      {/* 2. Dimensions - raw content preserves nested bullets */}
      {(type === 'dimension' || type === 'dimensions') && (
        <View style={[
          localStyles.templateBox,
          {
            backgroundColor: palette.bg,
            borderColor: palette.border,
            padding: 10,
          }
        ]}>
          <Markdown style={subPartBodyMarkdownStyle} rules={markdownRules}>
            {cleanMarkdownContent(item.rawContent || '')}
          </Markdown>
        </View>
      )}

      {/* 3. Comparisons - dynamic headers + intro/PYQ context */}
      {(type === 'comparison' || type === 'comparisons') && (() => {
        const headers = item.ethicsData?.columnHeaders || { col1: 'Aspect', col2: 'Term A', col3: 'Term B' };
        const nonTableContent = item.ethicsData?.comparisonNonTableContent || '';
        const points = item.ethicsData?.comparisonPoints || [];
        return (
          <View style={{ gap: 10 }}>
            {/* Intro paragraph and PYQs (non-table content) */}
            {nonTableContent.trim().length > 0 && (
              <View style={[
                localStyles.templateBox,
                {
                  backgroundColor: palette.bg,
                  borderColor: palette.border,
                  padding: 10,
                }
              ]}>
                <Markdown style={subPartBodyMarkdownStyle} rules={markdownRules}>
                  {cleanMarkdownContent(nonTableContent.replace(/^---+\s*\n?/gm, '').trim())}
                </Markdown>
              </View>
            )}

            {/* Comparison Table with dynamic headers */}
            {points.length > 0 && (
              <View style={[
                localStyles.templateBox,
                {
                  backgroundColor: palette.bg,
                  borderColor: palette.border,
                  padding: 0,
                  overflow: 'hidden',
                  borderWidth: 1
                }
              ]}>
                {/* Table Header - dynamic from actual MD table */}
                <View style={{
                  flexDirection: 'row',
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                  borderBottomColor: colors.border,
                  borderBottomWidth: 1.5,
                  paddingVertical: 10,
                  paddingHorizontal: 8
                }}>
                  <Text style={{ flex: 2, color: colors.textPrimary, fontSize: 11 * zoomScale, fontWeight: '900' }}>
                    {headers.col1}
                  </Text>
                  <Text style={{ flex: 3, color: '#06b6d4', fontSize: 11 * zoomScale, fontWeight: '900', borderLeftColor: colors.border, borderLeftWidth: 1, paddingLeft: 8 }}>
                    {headers.col2}
                  </Text>
                  <Text style={{ flex: 3, color: '#8b5cf6', fontSize: 11 * zoomScale, fontWeight: '900', borderLeftColor: colors.border, borderLeftWidth: 1, paddingLeft: 8 }}>
                    {headers.col3}
                  </Text>
                </View>

                {/* Table Body */}
                {points.map((cp: any, i: number) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row',
                      borderBottomColor: colors.border,
                      borderBottomWidth: i === (points.length - 1) ? 0 : 1,
                      paddingHorizontal: 8,
                      backgroundColor: i % 2 === 1 ? (isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.015)') : 'transparent'
                    }}
                  >
                    <View style={{ flex: 2, paddingRight: 4, paddingVertical: 10, justifyContent: 'center' }}>
                      <Text style={{ fontWeight: '800', color: colors.textPrimary, fontSize: 11 * zoomScale }}>
                        {stripMarkdownBold(cp.criteria)}
                      </Text>
                    </View>
                    <View style={{ flex: 3, borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 8, paddingVertical: 10, justifyContent: 'center' }}>
                      <Markdown style={comparePointsMarkdownStyle} rules={markdownRules}>{cleanMarkdownContent(cp.termA)}</Markdown>
                    </View>
                    <View style={{ flex: 3, borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 8, paddingVertical: 10, justifyContent: 'center' }}>
                      <Markdown style={comparePointsMarkdownStyle} rules={markdownRules}>{cleanMarkdownContent(cp.termB)}</Markdown>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })()}


      {/* 4. Innovations - legacy standalone card (table renders in parent header) */}
      {(type === 'innovation' || type === 'innovations') && (
        <View style={[
          localStyles.templateBox,
          {
            backgroundColor: palette.bg,
            borderColor: palette.border,
            padding: 10,
            gap: 8
          }
        ]}>
          {item.ethicsData?.impact && (
            <View style={{ gap: 2 }}>
              <Text style={{ color: '#0891b2', fontSize: 10 * zoomScale, fontWeight: '900', letterSpacing: 0.5 }}>IMPACT</Text>
              <Markdown style={subPartBodyMarkdownStyle} rules={markdownRules}>
                {cleanMarkdownContent(item.ethicsData.impact)}
              </Markdown>
            </View>
          )}
          {item.ethicsData?.values && (
            <View style={{ gap: 2, marginTop: 4 }}>
              <Text style={{ color: '#0891b2', fontSize: 10 * zoomScale, fontWeight: '900', letterSpacing: 0.5 }}>VALUES</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 * zoomScale, fontWeight: '600' }}>
                {item.ethicsData.values}
              </Text>
            </View>
          )}
          {item.pyqs && item.pyqs.length > 0 && (
            <View style={{ gap: 2, marginTop: 4 }}>
              <Text style={{ color: '#0891b2', fontSize: 10 * zoomScale, fontWeight: '900', letterSpacing: 0.5 }}>INDICATIVE PYQs</Text>
              <Text style={{ color: '#0284c7', fontSize: 12 * zoomScale, fontWeight: '700' }}>
                {item.pyqs.join(', ')}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 5. PYQ Quotes */}
      {(type === 'pyq_quote' || type === 'pyq_quotes') && (() => {
        const rawText = item.rawContent || item.ethicsData?.keywordDefinition || '';
        
        let displayQuoteText = '';
        let displayAuthor = item.author || '';
        let upscQuestionText = '';
        let microthemeText = '';

        // Clean parser for quotes and metadata
        const lines = rawText.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.includes('**UPSC Question:**') || trimmed.includes('**UPSC Question**')) {
            upscQuestionText = trimmed
              .replace(/^\s*[-*\s•]*\*\*UPSC Question:\*\*\s*/i, '')
              .replace(/^\s*[-*\s•]*\*\*UPSC Question\*\*\s*/i, '')
              .replace(/^[-*\s•]+/g, '')
              .trim();
            continue;
          }
          if (trimmed.includes('**Microtheme:**') || trimmed.includes('**Microtheme**')) {
            microthemeText = trimmed
              .replace(/^\s*[-*\s•]*\*\*Microtheme:\*\*\s*/i, '')
              .replace(/^\s*[-*\s•]*\*\*Microtheme\*\*\s*/i, '')
              .replace(/^[-*\s•]+/g, '')
              .trim();
            continue;
          }
          if (trimmed.startsWith('>') && (trimmed.includes('—') || trimmed.includes('-'))) {
            const authorMatch = trimmed.match(/>\s*[-—]\s*(?:\*\*Attributed to:\*\*|\*\*Author:\*\*|Attributed to:|Author:)?\s*(.*)/i);
            if (authorMatch) {
              const fullAuthor = authorMatch[1].replace(/\*\*/g, '').trim();
              displayAuthor = fullAuthor.replace(/\s*\*\([^)]+\)\*|\s*\([^)]+\)/g, '').trim();
              continue;
            }
          }
          if (trimmed.startsWith('>')) {
            const qText = trimmed.replace(/^>\s*/, '').replace(/\*\*/g, '').trim();
            if (qText) {
              displayQuoteText = qText;
            }
          } else if (trimmed.startsWith('**Quote:**')) {
            displayQuoteText = trimmed.replace('**Quote:**', '').trim();
          } else if (!displayQuoteText && trimmed.length > 5 && !trimmed.startsWith('-')) {
            displayQuoteText = trimmed;
          }
        }

        // Fallback cleans
        displayQuoteText = displayQuoteText.replace(/^[\u201c"]+/, '').replace(/[\u201d"]+$/, '');
        if (!displayAuthor && item.author) {
          displayAuthor = item.author;
        }

        const quoteStyles = {
          ...getMarkdownStyles(colors),
          body: {
            color: colors.isDark ? '#fbbf24' : '#b45309',
            fontSize: 16 * zoomScale,
            lineHeight: 24 * zoomScale,
            fontWeight: '600' as const,
            fontStyle: 'normal' as const,
            textAlign: 'center' as const,
          },
          paragraph: {
            marginVertical: 0,
            textAlign: 'center' as const,
          }
        };

        return (
          <View style={{ gap: 8 }}>
            <View style={[
              localStyles.quoteWrapper,
              {
                backgroundColor: palette.bg,
                borderColor: palette.border,
                paddingVertical: 14,
                paddingHorizontal: 12,
              }
            ]}>
              <Text style={[localStyles.quoteMark, { color: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(180,83,9,0.1)' }]}>“</Text>
              <Markdown style={quoteStyles} rules={markdownRules}>
                {cleanMarkdownContent(displayQuoteText)}
              </Markdown>

              {displayAuthor ? (
                <Text style={[
                  localStyles.quoteAuthor,
                  {
                    color: colors.textPrimary,
                    fontSize: 12 * zoomScale
                  }
                ]}>
                  - {displayAuthor}
                </Text>
              ) : null}

              {(item.subtopic || item.microtopic) && (
                <Text style={[
                  localStyles.quoteCategory,
                  {
                    color: colors.textTertiary,
                    fontSize: 11 * zoomScale,
                    marginTop: 8
                  }
                ]}>
                  {item.subtopic || item.microtopic}
                </Text>
              )}
            </View>

            {upscQuestionText.length > 0 && (
              <View style={[
                localStyles.templateBox,
                {
                  backgroundColor: palette.bg,
                  borderColor: palette.border,
                  padding: 10,
                  marginTop: 2
                }
              ]}>
                <Text style={{ color: colors.textPrimary, fontSize: 11 * zoomScale, fontWeight: '700' }}>
                  UPSC Question context:
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 * zoomScale, marginTop: 4, lineHeight: 17 * zoomScale }}>
                  {upscQuestionText}
                </Text>
              </View>
            )}
          </View>
        );
      })()}

      {/* 6. Keywords, Rules, and Keyword Toolkit */}
      {(type === 'keyword' || type === 'keywords') && (() => {
         const isKhemkaRule = item.title && (item.title.toLowerCase().startsWith('rule ') || item.title === "khemka ethical rules");
         const isNumberedRule = item.title && /^rule\s+\d+/i.test(item.title);
         const isKhemkaToolkit = item.title === "1. Keyword Toolkit for Answers";
         
         if (isKhemkaRule && isNumberedRule) {
            const rawContent = item.rawContent || '';
            const lines = rawContent.split('\n');
            let concept = '';
            let coreValue = '';
            let situationType = '';
            let actionDirective = '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
                const cleanLine = trimmed.replace(/^[-*•]\s*/, '').trim();
                
                if (cleanLine.startsWith('**Concept:**') || cleanLine.startsWith('**Concept**:')) {
                  concept = cleanLine.replace(/^\*\*Concept:?\*\*:\s*|^\*\*Concept:\*\*\s*|^Concept:?\s*/i, '').trim();
                } else if (cleanLine.startsWith('**Core Value:**') || cleanLine.startsWith('**Core Value**:')) {
                  coreValue = cleanLine.replace(/^\*\*Core Value:?\*\*:\s*|^\*\*Core Value:\*\*\s*|^Core Value:?\s*/i, '').trim();
                } else if (cleanLine.startsWith('**Situation Type:**') || cleanLine.startsWith('**Situation Type**:')) {
                  situationType = cleanLine.replace(/^\*\*Situation Type:?\*\*:\s*|^\*\*Situation Type:\*\*\s*|^Situation Type:?\s*/i, '').trim();
                } else if (cleanLine.startsWith('**Action Directive:**') || cleanLine.startsWith('**Action Directive**:')) {
                  actionDirective = cleanLine.replace(/^\*\*Action Directive:?\*\*:\s*|^\*\*Action Directive:\*\*\s*|^Action Directive:?\s*/i, '').trim();
                }
              }
            }

            const valuesList = coreValue
              ? coreValue.split(',').map(v => v.replace(/[`*]/g, '').trim()).filter(Boolean)
              : [];

            return (
              <View style={[
                localStyles.keywordWrapper,
                {
                  backgroundColor: palette.bg,
                  borderWidth: 0,
                  borderColor: 'transparent',
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                }
              ]}>
                {concept ? (
                  <View style={{ marginBottom: 10 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 13 * zoomScale, fontWeight: '800' }}>Concept:</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 * zoomScale, marginTop: 3, lineHeight: 18 * zoomScale }}>{concept}</Text>
                  </View>
                ) : null}

                {valuesList.length > 0 ? (
                  <View style={{ marginBottom: 10 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 13 * zoomScale, fontWeight: '800', marginBottom: 6 }}>Core Values:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {valuesList.map((val, idx) => (
                        <View key={idx} style={{
                          backgroundColor: isDark ? 'rgba(139, 92, 246, 0.18)' : 'rgba(139, 92, 246, 0.08)',
                          borderColor: isDark ? 'rgba(139, 92, 246, 0.35)' : 'rgba(139, 92, 246, 0.25)',
                          borderWidth: 1,
                          borderRadius: 12,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}>
                          <Text style={{ color: '#8b5cf6', fontSize: 11 * zoomScale, fontWeight: '700' }}>{val}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {situationType ? (
                  <View style={{ marginBottom: 10 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 13 * zoomScale, fontWeight: '800' }}>Situation Type:</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 * zoomScale, marginTop: 3, lineHeight: 18 * zoomScale }}>{situationType.replace(/[`*]/g, '')}</Text>
                  </View>
                ) : null}

                {actionDirective ? (
                  <View>
                    <Text style={{ color: colors.textPrimary, fontSize: 13 * zoomScale, fontWeight: '800' }}>Action Directive:</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 * zoomScale, marginTop: 3, lineHeight: 18 * zoomScale }}>{actionDirective.replace(/[`*]/g, '')}</Text>
                  </View>
                ) : null}
              </View>
            );
          }

          if (isKhemkaToolkit) {
            return (
              <View style={[
                localStyles.keywordWrapper,
                {
                  backgroundColor: palette.bg,
                  borderWidth: 0,
                  borderColor: 'transparent',
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                }
              ]}>
                <Markdown style={subPartBodyMarkdownStyle} rules={markdownRules}>
                  {cleanMarkdownContent((item.rawContent || item.ethicsData?.keywordDefinition || '').replace(/\n---+\s*$/gm, '').replace(/^---+\s*$/gm, ''))}
                </Markdown>
              </View>
            );
          }

          // Render SC Judgments in a premium table-like grid layout
          const isJudgment = item.category === 'sc_judgments_hub' || (item.core_values && item.core_values.includes('judgment'));
          if (isJudgment) {
            const raw = item.content_markdown || item.rawContent || '';
            const lines = raw.split('\n');
            const dataLine = lines.find(l => l.trim().startsWith('|') && !l.includes('Key Issue') && !l.includes(':---'));
            if (dataLine) {
              const cells = dataLine.split('|').map(c => c.trim()).filter(Boolean);
              if (cells.length >= 3) {
                const keyIssue = cells[0];
                const ruling = cells[1];
                const articles = cells[2];
                
                return (
                  <View style={[
                    localStyles.keywordWrapper,
                    {
                      backgroundColor: palette.bg,
                      borderColor: palette.border,
                      borderWidth: 1,
                      padding: 0,
                      borderRadius: 10,
                      overflow: 'hidden',
                    }
                  ]}>
                    {/* Key Issue Row */}
                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <View style={{ width: '32%', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', padding: 10, borderRightWidth: 1, borderRightColor: colors.border, justifyContent: 'center' }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 11 * zoomScale, fontWeight: '800' }}>Key Issue</Text>
                      </View>
                      <View style={{ width: '68%', padding: 10, justifyContent: 'center' }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 * zoomScale, fontWeight: '600', lineHeight: 16 * zoomScale }}>{keyIssue}</Text>
                      </View>
                    </View>

                    {/* Ruling Row */}
                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <View style={{ width: '32%', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', padding: 10, borderRightWidth: 1, borderRightColor: colors.border, justifyContent: 'center' }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 11 * zoomScale, fontWeight: '800' }}>SC Ruling</Text>
                      </View>
                      <View style={{ width: '68%', padding: 10, justifyContent: 'center' }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 * zoomScale, fontWeight: '600', lineHeight: 16 * zoomScale }}>{ruling}</Text>
                      </View>
                    </View>

                    {/* Related Articles / Laws Row */}
                    <View style={{ flexDirection: 'row' }}>
                      <View style={{ width: '32%', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', padding: 10, borderRightWidth: 1, borderRightColor: colors.border, justifyContent: 'center' }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 11 * zoomScale, fontWeight: '800' }}>Articles / Laws</Text>
                      </View>
                      <View style={{ width: '68%', padding: 10, justifyContent: 'center' }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 * zoomScale, fontWeight: '700', lineHeight: 16 * zoomScale }}>{articles}</Text>
                      </View>
                    </View>
                  </View>
                );
              }
            }
          }

          return (
            <View style={[
              localStyles.keywordWrapper,
              {
                backgroundColor: palette.bg,
                borderColor: palette.border,
                borderWidth: 1,
                paddingVertical: 14,
                paddingHorizontal: 12,
              }
            ]}>
              <Markdown style={subPartBodyMarkdownStyle} rules={markdownRules}>
                {cleanMarkdownContent((item.rawContent || item.ethicsData?.keywordDefinition || '').replace(/\n---+\s*$/gm, '').replace(/^---+\s*$/gm, ''))}
              </Markdown>
            </View>
          );
        })()}

      {/* 8. Philosophies, Ethical Dilemmas, and Phrases */}
      {(type === 'philosophy' || type === 'dilemma' || type === 'phrase') && (
        <View style={[
          localStyles.keywordWrapper,
          {
            backgroundColor: palette.bg,
            borderColor: palette.border,
            borderWidth: 1,
            paddingVertical: 14,
            paddingHorizontal: 12,
          }
        ]}>
          <Markdown style={subPartBodyMarkdownStyle} rules={markdownRules}>
            {cleanMarkdownContent((item.rawContent || item.content_markdown || '').replace(/\n---+\s*$/gm, '').replace(/^---+\s*$/gm, ''))}
          </Markdown>
        </View>
      )}

      {/* 7. Case Study Situations (Khemka Sir Hub) */}
      {(type === 'situation' || type === 'situations') && (() => {
        const rawContent = item.rawContent || '';
        
        const sitMatch = rawContent.match(/\*\*Situation\*\*:\s*([\s\S]+?)(?=\n\*\*(?:Khemka Sir's Response|Khemka Sir’s Response|Principle|Theme|ID|Situation Type)\*\*:|$)/i);
        const respMatch = rawContent.match(/\*\*(?:Khemka Sir's Response|Khemka Sir’s Response)\*\*:\s*([\s\S]+?)(?=\n\*\*(?:Situation|Principle|Theme|ID|Situation Type)\*\*:|$)/i);
        const princMatch = rawContent.match(/\*\*Principle\*\*:\s*([\s\S]+?)(?=\n\*\*(?:Situation|Khemka Sir's Response|Khemka Sir’s Response|Theme|ID|Situation Type)\*\*:|$)/i);
        const sitTypeMatch = rawContent.match(/\*\*Situation Type\*\*:\s*([\s\S]+?)(?=\n\*\*(?:Situation|Khemka Sir's Response|Khemka Sir’s Response|Principle|Theme|ID)\*\*:|$)/i);
        
        const situation = sitMatch ? sitMatch[1].trim() : '';
        const responseText = respMatch ? respMatch[1].trim() : '';
        const principle = princMatch ? princMatch[1].trim() : '';
        const situationType = sitTypeMatch ? sitTypeMatch[1].trim() : '';

        return (
          <View style={{ gap: 8 }}>
            {/* Situation Box */}
            {situation ? (
              <View style={[
                localStyles.templateBox,
                {
                  backgroundColor: palette.bg,
                  borderColor: palette.border,
                  padding: 10,
                }
              ]}>
                <Text style={{ color: palette.title || colors.textPrimary, fontSize: 10 * zoomScale, fontWeight: '900', letterSpacing: 0.5, marginBottom: 4 }}>SITUATION</Text>
                <Markdown style={subPartBodyMarkdownStyle} rules={markdownRules}>
                  {cleanMarkdownContent(situation)}
                </Markdown>
              </View>
            ) : null}

            {/* Response Box */}
            {responseText ? (
              <View style={[
                localStyles.templateBox,
                {
                  backgroundColor: isDark ? 'rgba(139, 92, 246, 0.04)' : 'rgba(139, 92, 246, 0.05)',
                  borderColor: isDark ? 'rgba(139, 92, 246, 0.25)' : 'rgba(139, 92, 246, 0.25)',
                  padding: 10,
                  borderLeftWidth: 3,
                  borderLeftColor: '#8b5cf6',
                }
              ]}>
                <Text style={{ color: '#8b5cf6', fontSize: 10 * zoomScale, fontWeight: '900', letterSpacing: 0.5, marginBottom: 4 }}>KHEMKA SIR'S RESPONSE</Text>
                <Markdown style={subPartBodyMarkdownStyle} rules={markdownRules}>
                  {cleanMarkdownContent(responseText)}
                </Markdown>
              </View>
            ) : null}

            {/* Principle Box */}
            {principle ? (
              <View style={[
                localStyles.templateBox,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.04)' : 'rgba(16, 185, 129, 0.05)',
                  borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.25)',
                  padding: 10,
                  borderLeftWidth: 3,
                  borderLeftColor: '#10b981',
                }
              ]}>
                <Text style={{ color: '#10b981', fontSize: 10 * zoomScale, fontWeight: '900', letterSpacing: 0.5, marginBottom: 4 }}>KEY PRINCIPLE</Text>
                <Markdown style={subPartBodyMarkdownStyle} rules={markdownRules}>
                  {cleanMarkdownContent(principle)}
                </Markdown>
              </View>
            ) : null}

            {/* Situation Type Box */}
            {situationType ? (
              <View style={[
                localStyles.templateBox,
                {
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.04)' : 'rgba(59, 130, 246, 0.05)',
                  borderColor: isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.25)',
                  padding: 10,
                  borderLeftWidth: 3,
                  borderLeftColor: '#3b82f6',
                }
              ]}>
                <Text style={{ color: '#3b82f6', fontSize: 10 * zoomScale, fontWeight: '900', letterSpacing: 0.5, marginBottom: 4 }}>SITUATION TYPE</Text>
                <Markdown style={subPartBodyMarkdownStyle} rules={markdownRules}>
                  {cleanMarkdownContent(situationType)}
                </Markdown>
              </View>
            ) : null}
          </View>
        );
      })()}
    </View>
  );
}

const localStyles = StyleSheet.create({
  templateBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginVertical: 2,
  },
  quoteWrapper: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  keywordWrapper: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginVertical: 2,
    alignItems: 'stretch',
    justifyContent: 'center',
    position: 'relative',
  },
  quoteMark: {
    fontSize: 48,
    fontWeight: '900',
    lineHeight: 32,
    height: 28,
    fontFamily: 'serif',
    marginTop: -8,
    marginBottom: -4,
  },
  quoteAuthor: {
    fontWeight: '700',
    fontStyle: 'italic',
    marginTop: 10,
    textAlign: 'center',
  },
  quoteCategory: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
