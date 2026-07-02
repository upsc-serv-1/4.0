import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { cleanDataFactsMarkdown, getMarkdownStyles } from '../../../app/mains';

// Split content by <!-- Sub-Theme: ... --> comments
const splitSubThemes = (text: string | undefined | null) => {
  if (!text) return [];
  const parts = text.split(/<!--\s*Sub-Theme:\s*([^-]+?)\s*-->/i);
  const subThemes: { title: string; content: string }[] = [];

  const firstPreamble = parts[0]?.trim();
  if (firstPreamble && parts.length > 1) {
    subThemes.push({ title: '', content: firstPreamble });
  }

  for (let i = 1; i < parts.length; i += 2) {
    const title = parts[i].trim();
    let content = parts[i + 1] || '';
    // Strip duplicate leading "• <b><u>Title</u></b>" line that mirrors the split-out title
    content = content.replace(
      /^(?:<br\s*\/?>|\s)*(?:•\s*)?(?:<b><u>|<u><b>|\*\*)?[^<\n\r]{0,120}(?:<\/u><\/b>|<\/b><\/u>|\*\*|<\/b>|<\/u>)?(?:<br\s*\/?>|\s)*/i,
      ''
    );
    subThemes.push({ title, content });
  }

  if (subThemes.length === 0 && text) {
    subThemes.push({ title: '', content: text });
  }
  return subThemes;
};

// Extract sub-sub-theme titles from content
const splitSubSubThemes = (text: string | undefined | null): string[] => {
  if (!text) return [];
  const matches = text.matchAll(/<!--\s*Sub-Sub-Theme:\s*([^-]+?)\s*-->/gi);
  const titles: string[] = [];
  for (const match of matches) {
    if (match[1]) titles.push(match[1].trim());
  }
  return Array.from(new Set(titles)).filter(Boolean);
};

// Split content by <!-- Sub-Sub-Theme: ... --> comments into blocks
const splitSubSubThemeBlocks = (text: string | undefined | null) => {
  if (!text) return [];
  const parts = text.split(/<!--\s*Sub-Sub-Theme:\s*([^-]+?)\s*-->/i);
  const blocks: { title: string; content: string }[] = [];

  const firstPreamble = parts[0]?.trim();
  if (firstPreamble && parts.length > 1) {
    blocks.push({ title: '', content: firstPreamble });
  }

  for (let i = 1; i < parts.length; i += 2) {
    const title = parts[i].trim();
    const content = parts[i + 1] || '';
    blocks.push({ title, content });
  }

  if (blocks.length === 0 && text) {
    blocks.push({ title: '', content: text });
  }
  return blocks;
};

// Custom list_item renderer with different bullet shapes per nesting level
const makeDataFactsMarkdownRules = () => ({
  list_item: (node: any, children: any, parent: any, styles: any, inheritedStyles = {}) => {
    const bulletListDepth = Array.isArray(parent)
      ? parent.filter((el: any) => el.type === 'bullet_list').length
      : 1;

    // Level 1: filled circle •, Level 2: hollow ◦, Level 3+: small square ▪
    let bulletIcon = '\u2022';
    if (bulletListDepth === 2) bulletIcon = '\u25E6';
    else if (bulletListDepth >= 3) bulletIcon = '\u25AA';

    const refStyle = { ...inheritedStyles, ...StyleSheet.flatten(styles.list_item) };
    const textStyleProps = ['color','fontSize','fontStyle','fontWeight','lineHeight','textAlign','fontFamily'];
    const inheritedTextStyle: any = {};
    for (const key of Object.keys(refStyle)) {
      if (textStyleProps.includes(key)) inheritedTextStyle[key] = (refStyle as any)[key];
    }

    if (Array.isArray(parent) && parent.some((el: any) => el.type === 'bullet_list')) {
      return (
        <View key={node.key} style={[localStyles._VIEW_SAFE_list_item, { paddingLeft: (bulletListDepth - 1) * 14 }]}>
          <Text style={[inheritedTextStyle, styles.bullet_list_icon, {
            marginRight: 6,
            fontSize: bulletListDepth === 1 ? 14 : bulletListDepth === 2 ? 12 : 10,
            marginTop: bulletListDepth === 1 ? 1 : 2,
          }]}>
            {bulletIcon}
          </Text>
          <View style={localStyles._VIEW_SAFE_bullet_list_content}>{children}</View>
        </View>
      );
    }

    if (Array.isArray(parent) && parent.some((el: any) => el.type === 'ordered_list')) {
      const orderedListIdx = parent.findIndex((el: any) => el.type === 'ordered_list');
      const orderedList = parent[orderedListIdx];
      let listItemNumber = node.index + 1;
      if (orderedList?.attributes?.start) {
        listItemNumber = orderedList.attributes.start + node.index;
      }
      return (
        <View key={node.key} style={localStyles._VIEW_SAFE_list_item}>
          <Text style={[inheritedTextStyle, styles.ordered_list_icon]}>
            {listItemNumber}{node.markup}
          </Text>
          <View style={localStyles._VIEW_SAFE_ordered_list_content}>{children}</View>
        </View>
      );
    }

    return <View key={node.key} style={localStyles._VIEW_SAFE_list_item}>{children}</View>;
  }
});

