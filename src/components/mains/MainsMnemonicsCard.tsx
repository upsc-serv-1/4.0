import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { cleanMarkdownContent, getMarkdownStyles } from '../../../app/mains';

export default function MainsMnemonicsCard({
  item,
  colors,
  zoomScale
}: {
  item: any;
  colors: any;
  zoomScale: number;
}) {
  const subPartBodyMarkdownStyle = {
    ...getMarkdownStyles(colors),
    body: {
      color: colors.textSecondary,
      fontSize: 13 * zoomScale,
      lineHeight: 18 * zoomScale,
      fontWeight: '600',
    }
  };

  return (
    <View>
      <View style={localStyles.mnemonicKeywordRow}>
        <Text style={[localStyles.mnemonicLabel, { fontSize: 10 * zoomScale }]}>KEYWORD:</Text>
        <Text style={[localStyles.mnemonicValue, { color: colors.textPrimary, fontSize: 14 * zoomScale }]}>{item.mnemonicKeyword}</Text>
      </View>
      <View style={localStyles.expansionList}>
        {item.mnemonicExpansion?.map((ex: any, i: number) => (
          <View key={i} style={localStyles.expansionRow}>
            <View style={localStyles.letterWrapper}>
              <Text style={[localStyles.letterText, { fontSize: 12 * zoomScale }]}>{ex.letter}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[localStyles.exMeaning, { color: colors.textPrimary, fontSize: 13 * zoomScale }]}>{ex.meaning}</Text>
              {ex.detail && <Markdown style={subPartBodyMarkdownStyle}>{cleanMarkdownContent(ex.detail)}</Markdown>}
            </View>
          </View>
        ))}
      </View>
      {item.context ? (
        <View style={{ marginTop: 12, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 10 }}>
          <Text style={[localStyles.subPartHeader, { color: '#f59e0b', fontSize: 11 * zoomScale, marginBottom: 4 }]}>EXPLANATION & EXAMPLES</Text>
          <Markdown style={subPartBodyMarkdownStyle}>{cleanMarkdownContent(item.context)}</Markdown>
        </View>
      ) : null}
    </View>
  );
}

const localStyles = StyleSheet.create({
  mnemonicKeywordRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  mnemonicLabel: {
    fontWeight: '800',
    color: '#f59e0b',
    marginRight: 6,
    letterSpacing: 0.5,
  },
  mnemonicValue: {
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subPartHeader: {
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  expansionList: {
    gap: 8,
  },
  expansionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  letterWrapper: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  letterText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  exMeaning: {
    fontWeight: '700',
  },
});
