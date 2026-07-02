import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { cleanMarkdownContent, getMarkdownStyles, getDiagramUri } from '../../../app/mains';

export default function MainsEthicsCard({
  item,
  colors,
  ethicsTab,
  zoomScale
}: {
  item: any;
  colors: any;
  ethicsTab: string;
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

  const comparePointsMarkdownStyle = {
    ...getMarkdownStyles(colors),
    body: {
      color: colors.textSecondary,
      fontSize: 12 * zoomScale,
      lineHeight: 16 * zoomScale,
      fontWeight: '600',
      marginLeft: 8,
    }
  };

  const type = ethicsTab 
    ? (ethicsTab === 'diagrams' ? 'diagram' :
       ethicsTab === 'dimensions' ? 'dimension' :
       ethicsTab === 'comparisons' ? 'comparison' :
       ethicsTab === 'innovations' ? 'innovation' :
       ethicsTab === 'pyq_quotes' ? 'pyq_quote' :
       ethicsTab === 'keywords' ? 'keyword' : ethicsTab)
    : item.ethicsType;

  return (
    <View style={{ gap: 8 }}>
      {(type === 'diagram' || type === 'diagrams') && (
        <View style={[localStyles.templateBox, { backgroundColor: '#0f172acc', borderColor: '#334155' }]}>
          {item.diagramImagePath && (
            <View style={{ marginVertical: 8, borderRadius: 8, overflow: 'hidden', backgroundColor: '#1e293b', padding: 6, borderColor: '#475569', borderWidth: 1 }}>
              <Image
                source={{ uri: getDiagramUri(item.diagramImagePath) }}
                style={{ width: '100%', height: 200 }}
                resizeMode="contain"
              />
            </View>
          )}
          <Text style={[localStyles.subPartBody, { color: '#ffffff', fontFamily: 'monospace', fontSize: 13 * zoomScale }]}>
            {item.ethicsData?.diagramDescription}
          </Text>
          <Text style={[localStyles.diagLabel, { fontSize: 11 * zoomScale }]}>Diagram Type: {item.ethicsData?.diagramType}</Text>
        </View>
      )}
      {(type === 'dimension' || type === 'dimensions') && (
        <View style={{ gap: 6 }}>
          {item.ethicsData?.dimensionsList?.map((dim: string, i: number) => (
            <Markdown key={i} style={subPartBodyMarkdownStyle}>{cleanMarkdownContent(dim)}</Markdown>
          ))}
        </View>
      )}
      {(type === 'comparison' || type === 'comparisons') && (
        <View style={{ gap: 10 }}>
          {item.ethicsData?.comparisonPoints?.map((cp: any, i: number) => (
            <View key={i} style={[localStyles.compareRow, { borderBottomColor: colors.border }]}>
              <Text style={[localStyles.compareCriteria, { color: '#06b6d4', fontSize: 13 * zoomScale }]}>{cp.criteria}</Text>
              <Markdown style={comparePointsMarkdownStyle}>{cleanMarkdownContent(cp.termA)}</Markdown>
              <Markdown style={comparePointsMarkdownStyle}>{cleanMarkdownContent(cp.termB)}</Markdown>
            </View>
          ))}
        </View>
      )}
      {(type === 'innovation' || type === 'innovations') && (
        <View style={[localStyles.templateBox, { backgroundColor: '#ecfeff33', borderColor: '#a5f3fc', gap: 6 }]}>
          <Text style={[localStyles.ethicsOfficer, { color: colors.textPrimary, fontSize: 14 * zoomScale }]}>{item.ethicsData?.officerName}</Text>
          <Markdown style={subPartBodyMarkdownStyle}>{"Initiative: " + cleanMarkdownContent(item.ethicsData?.initiative)}</Markdown>
          <Markdown style={subPartBodyMarkdownStyle}>{"Impact: " + cleanMarkdownContent(item.ethicsData?.impact)}</Markdown>
          <Text style={[localStyles.ethicsValues, { color: colors.textSecondary, fontSize: 11 * zoomScale }]}>Values: {item.ethicsData?.values}</Text>
        </View>
      )}
      {(type === 'pyq_quote' || type === 'pyq_quotes') && (
        <View style={[localStyles.templateBox, { backgroundColor: '#f0fdf433', borderColor: '#bbf7d0', gap: 4 }]}>
          <Markdown style={subPartBodyMarkdownStyle}>{cleanMarkdownContent(item.ethicsData?.keywordDefinition)}</Markdown>
          {item.ethicsData?.keywordExample && (
            <Markdown style={subPartBodyMarkdownStyle}>{cleanMarkdownContent(item.ethicsData?.keywordExample)}</Markdown>
          )}
        </View>
      )}
      {(type === 'keyword' || type === 'keywords') && (
        <View style={[localStyles.templateBox, { backgroundColor: '#fff7ed33', borderColor: '#ffedd5', gap: 4 }]}>
          <Markdown style={subPartBodyMarkdownStyle}>{cleanMarkdownContent(item.ethicsData?.keywordDefinition)}</Markdown>
          {item.ethicsData?.keywordExample && (
            <Markdown style={subPartBodyMarkdownStyle}>{cleanMarkdownContent(item.ethicsData?.keywordExample)}</Markdown>
          )}
        </View>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  templateBox: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
  },
  subPartBody: {
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 4,
  },
  diagLabel: {
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: 8,
  },
  compareRow: {
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 4,
  },
  compareCriteria: {
    fontWeight: '900',
    marginBottom: 4,
  },
  ethicsOfficer: {
    fontWeight: '800',
  },
  ethicsValues: {
    fontWeight: '700',
    marginTop: 4,
  },
});
