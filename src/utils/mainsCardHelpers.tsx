import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Markdown from 'react-native-markdown-display';
import { Sparkles, Layers } from 'lucide-react-native';

// ── Global Display / Reading Preferences State ──
export type KeyBoxColor = 'yellow' | 'green' | 'blue' | 'pink';

export let globalTextColorMode: 'default' | 'black' = 'default';
export const setGlobalTextColorMode = (mode: 'default' | 'black') => {
  globalTextColorMode = mode;
};
export const getGlobalTextColorMode = () => globalTextColorMode;

export let globalKeyBoxMode: 'boxed' | 'bold' = 'boxed';
export const setGlobalKeyBoxMode = (mode: 'boxed' | 'bold') => {
  globalKeyBoxMode = mode;
};
export const getGlobalKeyBoxMode = () => globalKeyBoxMode;

export let globalKeyBoxColor: KeyBoxColor = 'blue';
export const setGlobalKeyBoxColor = (color: KeyBoxColor) => {
  globalKeyBoxColor = color;
};
export const getGlobalKeyBoxColor = () => globalKeyBoxColor;

// ── Markdown Cleaners and Pre-processors ──
export const replaceBrInChildren = (children: any): any => {
  if (!children) return children;
  
  if (typeof children === 'string') {
    return children.replace(/<br\s*\/?>|&lt;br\s*\/?&gt;|&amp;lt;br\s*\/?&amp;gt;/gi, '\n');
  }
  
  if (Array.isArray(children)) {
    return children.map(child => replaceBrInChildren(child));
  }
  
  if (React.isValidElement(children)) {
    const element = children as React.ReactElement<any>;
    if (element.props && element.props.children !== undefined) {
      return React.cloneElement(element, {
        ...element.props,
        children: replaceBrInChildren(element.props.children)
      });
    }
  }
  
  return children;
};

export const preProcessMarkdownTables = (text: string): string => {
  if (!text) return '';
  const lines = text.split(/\r?\n/);
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();

    // Detect table row: starts with | (or separator like |---|)
    const isTableRow =
      trimmed.startsWith('|') ||
      (i > 0 && result[result.length - 1]?.trim().startsWith('|') && trimmed.includes('|'));

    if (isTableRow) {
      // Strip ALL <br> tags in this line → replace with a single space
      line = line.replace(/<br\s*\/?>/gi, ' ');

      // If the row doesn't close with |, merge subsequent continuation lines
      if (!line.trim().endsWith('|')) {
        while (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          const nextTrimmed = nextLine.trim();

          // Stop at a separator row or a row that is already complete
          if (
            nextTrimmed.startsWith('|') &&
            (nextTrimmed.match(/^\|[\s\-:]+\|/) || nextTrimmed.endsWith('|'))
          ) {
            break;
          }

          const cleanedNext = nextTrimmed.replace(/<br\s*\/?>/gi, ' ');
          line = line.trimEnd() + ' ' + cleanedNext;
          i++;

          if (cleanedNext.endsWith('|')) break;
        }
      }
    }

    result.push(line);
  }
  return result.join('\n');
};

