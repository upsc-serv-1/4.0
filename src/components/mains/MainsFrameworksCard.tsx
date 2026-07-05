import React, { useMemo } from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { cleanMarkdownContent, getMarkdownStyles, getDiagramUri, getMarkdownRules } from '../../../app/mains';

/**
 * Splits framework markdown into:
 * - diagramContent: everything before "Framework Breakdown" (diagram image and labels)
 * - breakdownContent: the list of framework points starting from "Framework Breakdown" or list items
 */
const parseFrameworkMarkdown = (text: string): { diagramContent: string; breakdownContent: string } => {
  if (!text) return { diagramContent: '', breakdownContent: '' };
  
  // Clean duplicate leading heading (e.g. "## SHIELD Framework: Way Forward")
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^#+\s+.*?(?:\r?\n)+/i, '');

  // Look for "### Framework Breakdown" or "## Framework Breakdown"
  const breakdownHeaderIndex = cleaned.search(/#+\s+Framework\s+Breakdown/i);
  if (breakdownHeaderIndex !== -1) {
    const diagramContent = cleaned.substring(0, breakdownHeaderIndex).trim();
    const breakdownContent = cleaned.substring(breakdownHeaderIndex).trim();
    return { diagramContent, breakdownContent };
  }

  // Fallback: check if there is a list block starting with "- **" or "* **"
  const listStartIndex = cleaned.search(/(?:^|\n)[-*]\s*\*\*/);
  if (listStartIndex !== -1) {
    const diagramContent = cleaned.substring(0, listStartIndex).trim();
    const breakdownContent = cleaned.substring(listStartIndex).trim();
    return { diagramContent, breakdownContent };
  }

  return { diagramContent: '', breakdownContent: cleaned };
};

export default function MainsFrameworksCard({
  item,
  colors,
  zoomScale,
  onImagePress
}: {
  item: any;
  colors: any;
  zoomScale: number;
  onImagePress?: (uri: string) => void;
}) {
  const markdownStyles = getMarkdownStyles(colors);

  // Styled body for the list inside the box
  const subPartBodyMarkdownStyle = {
    ...markdownStyles,
    body: {
      color: colors.textSecondary,
      fontSize: 13 * zoomScale,
      lineHeight: 20 * zoomScale,
      fontWeight: '500' as const,
    },
    // Keep list items styled nicely
    bullet_list: {
      marginVertical: 4,
    },
    list_item: {
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
      marginVertical: 4,
    },
  };

  const rawContent = item.frameworkGuide || item.rawContent || '';
  const { diagramContent, breakdownContent } = parseFrameworkMarkdown(rawContent);
  const cleanDiagram = item.diagramImagePath
    ? diagramContent.replace(/!\[.*?\]\(.*?\)/g, '').trim()
    : diagramContent;

  const dynamicRules = useMemo(() => {
    return getMarkdownRules(colors, colors.isDark || false, onImagePress);
  }, [colors, onImagePress]);

  return (
    <View style={{ gap: 10 }}>
      {/* If the DB has a diagramImagePath, show it at the top */}
      {item.diagramImagePath ? (
        <TouchableOpacity 
          activeOpacity={0.9}
          onPress={() => onImagePress?.(getDiagramUri(item.diagramImagePath))}
          style={[localStyles.imageContainer, { borderColor: colors.border }]}
        >
          <Image
            source={{ uri: getDiagramUri(item.diagramImagePath) }}
            style={{ width: '100%', height: 220 }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      ) : null}

      {/* Render diagram content preamble */}
      {cleanDiagram ? (
        <Markdown style={markdownStyles} rules={dynamicRules}>
          {cleanMarkdownContent(cleanDiagram)}
        </Markdown>
      ) : null}

      {/* Render the ENTIRE breakdown list inside one single styled box */}
      {breakdownContent ? (
        <View
          style={[
            localStyles.fwBox,
            { 
              borderColor: colors.border, 
              backgroundColor: colors.surfaceStrong || (colors.isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc') 
            },
          ]}
        >
          <Markdown style={subPartBodyMarkdownStyle} rules={dynamicRules}>
            {cleanMarkdownContent(breakdownContent)}
          </Markdown>
        </View>
      ) : null}
    </View>
  );
}

const localStyles = StyleSheet.create({
  imageContainer: {
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 6,
    borderWidth: 1,
  },
  fwBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
  },
});
