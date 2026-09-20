import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Home } from 'lucide-react-native';
import { cleanMarkdownContent, getMarkdownStyles } from '../../../app/mains';
import { addQuoteToHomescreen, removeQuoteFromHomescreen, isQuoteOnHomescreenSync } from '../../services/homescreenQuotesService';

export default function MainsQuotesCard({
  item,
  colors,
  zoomScale
}: {
  item: any;
  colors: any;
  zoomScale: number;
}) {
  const quoteTextMarkdownStyle = {
    ...getMarkdownStyles(colors),
    body: {
      color: colors.isDark ? '#f59e0b' : '#b45309', // Elegant gold/amber
      fontSize: 17 * zoomScale,
      lineHeight: 25 * zoomScale,
      fontWeight: '600' as const,
      fontStyle: 'italic' as const,
      textAlign: 'center' as const,
    },
    paragraph: {
      marginVertical: 0,
      textAlign: 'center' as const,
    }
  };

  const anecdoteMarkdownStyle = {
    ...getMarkdownStyles(colors),
    body: {
      color: colors.textSecondary,
      fontSize: 13 * zoomScale,
      lineHeight: 20 * zoomScale,
      fontWeight: '500',
    }
  };

  const connectingWordsMarkdownStyle = {
    ...getMarkdownStyles(colors),
    body: {
      color: colors.textPrimary,
      fontSize: 14.5 * zoomScale,
      lineHeight: 22 * zoomScale,
      fontWeight: '500' as const,
      fontStyle: 'normal' as const,
      textAlign: 'left' as const,
    },
    paragraph: {
      marginVertical: 4,
      textAlign: 'left' as const,
    },
    bullet_list: {
      marginVertical: 4,
    },
    list_item: {
      marginVertical: 4,
    },
    strong: {
      fontWeight: '800' as const,
      color: colors.textPrimary,
    }
  };

  const isConnectingWords = item.subtopic === 'Essay Connectors' || item.category === 'Connecting Words' || item.entry_type === 'connecting_words' || item.category === 'connecting_words' || (item.title && /connecting\s*words/i.test(item.title));
  const isAnecdote = item.entry_type === 'anecdote';
  const isQuote = !isConnectingWords && (item.entry_type === 'quote' || !item.entry_type || !isAnecdote);

  // ----- Old-format content parser ----------------------------------------
  const rawText = item.quoteText || item.rawContent || '';
  const hasOldFormat = /\*\*Quote:\*\*|\*\*Author:\*\*/i.test(rawText);

  let displayQuoteText = rawText;
  let displayAuthor = item.author || '';

  if (hasOldFormat) {
    const quoteMatch = rawText.match(
      /\*\*Quote:\*\*\s*\n\s*[-\u2022]\s*[\u201c\u201d"]?([^\n]+?)[\u201c\u201d"]?\s*(?=\n|$)/i
    );
    if (quoteMatch) {
      displayQuoteText = quoteMatch[1].trim()
        .replace(/^[\u201c"]+/, '')
        .replace(/[\u201d"]+$/, '');
    }
    if (!displayAuthor) {
      const authorMatch = rawText.match(/\*\*Author:\*\*\s*\n\s*[-\u2022]\s*([^\n]+)/i);
      if (authorMatch) displayAuthor = authorMatch[1].trim();
    }
  }

  // State for whether this quote is pinned to the homescreen quote widget
  const [isPinned, setIsPinned] = useState(() => {
    return isQuoteOnHomescreenSync(item.id) || isQuoteOnHomescreenSync(displayQuoteText);
  });
  const [isSavingPin, setIsSavingPin] = useState(false);

  const handleToggleHomescreenPin = async () => {
    if (isSavingPin) return;
    setIsSavingPin(true);
    try {
      if (isPinned) {
        await removeQuoteFromHomescreen(item.id);
        setIsPinned(false);
      } else {
        const textToSave = cleanMarkdownContent(displayQuoteText).trim();
        const authorToSave = displayAuthor || item.author || 'Mains Quotes';
        await addQuoteToHomescreen({ id: item.id, text: textToSave, author: authorToSave, source: item.source });
        setIsPinned(true);
      }
    } catch (e) {
      console.warn('Error toggling homescreen pin:', e);
    } finally {
      setIsSavingPin(false);
    }
  };

  return (
    <View>
      {/* Entry type + Section Group + Topic classification badges */}
      <View style={localStyles.badgeRow}>
        {/* Primary label: QUOTE, ANECDOTE, or CONNECTING WORDS */}
        <View style={[
          localStyles.badge,
          {
            backgroundColor: isConnectingWords ? 'rgba(16,185,129,0.12)' : isAnecdote ? 'rgba(139,92,246,0.12)' : 'rgba(217,119,6,0.1)',
            borderColor: isConnectingWords ? 'rgba(16,185,129,0.35)' : isAnecdote ? 'rgba(139,92,246,0.35)' : 'rgba(217,119,6,0.35)'
          }
        ]}>
          <Text style={[localStyles.badgeText, { color: isConnectingWords ? '#10b981' : isAnecdote ? '#8b5cf6' : '#d97706', fontSize: 9 * zoomScale }]}>
            {isConnectingWords ? 'CONNECTING WORDS' : isAnecdote ? 'ANECDOTE' : 'QUOTE'}
          </Text>
        </View>

        {/* Microtopic / theme tag */}
        {item.microtopic && (
          <View style={[localStyles.badge, { backgroundColor: 'rgba(100,116,139,0.05)', borderColor: colors.border }]}>
            <Text style={[localStyles.badgeText, { color: colors.textTertiary, fontSize: 9 * zoomScale }]}>
              {item.microtopic}
            </Text>
          </View>
        )}

        {/* Button to add/remove quote to homescreen quote widget */}
        <TouchableOpacity
          onPress={handleToggleHomescreenPin}
          activeOpacity={0.7}
          style={[
            localStyles.badge,
            {
              backgroundColor: isPinned ? (colors.isDark ? '#f59e0b25' : '#fef3c7') : (colors.isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc'),
              borderColor: isPinned ? '#f59e0b' : colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              marginLeft: 'auto',
            }
          ]}
        >
          <Home size={10} color={isPinned ? '#d97706' : colors.textSecondary} />
          <Text style={[localStyles.badgeText, { color: isPinned ? '#d97706' : colors.textSecondary, fontSize: 9 * zoomScale }]}>
            {isPinned ? 'Homescreen Quote ✓' : '+ Homescreen Widget'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quote or Anecdote body */}
      {isQuote ? (
        <View style={[
          localStyles.quoteWrapper, 
          { 
            backgroundColor: colors.isDark ? 'rgba(217,119,6,0.04)' : 'rgba(217,119,6,0.03)',
            borderColor: colors.isDark ? 'rgba(217,119,6,0.2)' : 'rgba(217,119,6,0.12)',
            alignItems: isConnectingWords ? 'stretch' : 'center',
          }
        ]}>
          {!isConnectingWords && (
            <Text style={[localStyles.quoteMark, { color: colors.isDark ? 'rgba(245,158,11,0.15)' : 'rgba(180,83,9,0.1)' }]}>“</Text>
          )}
          <Markdown style={isConnectingWords ? connectingWordsMarkdownStyle : quoteTextMarkdownStyle}>
            {cleanMarkdownContent(displayQuoteText)}
          </Markdown>
          
          {/* Author line center-aligned inside the quote card formatted as - <author name> */}
          {displayAuthor ? (
            <Text style={[
              localStyles.quoteAuthor, 
              { 
                color: colors.isDark ? '#fbbf24' : '#b45309', 
                fontSize: 12 * zoomScale 
              }
            ]}>
              - {displayAuthor}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={{ marginVertical: 4 }}>
          <Markdown style={anecdoteMarkdownStyle}>
            {cleanMarkdownContent(displayQuoteText)}
          </Markdown>
          
          {/* Author line at the bottom for anecdotes formatted as - <author name> */}
          {displayAuthor ? (
            <Text style={[
              localStyles.anecdoteAuthor, 
              { 
                color: colors.textTertiary, 
                fontSize: 12 * zoomScale 
              }
            ]}>
              - {displayAuthor}
            </Text>
          ) : null}
        </View>
      )}

      {/* Usage Guide */}
      {item.usageGuide && (
        <View style={[localStyles.usageWrapper, { borderColor: colors.border }]}>
          <Text style={[localStyles.usageTitle, { color: colors.textSecondary, fontSize: 10 * zoomScale }]}>USAGE GUIDE</Text>
          <Markdown style={anecdoteMarkdownStyle}>{cleanMarkdownContent(item.usageGuide)}</Markdown>
        </View>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  quoteWrapper: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginVertical: 4,
    alignItems: 'center',
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
  anecdoteAuthor: {
    fontWeight: '700',
    fontStyle: 'italic',
    marginTop: 6,
  },
  anecdoteCategory: {
    fontWeight: '600',
  },
  usageWrapper: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  usageTitle: {
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
});
