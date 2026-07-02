import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { cleanMarkdownContent, getMarkdownStyles } from '../../../app/mains';

interface MarkdownSection {
  heading: string;
  content: string;
}

const parseMarkdownToSections = (text: string | undefined | null): MarkdownSection[] => {
  if (!text) return [];
  const sections: MarkdownSection[] = [];
  const regex = /(?:^|\n)(?:\*\s*)?\*\*([^*]+?):\*\*/g;
  
  let match;
  let lastIndex = 0;
  let currentHeading = '';
  
  while ((match = regex.exec(text)) !== null) {
    if (lastIndex > 0 || currentHeading) {
      const content = text.slice(lastIndex, match.index).trim();
      if (content || currentHeading) {
        sections.push({ heading: currentHeading || 'General', content });
      }
    }
    currentHeading = match[1].trim();
    lastIndex = regex.lastIndex;
  }
  
  const content = text.slice(lastIndex).trim();
  if (content || currentHeading) {
    sections.push({ heading: currentHeading || 'General', content });
  }
  
  return sections;
};

const getThemeForHeading = (heading: string) => {
  const h = heading.toLowerCase();
  if (h.includes('quote')) {
    return {
      textColor: '#d97706',
      bgColor: 'rgba(251, 191, 36, 0.08)',
      borderColor: '#fef3c7',
      label: 'QUOTE'
    };
  }
  if (h.includes('intro') || h.includes('concept')) {
    return {
      textColor: '#1d4ed8',
      bgColor: 'rgba(59, 130, 246, 0.08)',
      borderColor: '#dbeafe',
      label: 'INTRODUCTION'
    };
  }
  if (h.includes('example') || h.includes('practice') || h.includes('case study') || h.includes('case studies')) {
    return {
      textColor: '#7c3aed',
      bgColor: 'rgba(139, 92, 246, 0.08)',
      borderColor: '#ddd6fe',
      label: 'EXAMPLES / CASE STUDIES'
    };
  }
  if (h.includes('conclusion') || h.includes('way forward')) {
    return {
      textColor: '#047857',
      bgColor: 'rgba(16, 185, 129, 0.08)',
      borderColor: '#d1fae5',
      label: 'CONCLUSION'
    };
  }
  if (h.includes('data') || h.includes('fact')) {
    return {
      textColor: '#0d9488',
      bgColor: 'rgba(20, 184, 166, 0.08)',
      borderColor: '#ccfbf1',
      label: 'DATA & FACTS'
    };
  }
  return {
    textColor: '#475569',
    bgColor: 'rgba(100, 116, 139, 0.08)',
    borderColor: '#e2e8f0',
    label: heading.toUpperCase()
  };
};

const hasNumberedPrefix = (element: any): boolean => {
  if (!element) return false;
  if (typeof element === 'string') {
    return /^\s*(?:\d+|[a-zA-Z])[\.\)]\s/.test(element);
  }
  if (typeof element === 'object') {
    if (element.props && element.props.children) {
      if (Array.isArray(element.props.children)) {
        return element.props.children.some((child: any) => hasNumberedPrefix(child));
      }
      return hasNumberedPrefix(element.props.children);
    }
    if (Array.isArray(element)) {
      return element.some((child: any) => hasNumberedPrefix(child));
    }
  }
  return false;
};