export const cleanMarkdownContent = (text: string | undefined | null, keyBoxMode: 'boxed' | 'bold' = globalKeyBoxMode): string => {
  if (!text) return '';
  let cleaned = preProcessMarkdownTables(text);

  // 0. Normalize leading non-breaking spaces to regular spaces.
  cleaned = cleaned.replace(/^[ \t\xa0]+/gm, (match) => {
    return match.replace(/\xa0/g, ' ');
  });

  // 1. Normalize custom bullets (•, ◦, –) to standard markdown dash (-) so markdown-it parses them as native lists.
  cleaned = cleaned.replace(/^([ \t\xa0]*)([\u2022\u25e6\u2013])\s+/gm, (match, spaces, bullet) => {
    return spaces + '- ';
  });

  // 2. Fix `<br>` tags that break lists. If a list item follows one or more <br> tags, they must be converted to \n\n to parse as a list.
  cleaned = cleaned.replace(/(?:<br\s*\/?>[\r\n\s]*?)+([ \t\xa0]*)([*+\-]|\d+\.)\s+/gi, (match, spaces, bullet) => {
    return '\n\n' + spaces + bullet + ' ';
  });

  // 3. Space Scaler: Fix 4+ space indented code block triggers.
  cleaned = cleaned.replace(/^([ \t]{4,})([*+\-]|\d+\.) /gm, (match, spaces, bullet) => {
    const spaceCount = spaces.replace(/\t/g, '    ').length;
    const newSpacesCount = Math.floor(spaceCount * 0.75);
    return ' '.repeat(newSpacesCount) + bullet + ' ';
  });

  // Convert HTML img tags to Markdown image syntax (react-native-markdown-display compatible)
  cleaned = cleaned.replace(/<img([\s\S]*?)src=["']([^"']+)["']([\s\S]*?)\/?>/gi, (match, before, src, after) => {
    const altMatch = /alt=["']([^"']+)["']/i.exec(before) || /alt=["']([^"']+)["']/i.exec(after);
    const alt = altMatch ? altMatch[1] : 'Diagram';
    return `\n\n![${alt}](${src})\n\n`;
  });

  // Strip align wrappers around standard markdown/converted markdown images
  cleaned = cleaned.replace(/<p\s+align=["']center["']>\s*(!\[[^\]]*\]\([^)]+\))\s*<\/p>/gi, '\n\n$1\n\n');
  cleaned = cleaned.replace(/<p[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/p>/gi, '\n');

  // Strip leading empty bullet points
  cleaned = cleaned.replace(/^\s*[-*•]\s*$/gm, '');

  // Replace <mark class="key-box"> and <mark> tags cleanly
  if (cleaned) {
    if (keyBoxMode === 'bold') {
      cleaned = cleaned.replace(/<mark[^>]*>(.*?)<\/mark>/gi, '**$1**');
    } else {
      cleaned = cleaned.replace(/<mark[^>]*>(.*?)<\/mark>/gi, '`$1`');
      cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '`$1`');
      cleaned = cleaned.replace(/__(.*?)__/g, '`$1`');
    }
  }

  // Prevent (c). or (C). from being converted into copyright symbol ©
  cleaned = cleaned.replace(/\(c\)\./gi, '(c\u200B).');
  cleaned = cleaned.replace(/\(c\)\s/gi, '(c\u200B) ');

  // Replace HTML entities
  cleaned = cleaned.replace(/&nbsp;/gi, ' ');
  cleaned = cleaned.replace(/&rarr;/gi, '→');
  cleaned = cleaned.replace(/&rupee;/gi, '₹');
  cleaned = cleaned.replace(/&amp;/gi, '&');
  cleaned = cleaned.replace(/&lt;/gi, '<');
  cleaned = cleaned.replace(/&gt;/gi, '>');
  cleaned = cleaned.replace(/&quot;/gi, '"');
  cleaned = cleaned.replace(/&#39;/gi, "'");

  // Replace br tags
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');

  // Replace bold tags
  cleaned = cleaned.replace(/<\/?b>/gi, '**');
  cleaned = cleaned.replace(/<\/?strong>/gi, '**');

  // Replace underline/italic tags
  cleaned = cleaned.replace(/<\/?u>/gi, '');
  cleaned = cleaned.replace(/<\/?i>/gi, '*');
  cleaned = cleaned.replace(/<\/?em>/gi, '*');

  // Normalize consecutive asterisks
  cleaned = cleaned.replace(/\*{3,}/g, '**');

  // Normalize excessive tabs/spaces
  cleaned = cleaned.replace(/^\t+/gm, (match) => '  '.repeat(match.length));

  // Automatically format section markers into distinct H3 headings
  cleaned = cleaned.replace(/(?:^|\n)\s*(?:###?\s*)?\*{0,2}ANSWER\*{0,2}\s*[:\-]?\s*/gi, '\n\n### **ANSWER**\n\n');
  cleaned = cleaned.replace(/(?:^|\n)\s*(?:###?\s*)?\*{0,2}Conclusion\*{0,2}\s*[:\-]?\s*/gi, '\n\n### **Conclusion**\n\n');
  cleaned = cleaned.replace(/(?:^|\n)\s*(?:###?\s*)?\*{0,2}Aspects to Take into Account\*{0,2}\s*[:\-]?\s*/gi, '\n\n### **Aspects to Take into Account**\n\n');
  cleaned = cleaned.replace(/(?:^|\n)\s*(?:###?\s*)?\*{0,2}Structure to Follow\*{0,2}\s*[:\-]?\s*/gi, '\n\n### **Structure to Follow**\n\n');
  cleaned = cleaned.replace(/(?:^|\n)\s*(?:###?\s*)?\*{0,2}Don'?ts\*{0,2}\s*[:\-]?\s*/gi, '\n\n### **Don\'ts**\n\n');

  return cleaned.trim();
};

export const cleanMarkdown = (text: string, keyBoxMode: 'boxed' | 'bold' = globalKeyBoxMode) => {
  if (!text) return '';
  const r2BaseUrl = 'https://pub-cfb8b9095d7d4914990dbb6f73afeb92.r2.dev';
  
  let cleaned = cleanMarkdownContent(text, keyBoxMode);
  
  // Replace relative Markdown images to point to R2 Bucket
  cleaned = cleaned.replace(/!\[(.*?)\]\(((?!https?:\/\/|data:)[^\)]+)\)/gi, (match, alt, path) => {
    let cleanPath = path.trim();
    if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.substring(1);
    }
    return `![${alt}](${r2BaseUrl}/${cleanPath})`;
  });

  return cleaned;
};

// ── Markdown Display Rules & Styles ──
export const getMarkdownRules = (colors: any, isDark: boolean, onImagePress?: (uri: string) => void) => ({
  table: (node: any, children: any) => {
    return (
      <View
        key={node.key}
        style={{
          marginVertical: 10,
          borderWidth: 1,
          borderColor: isDark ? '#374151' : '#d1d5db',
          borderRadius: 6,
          overflow: 'hidden',
          width: '100%',
        }}
      >
        {children}
      </View>
    );
  },
  thead: (node: any, children: any) => (
    <View key={node.key} style={{ backgroundColor: isDark ? '#1e2a3a' : '#f0f4ff' }}>
      {children}
    </View>
  ),
  tbody: (node: any, children: any) => (
    <View key={node.key}>{children}</View>
  ),
  th: (node: any, children: any) => (
    <View
      key={node.key}
      style={{
        flex: 1,
        padding: 10,
        borderRightWidth: 1,
        borderColor: isDark ? '#374151' : '#d1d5db',
        justifyContent: 'flex-start',
      }}
    >
      {replaceBrInChildren(children)}
    </View>
  ),
  td: (node: any, children: any) => (
    <View
      key={node.key}
      style={{
        flex: 1,
        padding: 10,
        borderRightWidth: 1,
        borderColor: isDark ? '#374151' : '#d1d5db',
        justifyContent: 'flex-start',
      }}
    >
      {replaceBrInChildren(children)}
    </View>
  ),
  tr: (node: any, children: any) => (
    <View
      key={node.key}
      style={{
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderColor: isDark ? '#374151' : '#d1d5db',
        width: '100%',
      }}
    >
      {children}
    </View>
  ),
  image: (node: any) => {
    const src = node.attributes?.src || '';
    if (!src) return null;
    return (
      <TouchableOpacity
        key={node.key}
        activeOpacity={0.9}
        onPress={() => onImagePress?.(src)}
        style={{ width: '100%', alignItems: 'center', marginVertical: 12 }}
      >
        <ExpoImage
          source={{ uri: src }}
          style={{ width: '100%', height: Dimensions.get('window').width >= 768 ? 320 : 220 }}
          contentFit="contain"
          transition={200}
          allowDownscaling={false}
        />
      </TouchableOpacity>
    );
  },
  mark: (node: any, children: any) => (
    <View
      key={node.key}
      style={{
        backgroundColor: isDark ? 'rgba(234, 179, 8, 0.25)' : '#fef08a',
        borderWidth: 1,
        borderColor: isDark ? '#eab308' : '#ca8a04',
        borderRadius: 3,
        paddingHorizontal: 4,
        paddingVertical: 1,
        marginHorizontal: 2,
        alignSelf: 'inline',
        display: 'inline-flex'
      } as any}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#fef08a' : '#854d0e' }}>
        {children}
      </Text>
    </View>
  ),
  html_inline: (node: any) => {
    const raw: string = node.content || '';
    if (/^(?:<|&lt;|&amp;lt;)br\s*(?:\/|&gt;|\/&gt;|&amp;gt;|\/&amp;gt;)?/i.test(raw.trim())) {
      return <Text key={node.key}>{"\n"}</Text>;
    }
    return <Text key={node.key}>{raw.replace(/<[^>]*>/g, '')}</Text>;
  },
  html_block: (node: any) => {
    return null;
  },
  text: (node: any, children: any, parentNodes: any, styles: any, inheritedStyles: any = {}) => {
    const rawContent = node.content || '';
    const cleaned = rawContent.replace(/<br\s*\/?>|&lt;br\s*\/?&gt;|&amp;lt;br\s*\/?&amp;gt;/gi, '\n');
    return (
      <Text key={node.key} style={[inheritedStyles, styles.text]}>
        {cleaned}
      </Text>
    );
  },
  bullet_list: (node: any, children: any) => (
    <View key={node.key} style={{ marginVertical: 3 }}>
      {children}
    </View>
  ),
  ordered_list: (node: any, children: any) => (
    <View key={node.key} style={{ marginVertical: 3 }}>
      {children}
    </View>
  ),
  list_item: (node: any, children: any, parentNodes: any = []) => {
    const listParents = (parentNodes || []).filter((n: any) => n && (n.type === 'bullet_list' || n.type === 'ordered_list'));
    const depth = Math.max(1, listParents.length);
    const lastParent = listParents[0];
    const isOrdered = lastParent?.type === 'ordered_list';

    const indent = 12 + (depth - 1) * 16;
    const textColor = colors.textPrimary || (isDark ? '#f3f4f6' : '#111827');

    if (isOrdered) {
      let startOffset = 1;
      if (lastParent?.attributes?.start) {
        const parsedStart = parseInt(lastParent.attributes.start, 10);
        if (!isNaN(parsedStart)) {
          startOffset = parsedStart;
        }
      }
      const index = node.index !== undefined ? node.index + startOffset : startOffset;
      return (
        <View key={node.key} style={{ flexDirection: 'row', alignItems: 'flex-start', marginVertical: 2.5, marginLeft: indent }}>
          <Text style={{ width: 24, fontSize: 13.5, lineHeight: 21, fontWeight: '700', color: textColor }}>
            {index}.
          </Text>
          <View style={{ flex: 1 }}>{children}</View>
        </View>
      );
    }

    const bulletSymbols = ['•', '›', '◦', '–'];
    const bulletSymbol = bulletSymbols[Math.min(depth - 1, bulletSymbols.length - 1)];

    return (
      <View key={node.key} style={{ flexDirection: 'row', alignItems: 'flex-start', marginVertical: 2.5, marginLeft: indent }}>
        <Text style={{ width: 18, fontSize: depth === 2 ? 14 : 11, lineHeight: 21, fontWeight: depth === 1 ? '900' : '700', color: textColor, textAlign: 'center' }}>
          {bulletSymbol}
        </Text>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  },
  blockquote: (node: any, children: any) => {
    const getNodeText = (n: any): string => {
      if (!n) return '';
      if (typeof n === 'string') return n;
      if (typeof n === 'number') return String(n);
      if (n.content) return String(n.content);
      if (Array.isArray(n.children)) return n.children.map(getNodeText).join(' ');
      return '';
    };

    const textContent = getNodeText(node);
    const isAbbr = /^\s*(?:\*\*)?\s*Abbreviations\s*:?/i.test(textContent);
    const isExtra = /^\s*(?:\*\*)?\s*Extra\s*marks\s*:?/i.test(textContent);

    if (isAbbr) {
      return (
        <View
          key={node.key}
          style={{
            backgroundColor: isDark ? 'rgba(99, 102, 241, 0.12)' : '#f0f3ff',
            borderColor: isDark ? '#6366f1' : '#a5b4fc',
            borderWidth: 1,
            borderRadius: 10,
            padding: 12,
            marginVertical: 10,
          }}
        >
          {children}
        </View>
      );
    }

    if (isExtra) {
      return (
        <View
          key={node.key}
          style={{
            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
            borderColor: isDark ? '#10b981' : '#6ee7b7',
            borderWidth: 1,
            borderRadius: 10,
            padding: 12,
            marginVertical: 10,
          }}
        >
          {children}
        </View>
      );
    }

    return (
      <View
        key={node.key}
        style={{
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
          borderLeftWidth: 4,
          borderLeftColor: colors.primary || '#3b82f6',
          paddingHorizontal: 12,
          paddingVertical: 8,
          marginVertical: 8,
          borderRadius: 4,
        }}
      >
        {children}
      </View>
    );
  },
});

export const markdownRules = getMarkdownRules({ border: '#d1d5db' }, false);

export const getMarkdownStyles = (
  colors: any,
  textColorMode: 'default' | 'black' = globalTextColorMode,
  keyBoxColor: KeyBoxColor = globalKeyBoxColor
): any => {
  const isDark = colors.textPrimary && (
    colors.textPrimary.toLowerCase().startsWith('#f') || 
    colors.textPrimary.toLowerCase().startsWith('#e') || 
    colors.textPrimary.toLowerCase().startsWith('#d') ||
    colors.textPrimary === 'white'
  );
  const headingColor = isDark ? '#60a5fa' : '#1d4ed8';

  const baseTextColor = textColorMode === 'black' 
    ? (isDark ? '#ffffff' : '#000000') 
    : colors.textSecondary;
  const strongTextColor = textColorMode === 'black'
    ? (isDark ? '#ffffff' : '#000000')
    : colors.textPrimary;

  // KeyBox theme styles
  let codeBg = '#fef08a';
  let codeBorder = '#eab308';
  let codeText = '#854d0e';

  if (keyBoxColor === 'blue') {
    codeBg = isDark ? 'rgba(59, 130, 246, 0.25)' : '#eff6ff';
    codeBorder = isDark ? '#3b82f6' : '#93c5fd';
    codeText = isDark ? '#bfdbfe' : '#1e40af';
  } else if (keyBoxColor === 'green') {
    codeBg = isDark ? 'rgba(34, 197, 94, 0.25)' : '#f0fdf4';
    codeBorder = isDark ? '#22c55e' : '#86efac';
    codeText = isDark ? '#bbf7d0' : '#15803d';
  } else if (keyBoxColor === 'pink') {
    codeBg = isDark ? 'rgba(244, 63, 94, 0.25)' : '#fff1f2';
    codeBorder = isDark ? '#f43f5e' : '#fda4af';
    codeText = isDark ? '#fecdd3' : '#be123c';
  } else {
    codeBg = isDark ? 'rgba(234, 179, 8, 0.25)' : '#fef9c3';
    codeBorder = isDark ? '#eab308' : '#fde047';
    codeText = isDark ? '#fef08a' : '#854d0e';
  }

  return {
    body: {
      color: baseTextColor,
      fontSize: 14.5,
      lineHeight: 22,
    },
    heading1: {
      color: headingColor,
      fontSize: 18,
      fontWeight: '800',
      marginTop: 18,
      marginBottom: 8,
    },
    heading2: {
      color: headingColor,
      fontSize: 16,
      fontWeight: '800',
      marginTop: 16,
      marginBottom: 6,
    },
    heading3: {
      color: headingColor,
      fontSize: 15,
      fontWeight: '800',
      marginTop: 14,
      marginBottom: 6,
    },
    heading4: {
      color: headingColor,
      fontSize: 14,
      fontWeight: '800',
      marginTop: 12,
      marginBottom: 4,
    },
    strong: {
      fontWeight: '800',
      color: strongTextColor,
    },
    em: {
      fontStyle: 'italic',
      color: baseTextColor,
    },
    link: {
      color: colors.primary || '#3b82f6',
      textDecorationLine: 'underline',
    },
    code_inline: {
      backgroundColor: codeBg,
      borderColor: codeBorder,
      borderWidth: 1,
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
      fontSize: 13,
      fontWeight: '700',
      color: codeText,
    },
    fence: {
      backgroundColor: isDark ? '#1e293b' : '#f8fafc',
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      marginVertical: 8,
    },
  };
};

// ── Introductory Approach Box Parser ──
export const parseIntroductoryBox = (rawText: string | undefined | null) => {
  if (!rawText) return null;

  // 1. Markdown Table format check
  const tableRegex = /^\s*(?:(?:#{1,4}\s*)?(?:\*\*|__)?\s*ANSWER\s*(?:\*\*|__)?\s*\n\s*)?(\|[^\n]+\|(?:\r?\n\|[^\n]+\|)*)/i;
  const match = rawText.match(tableRegex);
  if (match) {
    const fullTableText = match[1];
    if (fullTableText.trim().startsWith('|')) {
      return {
        rawMatch: fullTableText,
        title: 'APPROACH',
        body: fullTableText.trim(),
      };
    }
  }

  // 2. Bold / Text format check
  const approachMatch = rawText.match(/^\s*(?:>\s*)?(?:\*\*|__)?Approach:?\s*(?:\*\*|__)?\s*\*?([^\n]+(?:\n(?!#{1,6}\s|\*\*Answer|\*\*Model Answer|---|ANSWER|\n\n##|\n##).*)*)/i);
  if (approachMatch && approachMatch[1].trim()) {
    let bodyText = approachMatch[1].trim();
    bodyText = bodyText.replace(/^\*+|\*+$/g, '').trim();
    return {
      rawMatch: approachMatch[0],
      title: 'APPROACH',
      body: bodyText,
    };
  }

  return null;
};

// ── ApproachBox Component ──
export function ApproachBox({
  content,
  title = 'APPROACH',
  colors,
  zoomFontSize,
  isDark
}: {
  content: string;
  title?: string;
  colors: any;
  zoomFontSize: number;
  isDark: boolean;
}) {
  const isTable = content.trim().startsWith('|');
  const cleaned = isTable ? content.trim() : content.replace(/<br\s*\/?>/gi, '\n').trim();
  
  const base = getMarkdownStyles(colors);
  const ratio = (zoomFontSize - 2.5) / 16;
  const approachMarkdownStyles = {
    ...base,
    body: {
      ...base.body,
      fontSize: zoomFontSize - 2.5,
      lineHeight: Math.round((zoomFontSize - 2.5) * 1.55),
      color: colors.textSecondary,
    },
    heading1: {
      ...base.heading1,
      fontSize: Math.round(18 * ratio),
    },
    heading2: {
      ...base.heading2,
      fontSize: Math.round(16 * ratio),
    },
    heading3: {
      ...base.heading3,
      fontSize: Math.round(15 * ratio),
    },
    heading4: {
      ...base.heading4,
      fontSize: Math.round(14 * ratio),
    },
    bullet_list: {
      ...base.bullet_list,
      marginVertical: 4,
    },
    list_item: {
      ...base.list_item,
      marginVertical: 2,
    }
  };

  return (
    <View style={{
      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.45)' : '#f8fafc',
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Sparkles size={14} color="#3b82f6" />
        <Text style={{ fontSize: 11, fontWeight: '800', color: '#3b82f6', letterSpacing: 1 }}>{title}</Text>
      </View>
      <Markdown style={approachMarkdownStyles} rules={getMarkdownRules(colors, isDark)}>
        {cleaned}
      </Markdown>
    </View>
  );
}

// ── Clean Available Answers Filter ──
export const getCleanAvailableAnswers = (answers: any[]) => {
  const seen = new Set<string>();
  return (answers || []).filter(ans => {
    if (!ans.institute) return false;
    const name = ans.institute.trim().toLowerCase();
    if (seen.has(name)) return false;
    
    // Check if the answer text is valid/available or if it is a topper answer with pages
    const hasTopperPages = Boolean(
      ans.is_topper ||
      ans.topper ||
      (ans.page_urls && ans.page_urls.length > 0) ||
      (Array.isArray(ans.pages) && ans.pages.length > 0)
    );
    const text = ans.answerText || ans.answer_text || '';
    const lower = text.toLowerCase();
    if (!hasTopperPages && (!text.trim() || lower.includes('not covered') || lower.includes('no answer compiled') || lower.includes('no answer text available'))) {
      return false;
    }
    
    seen.add(name);
    return true;
  });
};

// ── Search Term Highlighting ──
export function highlightKeywords(text: string, query?: string): React.ReactNode {
  if (!text) return null;
  if (!query || !query.trim()) return text;

  const trimmed = query.trim();
  const words = trimmed.split(/\s+/).filter(w => w.length >= 2);
  if (words.length === 0) return text;

  const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const pattern = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(pattern);
  if (parts.length <= 1) return text;

  return parts.map((part, i) =>
    pattern.test(part) ? (
      <Text
        key={i}
        style={{
          fontWeight: '900',
          color: '#ea580c',
        }}
      >
        {part}
      </Text>
    ) : (
      part
    )
  );
}

// ── Answer Snippet Builder ──
export function buildAnswerSnippet(answers: any[], query?: string): React.ReactNode | null {
  if (!query || !query.trim() || !answers || answers.length === 0) return null;
  const words = query.trim().toLowerCase().split(/\s+/).filter(w => w.length >= 2);
  if (words.length === 0) return null;

  for (const a of answers) {
    const rawText = a.answerText || '';
    if (!rawText) continue;
    const cleanText = rawText.replace(/!\[.*?\]\(.*?\)/g, '').replace(/[#*`_]/g, ' ').replace(/\s+/g, ' ');
    const lower = cleanText.toLowerCase();
    for (const w of words) {
      const idx = lower.indexOf(w);
      if (idx >= 0) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(cleanText.length, idx + w.length + 60);
        const prefix = start > 0 ? '...' : '';
        const suffix = end < cleanText.length ? '...' : '';
        const snippet = `${prefix}${cleanText.slice(start, end).trim()}${suffix}`;
        return highlightKeywords(snippet, query);
      }
    }
  }
  return null;
}

// ── Word Counter ──
export const getWordCount = (text: string): number => {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
};

// ── Taxonomy Hierarchy ──
export const getQuestionTaxonomy = (q: any): string[] => {
  if (Array.isArray(q.hierarchy_path) && q.hierarchy_path.length > 0) {
    return q.hierarchy_path.filter((p: any) => p && p !== 'Unknown' && p !== 'undefined' && p !== 'null');
  }
  const path: string[] = [];
  if (q.paper) path.push(q.paper);
  if (q.subject) path.push(q.subject);
  if (q.sectionGroup) path.push(q.sectionGroup);
  if (q.microTopic) path.push(q.microTopic);
  if (q.subTopic) path.push(q.subTopic);
  if (q.nanoTopic) path.push(q.nanoTopic);
  return path.filter((p: any) => p && p !== 'Unknown' && p !== 'undefined' && p !== 'null');
};

export const renderTaxonomyStrip = (q: any, colors: any, isDark: boolean) => {
  const levels = getQuestionTaxonomy(q);
  if (levels.length === 0) return null;

  return (
    <View style={{
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Layers size={13} color={colors.textSecondary} />
        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.5 }}>
          TAXONOMY HIERARCHY
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        {levels.map((lvl, index) => {
          const colorsList = [
            { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' }, // Paper (blue)
            { bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6' }, // Subject (purple)
            { bg: '#fffbeb', border: '#fde68a', text: '#92400e' }, // Section Group (amber)
            { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' }, // Micro Topic (green)
            { bg: '#ecfeff', border: '#a5f3fc', text: '#075985' }, // Sub Topic (cyan)
            { bg: '#fff5f5', border: '#fed7d7', text: '#9b1c1c' }, // Nano Topic (red)
          ];
          const style = colorsList[Math.min(index, colorsList.length - 1)];
          
          return (
            <React.Fragment key={lvl}>
              {index > 0 && (
                <Text style={{ fontSize: 11, color: colors.textTertiary, marginHorizontal: 2 }}>&gt;</Text>
              )}
              <View style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : style.bg,
                borderColor: isDark ? 'rgba(255,255,255,0.15)' : style.border,
                borderWidth: 1,
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}>
                <Text style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: isDark ? colors.textPrimary : style.text,
                }}>
                  {lvl}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};