export default function MainsDataFactsCard({
  item,
  colors,
  filters,
  search,
  zoomScale
}: {
  item: any;
  colors: any;
  filters: any;
  search: string;
  zoomScale: number;
}) {
  const customMarkdownStyles = {
    ...getMarkdownStyles(colors),
    body: {
      color: colors.textSecondary,
      fontSize: 13 * zoomScale,
      lineHeight: 19 * zoomScale,
      fontWeight: '500' as const,
    },
    // Sub-theme headings (### from cleanDataFactsMarkdown) — blue
    heading3: {
      color: '#2563eb',
      fontSize: 14 * zoomScale,
      fontWeight: '800' as const,
      marginTop: 10,
      marginBottom: 4,
      letterSpacing: 0.2,
    },
    // Sub-sub-theme headings (#### from cleanDataFactsMarkdown) — purple
    heading4: {
      color: '#7c3aed',
      fontSize: 13 * zoomScale,
      fontWeight: '800' as const,
      marginTop: 8,
      marginBottom: 3,
    },
    strong: {
      color: colors.textPrimary,
      fontWeight: '700' as const,
    },
  };

  const dataFactsMarkdownRules = makeDataFactsMarkdownRules();

  const subThemes = item.parsedSubThemes || splitSubThemes(item.context);
  const activeSubThemes = filters.subtopics && filters.subtopics !== 'All' ? filters.subtopics.split('|') : [];
  const activeSubSubThemes = filters.macrotags && filters.macrotags !== 'All' ? filters.macrotags.split('|') : [];

  const matchedSubThemes = subThemes.filter((st: any) => {
    const matchSearch = !search ||
      st.title.toLowerCase().includes(search.toLowerCase()) ||
      st.content.toLowerCase().includes(search.toLowerCase());
    const matchSubTheme = activeSubThemes.length === 0 || activeSubThemes.includes(st.title);
    const matchSubSubTheme = activeSubSubThemes.length === 0 ||
      splitSubSubThemes(st.content).some(sst => activeSubSubThemes.includes(sst));
    return matchSearch && matchSubTheme && matchSubSubTheme;
  });

  // Soft pastel box colors for sub-theme blocks (cycles through palette)
  const boxPalette = [
    { bg: 'rgba(59, 130, 246, 0.05)', border: 'rgba(59, 130, 246, 0.25)', title: '#1d4ed8' },
    { bg: 'rgba(16, 185, 129, 0.05)', border: 'rgba(16, 185, 129, 0.25)', title: '#065f46' },
    { bg: 'rgba(245, 158, 11, 0.06)', border: 'rgba(245, 158, 11, 0.28)', title: '#92400e' },
    { bg: 'rgba(139, 92, 246, 0.05)', border: 'rgba(139, 92, 246, 0.25)', title: '#5b21b6' },
    { bg: 'rgba(244, 63, 94, 0.05)', border: 'rgba(244, 63, 94, 0.25)', title: '#9f1239' },
    { bg: 'rgba(6, 182, 212, 0.05)', border: 'rgba(6, 182, 212, 0.25)', title: '#0e7490' },
  ];

  return (
    <View style={{ gap: 10 }}>
      {matchedSubThemes.map((st: any, sIdx: number) => {
        const palette = boxPalette[sIdx % boxPalette.length];
        const isSubThemeTitleMatched = activeSubThemes.includes(st.title);
        const subSubThemes = splitSubSubThemeBlocks(st.content);
        const matchedSstBlocks = subSubThemes.filter(sst => {
          const matchSearch = !search ||
            sst.title.toLowerCase().includes(search.toLowerCase()) ||
            sst.content.toLowerCase().includes(search.toLowerCase());
          const matchFilter = activeSubSubThemes.length === 0 || activeSubSubThemes.includes(sst.title);
          return matchSearch && matchFilter;
        });

        const showSeparateSstBlocks = activeSubSubThemes.length > 0 || (search && !st.content.toLowerCase().includes(search.toLowerCase()) && matchedSstBlocks.length > 0);

        return (
          <View
            key={`df-st-${sIdx}`}
            style={{
              backgroundColor: isSubThemeTitleMatched ? palette.bg : 'rgba(100,116,139,0.04)',
              borderWidth: 1,
              borderColor: isSubThemeTitleMatched ? palette.border : colors.border,
              borderRadius: 10,
              padding: 10,
              marginVertical: 2,
            }}
          >
            {/* Sub-theme heading in blue */}
            {st.title ? (
              <Text style={[
                localStyles.subThemeHeader,
                {
                  color: isSubThemeTitleMatched ? palette.title : '#2563eb',
                  fontSize: 11 * zoomScale,
                }
              ]}>
                {st.title.toUpperCase()}
              </Text>
            ) : null}

            {showSeparateSstBlocks ? (
              <View style={{ gap: 6, marginTop: 4 }}>
                {matchedSstBlocks.map((sst, sstIdx) => {
                  const isSstTitleMatched = activeSubSubThemes.includes(sst.title);
                  return (
                    <View key={`df-sst-${sstIdx}`} style={{
                      borderLeftWidth: isSstTitleMatched ? 2 : 0,
                      borderLeftColor: '#7c3aed',
                      paddingLeft: isSstTitleMatched ? 8 : 0,
                      marginVertical: 2,
                    }}>
                      {/* Sub-sub-theme heading in purple */}
                      {sst.title ? (
                        <Text style={[localStyles.subSubThemeHeader, { color: '#7c3aed', fontSize: 10 * zoomScale }]}>
                          {sst.title.toUpperCase()}
                        </Text>
                      ) : null}
                      <Markdown style={customMarkdownStyles} rules={dataFactsMarkdownRules}>
                        {cleanDataFactsMarkdown(sst.content, item)}
                      </Markdown>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Markdown style={customMarkdownStyles} rules={dataFactsMarkdownRules}>
                {cleanDataFactsMarkdown(st.content, item)}
              </Markdown>
            )}
          </View>
        );
      })}
    </View>
  );
}

const localStyles = StyleSheet.create({
  subThemeHeader: {
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  subSubThemeHeader: {
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  _VIEW_SAFE_list_item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 1,
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
