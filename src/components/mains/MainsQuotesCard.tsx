import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { cleanMarkdownContent, getMarkdownStyles } from '../../../app/mains';

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

  const isQuote = item.entry_type === 'quote' || !item.entry_type;
  const isAnecdote = item.entry_type === 'anecdote';

  return (
    <View>
      {/* Section + Topic classification badges */}
      {(item.sectionGroup || item.microtopic) && (
        <View style={localStyles.badgeRow}>
          {item.sectionGroup && (
            <View style={[
              localStyles.badge, 
              { 
                backgroundColor: isAnecdote ? 'rgba(139,92,246,0.08)' : 'rgba(217,119,6,0.08)', 
                borderColor: isAnecdote ? 'rgba(139,92,246,0.3)' : 'rgba(217,119,6,0.3)' 
              }
            ]}>
              <Text style={[localStyles.badgeText, { color: isAnecdote ? '#8b5cf6' : '#d97706', fontSize: 9 * zoomScale }]}>
                {item.sectionGroup}
              </Text>
            </View>
          )}
          {item.microtopic && (
            <View style={[localStyles.badge, { backgroundColor: 'rgba(100,116,139,0.05)', borderColor: colors.border }]}>
              <Text style={[localStyles.badgeText, { color: colors.textTertiary, fontSize: 9 * zoomScale }]}>
                {item.microtopic}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Quote or Anecdote body */}
      {isQuote ? (
        <View style={[
          localStyles.quoteWrapper, 
          { 
            backgroundColor: colors.isDark ? 'rgba(217,119,6,0.04)' : 'rgba(217,119,6,0.03)',
            borderColor: colors.isDark ? 'rgba(217,119,6,0.2)' : 'rgba(217,119,6,0.12)'
          }
        ]}>
          <Text style={[localStyles.quoteMark, { color: colors.isDark ? 'rgba(245,158,11,0.15)' : 'rgba(180,83,9,0.1)' }]}>“</Text>
          <Markdown style={quoteTextMarkdownStyle}>{cleanMarkdownContent(item.quoteText || item.rawContent || '')}</Markdown>
          
          {/* Author line center-aligned inside the quote card */}
          {item.author && (
            <Text style={[
              localStyles.quoteAuthor, 
              { 
                color: colors.isDark ? '#fbbf24' : '#b45309', 
                fontSize: 12 * zoomScale 
              }
            ]}>
              — {item.author}
            </Text>
          )}
        </View>
      ) : (
        <View style={{ marginVertical: 4 }}>
          <Markdown style={anecdoteMarkdownStyle}>{cleanMarkdownContent(item.quoteText || item.rawContent || '')}</Markdown>
          
          {/* Author line at the bottom for anecdotes */}
          {item.author && (
            <Text style={[
              localStyles.anecdoteAuthor, 
              { 
                color: colors.textTertiary, 
                fontSize: 12 * zoomScale 
              }
            ]}>
              — {item.author}
            </Text>
          )}
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
  anecdoteAuthor: {
    fontWeight: '700',
    fontStyle: 'italic',
    marginTop: 6,
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