const introConclusionMarkdownRules = {
  blockquote: (node: any, children: any, parent: any, styles: any) => {
    return (
      <View key={node.key} style={localStyles.goldBlockquote}>
        {children}
      </View>
    );
  },
  list_item: (node: any, children: any, parent: any, styles: any, inheritedStyles = {}) => {
    const bulletListDepth = Array.isArray(parent) 
      ? parent.filter((el: any) => el.type === 'bullet_list').length 
      : 1;

    let bulletIcon = '\u2022'; // level 1: filled circle
    if (bulletListDepth === 2) {
      bulletIcon = '\u25E6'; // level 2: hollow circle
    } else if (bulletListDepth >= 3) {
      bulletIcon = '\u25AA'; // level 3: small square
    }

    const refStyle = {
      ...inheritedStyles,
      ...StyleSheet.flatten(styles.list_item),
    };

    const textStyleProps = [
      'color', 'fontSize', 'fontStyle', 'fontWeight', 'lineHeight', 
      'textAlign', 'textDecorationLine', 'textShadowColor', 
      'textShadowOffset', 'textShadowRadius', 'fontFamily'
    ];
    
    const modifiedInheritedStylesObj: any = {};
    for (const key of Object.keys(refStyle)) {
      if (textStyleProps.includes(key)) {
        modifiedInheritedStylesObj[key] = refStyle[key];
      }
    }

    const hasParents = (parentArray: any, type: string) => {
      return Array.isArray(parentArray) && parentArray.some((el: any) => el.type === type);
    };

    if (hasParents(parent, 'bullet_list')) {
      const hasNumber = hasNumberedPrefix(children);
      return (
        <View key={node.key} style={styles._VIEW_SAFE_list_item}>
          {!hasNumber && (
            <Text
              style={[
                modifiedInheritedStylesObj, 
                styles.bullet_list_icon,
                { marginRight: 8, fontSize: bulletListDepth === 2 ? 14 : 12 }
              ]}
              accessible={false}
            >
              {bulletIcon}
            </Text>
          )}
          <View style={styles._VIEW_SAFE_bullet_list_content}>{children}</View>
        </View>
      );
    }

    if (hasParents(parent, 'ordered_list')) {
      const orderedListIndex = parent.findIndex((el: any) => el.type === 'ordered_list');
      const orderedList = parent[orderedListIndex];
      let listItemNumber = node.index + 1;
      if (orderedList?.attributes?.start) {
        listItemNumber = orderedList.attributes.start + node.index;
      }
      return (
        <View key={node.key} style={styles._VIEW_SAFE_list_item}>
          <Text style={[modifiedInheritedStylesObj, styles.ordered_list_icon]}>
            {listItemNumber}
            {node.markup}
          </Text>
          <View style={styles._VIEW_SAFE_ordered_list_content}>{children}</View>
        </View>
      );
    }

    return (
      <View key={node.key} style={styles._VIEW_SAFE_list_item}>
        {children}
      </View>
    );
  }
};

export default function MainsIntroConclusionCard({
  item,
  colors,
  templateFilter,
  zoomScale
}: {
  item: any;
  colors: any;
  templateFilter: string;
  zoomScale: number;
}) {
  const quoteTextMarkdownStyle = {
    ...getMarkdownStyles(colors),
    body: {
      color: '#d97706',
      fontSize: 13 * zoomScale,
      lineHeight: 18 * zoomScale,
      fontWeight: '600',
      fontStyle: 'italic' as const,
    },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: '#d97706',
      paddingLeft: 12,
      marginVertical: 4,
      backgroundColor: 'rgba(251, 191, 36, 0.04)',
    }
  };

  const subPartBodyMarkdownStyle = {
    ...getMarkdownStyles(colors),
    body: {
      color: colors.textSecondary,
      fontSize: 13 * zoomScale,
      lineHeight: 18 * zoomScale,
      fontWeight: '600',
    }
  };

  let sections = parseMarkdownToSections(item.introduction || '');

  return (
    <View style={{ gap: 12 }}>
      {sections.map((sec, sIdx) => {
        const theme = getThemeForHeading(sec.heading);
        const isQuote = sec.heading.toLowerCase().includes('quote');
        
        return (
          <View key={`sec-${sIdx}`} style={[localStyles.templateBox, { backgroundColor: theme.bgColor, borderColor: theme.borderColor }]}>
            <Text style={[localStyles.subPartHeader, { color: theme.textColor, fontSize: 11 * zoomScale }]}>{theme.label}</Text>
            {isQuote ? (
              <Markdown style={quoteTextMarkdownStyle} rules={introConclusionMarkdownRules}>
                {cleanMarkdownContent(sec.content)}
              </Markdown>
            ) : (
              <Markdown style={subPartBodyMarkdownStyle} rules={introConclusionMarkdownRules}>
                {cleanMarkdownContent(sec.content)}
              </Markdown>
            )}
          </View>
        );
      })}
    </View>
  );
}

const localStyles = StyleSheet.create({
  templateBox: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
  },
  subPartHeader: {
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  goldBlockquote: {
    borderLeftWidth: 3,
    borderLeftColor: '#d97706',
    paddingLeft: 12,
    marginVertical: 4,
    backgroundColor: 'rgba(251, 191, 36, 0.04)',
  },
  _VIEW_SAFE_list_item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
  },
  bullet_list_icon: {
    width: 14,
    textAlign: 'center',
  },
  _VIEW_SAFE_bullet_list_content: {
    flex: 1,
  },
  ordered_list_icon: {
    marginRight: 6,
    fontWeight: '700',
    fontSize: 12,
  },
  _VIEW_SAFE_ordered_list_content: {
    flex: 1,
  },
});
