import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  Platform,
  KeyboardAvoidingView,
  Image,
  Keyboard,
} from 'react-native';
import {
  Database, Copy, Upload, Trash2, Edit, Search, CheckCircle,
  AlertTriangle, Play, X, Eye, Save, ChevronDown, Filter, PenLine, Clipboard as CopyIcon, Check,
  BookOpen, Menu, ChevronRight
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import Markdown from 'react-native-markdown-display';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import { hubRegistry, HubConfig } from '../../config/hubRegistry';
import { r2UploadService } from '../../services/R2UploadService';
import { cleanMarkdownContent, getMarkdownStyles, cleanDataFactsMarkdown } from '../../../app/mains';

// Import pre-baked hierarchy texts
import { gsHierarchyMd, anthroPaper1Text, anthroPaper2Text } from '../../config/syllabusHierarchyData';

// ── Deterministic UUID ─────────────────────────────────────────────────────────
function deterministicUUID(tableName: string, uniqueStr: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  const s = `${tableName}:${uniqueStr}`;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const x1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const x2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const x3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0');
  const x4 = ((h1 & h2) >>> 0).toString(16).padStart(8, '0');
  return `${x1}-${x2.slice(0, 4)}-4${x3.slice(1, 4)}-${((h2 & 0x3fff) | 0x8000).toString(16)}-${(x3 + x4).slice(0, 12)}`;
}

// ── Auto-detect hub and resolve field mappings for flexibility ────────────────
function detectHubAndNormalize(item: any): { hub: HubConfig | null, normalized: any } {
  if (!item || typeof item !== 'object') return { hub: null, normalized: item };
  
  const norm = { ...item };
  
  // 1. Detect hub first using unique keys
  let targetHub: HubConfig | null = null;
  if (norm.mnemonic_keyword !== undefined || norm.formula_expansion !== undefined) {
    targetHub = hubRegistry.find(h => h.id === 'mains_mnemonics') || null;
  } else if (norm.framework_name !== undefined || norm.breakdown_markdown !== undefined) {
    targetHub = hubRegistry.find(h => h.id === 'mains_frameworks') || null;
  } else if (norm.questionText !== undefined || norm.question_text !== undefined) {
    targetHub = hubRegistry.find(h => h.id === 'mains_questions') || null;
  } else if (norm.entry_type !== undefined || (norm.content !== undefined && norm.author !== undefined)) {
    targetHub = hubRegistry.find(h => h.id === 'mains_essay_value_add') || null;
  } else if (norm.parameter !== undefined) {
    targetHub = hubRegistry.find(h => h.id === 'mains_data_facts') || null;
  } else if (norm.ethics_type !== undefined) {
    const type = String(norm.ethics_type).toLowerCase();
    targetHub = hubRegistry.find(h => h.id === `mains_ethics_${type}`) || null;
  } else if (norm.body !== undefined && norm.card_title !== undefined) {
    targetHub = hubRegistry.find(h => h.id === 'mains_intro_conclusions') || null;
  }
  
  // Fallback: If still not detected, try parsing title prefixes
  if (!targetHub && norm.title) {
    const t = String(norm.title).toLowerCase();
    if (t.includes('vs') || t.includes('difference')) {
      targetHub = hubRegistry.find(h => h.id === 'mains_ethics_comparison') || null;
    }
  }

  // 2. Normalize camelCase inputs to match db snake_case
  if (norm.questionText !== undefined && norm.question_text === undefined) norm.question_text = norm.questionText;
  if (norm.year !== undefined && norm.exam_year === undefined) norm.exam_year = norm.year;
  if (norm.sectionGroup !== undefined && norm.section_group === undefined) norm.section_group = norm.sectionGroup;
  if (norm.microTopic !== undefined && norm.microtopic === undefined) norm.microtopic = norm.microTopic;
  if (norm.subTopic !== undefined && norm.subtopic === undefined) norm.subtopic = norm.subTopic;
  if (norm.nanoTopic !== undefined && norm.nanotopic === undefined) norm.nanotopic = norm.nanoTopic;

  return { hub: targetHub, normalized: norm };
}

// Helper to parse Intro sections
interface MarkdownSection {
  heading: string;
  content: string;
}
const parseBodyToSections = (text: string | undefined | null): MarkdownSection[] => {
  if (!text) return [];
  const sections: MarkdownSection[] = [];
  const lines = text.split('\n');
  
  let currentHeading = '';
  let currentLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    const hMatch = trimmed.match(/^(?:###|####|##)\s*(.*?)$/);
    const bMatch = trimmed.match(/^(?:[-*]\s*)?\*\*([^*]+?):\*\*\s*$/);
    
    if (hMatch) {
      if (currentLines.length > 0 || currentHeading) {
        sections.push({ heading: currentHeading || 'General', content: currentLines.join('\n') });
        currentLines = [];
      }
      currentHeading = hMatch[1].trim();
    } else if (bMatch) {
      if (currentLines.length > 0 || currentHeading) {
        sections.push({ heading: currentHeading || 'General', content: currentLines.join('\n') });
        currentLines = [];
      }
      currentHeading = bMatch[1].trim();
    } else {
      currentLines.push(line);
    }
  }
  
  if (currentLines.length > 0 || currentHeading) {
    sections.push({ heading: currentHeading || 'General', content: currentLines.join('\n') });
  }
  
  sections.forEach(sec => {
    if ((sec.heading === 'General' || !sec.heading) && sec.content.trim().startsWith('>')) {
      sec.heading = 'Quote';
    }
  });
  
  return sections;
};

// Reusable styled header boxes for Intro card previews
function IntroSectionBox({ heading, content, colors }: { heading: string; content: string; colors: any }) {
  const h = heading.toLowerCase();
  let textColor = '#475569', bgColor = 'rgba(100,116,139,0.06)', borderColor = '#e2e8f0', label = heading.toUpperCase();

  if (h.includes('quote')) {
    textColor = '#d97706'; bgColor = 'rgba(251,191,36,0.06)'; borderColor = '#fef3c7'; label = 'QUOTE';
  } else if (h.includes('intro') || h.includes('concept')) {
    textColor = '#1d4ed8'; bgColor = 'rgba(59,130,246,0.06)'; borderColor = '#dbeafe'; label = 'INTRODUCTION';
  } else if (h.includes('example') || h.includes('practice') || h.includes('case study') || h.includes('case studies')) {
    textColor = '#7c3aed'; bgColor = 'rgba(139,92,246,0.06)'; borderColor = '#ddd6fe'; label = 'EXAMPLES / CASE STUDIES';
  } else if (h.includes('conclusion') || h.includes('way forward')) {
    textColor = '#047857'; bgColor = 'rgba(16,185,129,0.06)'; borderColor = '#d1fae5'; label = 'CONCLUSION';
  } else if (h.includes('data') || h.includes('fact')) {
    textColor = '#0d9488'; bgColor = 'rgba(20,184,166,0.06)'; borderColor = '#ccfbf1'; label = 'DATA & FACTS';
  }

  const lines = content.split('\n').filter(l => l.trim());

  return (
    <View style={{ borderLeftWidth: 3, borderLeftColor: textColor, paddingLeft: 8, marginVertical: 4 }}>
      <Text style={{ fontSize: 9, fontWeight: '800', color: textColor, marginBottom: 2 }}>{label}</Text>
      {lines.map((line, idx) => {
        const t = line.trim();
        if (t.startsWith('>') || t.startsWith('&gt;')) {
          const qText = t.replace(/^(&gt;|>)\s*/, '').replace(/\*\*/g, '');
          return <Text key={idx} style={{ fontSize: 11, fontStyle: 'italic', color: '#b45309', marginVertical: 3 }}>“{qText}”</Text>;
        }
        return (
          <Text key={idx} style={{ fontSize: 10.5, color: colors.textSecondary, lineHeight: 14 }}>
            {t.replace(/^[-*•\s]+/, '').replace(/\*\*(.*?)\*\*/g, '$1')}
          </Text>
        );
      })}
    </View>
  );
}

function HubCardPreview({ item, hub, colors }: { item: any; hub: HubConfig; colors: any }) {
  const TagRow = () => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
      {item.paper && <Text style={[styles.chip, { backgroundColor: colors.primary + '15', color: colors.primary }]}>{item.paper}</Text>}
      {(item.subject || item.section_group) && <Text style={[styles.chip, { backgroundColor: colors.border, color: colors.textSecondary }]}>{[item.subject, item.section_group].filter(Boolean).join(' · ')}</Text>}
      {item.microtopic && <Text style={[styles.chip, { backgroundColor: colors.border, color: colors.textTertiary }]}>{item.microtopic}</Text>}
      {item.nanotopic && <Text style={[styles.chip, { backgroundColor: '#e2e8f0', color: '#475569' }]}>⚡ {item.nanotopic}</Text>}
    </View>
  );

  // ── INTRO & CONCLUSION ──────────────────────────────────────────────────────
  if (hub.id === 'mains_intro_conclusions') {
    const body = item.body || '';
    const sections = parseBodyToSections(body);
    return (
      <View>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: colors.textPrimary }}>{item.card_title || 'Untitled'}</Text>
          <TagRow />
        </View>
        {sections.map((sec, i) => (
          <IntroSectionBox key={i} heading={sec.heading} content={sec.content} colors={colors} />
        ))}
      </View>
    );
  }

  // ── DATA & FACTS ────────────────────────────────────────────────────────────
  if (hub.id === 'mains_data_facts') {
    const boxPalette = [
      { bg: 'rgba(59, 130, 246, 0.05)', border: 'rgba(59, 130, 246, 0.25)', title: '#1d4ed8' },
      { bg: 'rgba(16, 185, 129, 0.05)', border: 'rgba(16, 185, 129, 0.25)', title: '#065f46' },
      { bg: 'rgba(245, 158, 11, 0.06)', border: 'rgba(245, 158, 11, 0.28)', title: '#92400e' },
      { bg: 'rgba(139, 92, 246, 0.05)', border: 'rgba(139, 92, 246, 0.25)', title: '#5b21b6' },
    ];

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

    const makePreviewRules = () => ({
      list_item: (node: any, children: any, parent: any, styles: any, inheritedStyles = {}) => {
        const bulletListDepth = Array.isArray(parent)
          ? parent.filter((el: any) => el.type === 'bullet_list').length
          : 1;

        let bulletIcon = '\u2022';
        if (bulletListDepth === 2) bulletIcon = '\u25E6';
        else if (bulletListDepth >= 3) bulletIcon = '\u25AA';

        const refStyle = { ...inheritedStyles, ...StyleSheet.flatten(styles.list_item) };
        const textStyleProps = ['color','fontSize','fontStyle','fontWeight','lineHeight','textAlign','fontFamily'];
        const inheritedTextStyle: any = {};
        for (const key of Object.keys(refStyle)) {
          if (textStyleProps.includes(key)) inheritedTextStyle[key] = (refStyle as any)[key];
        }

        return (
          <View key={node.key} style={{ flexDirection: 'row', alignItems: 'flex-start', marginVertical: 1, paddingLeft: (bulletListDepth - 1) * 14 }}>
            <Text style={[inheritedTextStyle, { marginRight: 6, fontSize: bulletListDepth === 1 ? 14 : bulletListDepth === 2 ? 12 : 10, marginTop: bulletListDepth === 1 ? 1 : 2 }]}>
              {bulletIcon}
            </Text>
            <View style={{ flex: 1 }}>{children}</View>
          </View>
        );
      }
    });

    const subThemes = splitSubThemes(item.content_markdown || '');
    return (
      <View>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: colors.textPrimary }}>
            {[item.parameter, item.card_title].filter(Boolean).join(' – ')}
          </Text>
          <TagRow />
        </View>
        <View style={{ gap: 8 }}>
          {subThemes.map((st: any, sIdx: number) => {
            const palette = boxPalette[sIdx % boxPalette.length];
            return (
              <View
                key={sIdx}
                style={{
                  backgroundColor: palette.bg,
                  borderWidth: 1,
                  borderColor: palette.border,
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                {st.title ? (
                  <Text style={{ fontWeight: '800', color: palette.title, fontSize: 11, marginBottom: 6 }}>
                    {st.title.toUpperCase()}
                  </Text>
                ) : null}
                <Markdown style={getMarkdownStyles(colors)} rules={makePreviewRules()}>
                  {cleanDataFactsMarkdown(st.content, item)}
                </Markdown>
              </View>
            );
          })}
          {item.source && <Text style={{ fontSize: 9, color: colors.textTertiary, fontStyle: 'italic', marginTop: 4, marginLeft: 2 }}>📌 Source: {item.source}</Text>}
        </View>
      </View>
    );
  }

  // ── QUOTES & ANECDOTES ──────────────────────────────────────────────────────
  if (hub.id === 'mains_essay_value_add') {
    const isAnecdote = item.entry_type === 'anecdote';
    return (
      <View>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <View style={{ backgroundColor: isAnecdote ? 'rgba(139,92,246,0.12)' : 'rgba(217,119,6,0.10)', borderWidth: 1, borderColor: isAnecdote ? 'rgba(139,92,246,0.35)' : 'rgba(217,119,6,0.35)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: isAnecdote ? '#8b5cf6' : '#d97706' }}>{isAnecdote ? 'ANECDOTE' : 'QUOTE'}</Text>
          </View>
          {item.microtopic && <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
            <Text style={{ fontSize: 9, color: colors.textTertiary }}>{item.microtopic}</Text>
          </View>}
          {item.nanotopic && <View style={{ backgroundColor: '#e2e8f0', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}><Text style={{ fontSize: 9, color: '#475569' }}>⚡ {item.nanotopic}</Text></View>}
        </View>
        <View style={{ borderWidth: 1.5, borderRadius: 16, padding: 16, backgroundColor: 'rgba(217,119,6,0.03)', borderColor: 'rgba(217,119,6,0.15)', alignItems: 'center' }}>
          <Text style={{ fontSize: 36, color: 'rgba(180,83,9,0.12)', fontWeight: '900', lineHeight: 30, marginBottom: 4 }}>"</Text>
          <Text style={{ fontSize: 14, fontStyle: 'italic', color: '#b45309', fontWeight: '600', textAlign: 'center', lineHeight: 20 }}>
            {item.content || item.body || ''}
          </Text>
          {(item.title || item.author) && (
            <Text style={{ fontSize: 11, fontStyle: 'italic', color: '#b45309', marginTop: 10, fontWeight: '700' }}>
              — {item.title || item.author}
            </Text>
          )}
        </View>
        {item.usage_guide && (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 10, paddingTop: 8 }}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: colors.textTertiary, marginBottom: 4 }}>USAGE GUIDE</Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>{item.usage_guide}</Text>
          </View>
        )}
      </View>
    );
  }

  // ── MNEMONICS ───────────────────────────────────────────────────────────────
  if (hub.id === 'mains_mnemonics') {
    const keyword = item.mnemonic_keyword || '';
    const expansion = Array.isArray(item.formula_expansion)
      ? item.formula_expansion.map((e: any) => `- **${e.letter}**: ${e.meaning}`).join('\n')
      : String(item.formula_expansion || '');
    const context = item.explanation_examples || '';
    const letters = keyword.split('').filter((c: string) => /[A-Z]/i.test(c));
    const expansionLines = expansion.split('\n').filter((l: string) => l.trim());
    return (
      <View>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: colors.textPrimary }}>{item.mnemonic_number_title}</Text>
          <TagRow />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: '#f59e0b' }}>KEYWORD:</Text>
          <Text style={{ fontSize: 16, fontWeight: '900', color: colors.textPrimary, letterSpacing: 2 }}>{keyword}</Text>
        </View>
        <View style={{ gap: 8 }}>
          {expansionLines.map((line: string, i: number) => {
            const clean = line.trim().replace(/^[-*]\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1');
            const letter = letters[i] || '';
            const rest = letter ? clean.replace(new RegExp(`^${letter}[^:：-]*[:：-]?\\s*`, 'i'), '') : clean;
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>{letter || (i + 1).toString()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: colors.textPrimary, fontWeight: '700', lineHeight: 16 }}>{rest || clean}</Text>
                </View>
              </View>
            );
          })}
        </View>
        {context ? (
          <View style={{ borderTopWidth: 0.5, borderTopColor: colors.border, marginTop: 12, paddingTop: 10 }}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: '#f59e0b', marginBottom: 4 }}>EXPLANATION & EXAMPLES</Text>
            <Markdown style={getMarkdownStyles(colors)}>
              {context}
            </Markdown>
          </View>
        ) : null}
      </View>
    );
  }

  // ── FRAMEWORKS ──────────────────────────────────────────────────────────────
  if (hub.id === 'mains_frameworks') {
    const guide = item.breakdown_markdown || '';
    const diagUrl = item.diagram_image_path;
    return (
      <View>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: colors.textPrimary }}>{item.framework_name}</Text>
        </View>
        {diagUrl && (
          <View style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: 8 }}>
            <Image source={{ uri: diagUrl }} style={{ width: '100%', height: 120 }} resizeMode="contain" />
          </View>
        )}
        <View style={{ borderWidth: 1, borderRadius: 12, padding: 14, borderColor: colors.border, backgroundColor: colors.surface }}>
          <Markdown style={getMarkdownStyles(colors)}>
            {guide}
          </Markdown>
        </View>
      </View>
    );
  }

  // ── ETHICS ──────────────────────────────────────────────────────────────────
  if (hub.id.startsWith('mains_ethics_') || hub.id === 'mains_ethics') {
    const boxPalette = [
      { bg: 'rgba(59, 130, 246, 0.05)', border: 'rgba(59, 130, 246, 0.25)', title: '#1d4ed8' },
      { bg: 'rgba(16, 185, 129, 0.05)', border: 'rgba(16, 185, 129, 0.25)', title: '#065f46' },
      { bg: 'rgba(245, 158, 11, 0.06)', border: 'rgba(245, 158, 11, 0.28)', title: '#92400e' },
      { bg: 'rgba(139, 92, 246, 0.05)', border: 'rgba(139, 92, 246, 0.25)', title: '#5b21b6' },
    ];
    const colorIdx = (item.title || '').split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % boxPalette.length;
    const pal = boxPalette[colorIdx];
    const diagUrl = item.diagram_image_path;
    return (
      <View>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: colors.textPrimary }}>{item.title}</Text>
          <TagRow />
        </View>
        {diagUrl && (
          <View style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: 8 }}>
            <Image source={{ uri: diagUrl }} style={{ width: '100%', height: 120 }} resizeMode="contain" />
          </View>
        )}
        <View style={{ backgroundColor: pal.bg, borderWidth: 1, borderColor: pal.border, borderRadius: 12, padding: 12 }}>
          <Markdown style={getMarkdownStyles(colors)}>
            {cleanMarkdownContent(item.content_markdown || '')}
          </Markdown>
        </View>
      </View>
    );
  }

  // ── QUESTION BANK ──────────────────────────────────────────────────────────
  if (hub.id === 'mains_questions') {
    const qText = item.question_text || item.questionText || 'No Question Text';
    const firstAns = Array.isArray(item.mains_answers) ? item.mains_answers[0] : null;
    return (
      <View>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: colors.textPrimary }}>
            {item.is_pyq ? `📜 [PYQ ${item.exam_year || item.year}] ` : ''}Marks: {item.marks}
          </Text>
          <TagRow />
        </View>
        <View style={{ borderWidth: 1, borderRadius: 12, padding: 12, borderColor: colors.border, backgroundColor: colors.surface }}>
          <Text style={{ fontSize: 12.5, color: colors.textPrimary, fontWeight: '800', marginBottom: 8 }}>{qText}</Text>
          {firstAns ? (
            <View style={{ borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 8 }}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: colors.primary, marginBottom: 4 }}>ANSWER PREVIEW ({firstAns.institute})</Text>
              <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                <Markdown style={getMarkdownStyles(colors)}>
                  {firstAns.answer_text}
                </Markdown>
              </ScrollView>
            </View>
          ) : (
            <Text style={{ fontSize: 11, color: colors.textTertiary, fontStyle: 'italic' }}>No model answer drafted yet.</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12 }}>
      <Text style={{ fontSize: 12, color: colors.textSecondary }}>{JSON.stringify(item, null, 2).substring(0, 200)}</Text>
    </View>
  );
}

// ── Hierarchy filter dropdown ──────────────────────────────────────────────────
function HierarchyFilter({ label, value, options, onSelect, colors }: any) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 6, zIndex: open ? 999 : 1 }}>
      <TouchableOpacity
        onPress={() => setOpen(o => !o)}
        style={[styles.filterChip, { borderColor: value ? colors.primary : colors.border, backgroundColor: value ? colors.primary + '10' : colors.surface }]}
      >
        <Text style={{ fontSize: 11, fontWeight: '700', color: value ? colors.primary : colors.textPrimary, flex: 1 }} numberOfLines={1}>{value || label}</Text>
        {value
          ? <TouchableOpacity onPress={() => { onSelect(''); setOpen(false); }}><X size={12} color={colors.primary} /></TouchableOpacity>
          : <ChevronDown size={12} color={colors.textTertiary} />}
      </TouchableOpacity>
      {open && options.length > 0 && (
        <View style={[styles.filterDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
            {options.map((opt: string) => (
              <TouchableOpacity key={opt} onPress={() => { onSelect(opt); setOpen(false); }} style={[styles.filterOption, { borderBottomColor: colors.border }]}>
                <Text style={{ fontSize: 11, color: colors.textPrimary }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ── Syllabus parser ──────────────────────────────────────────────────────────
export interface SyllabusData {
  [paper: string]: {
    [subject: string]: {
      [section: string]: {
        [microtopic: string]: {
          subtopics: string[];
          nanotopics: { [subtopic: string]: string[] };
        }
      }
    }
  }
}

export function parseSyllabus(): SyllabusData {
  const syllabus: SyllabusData = {};

  // Initialize Essay
  syllabus['Essay'] = {
    'Essay': {
      'General Essay Topics': {
        'Philosophical & Reflective': { subtopics: ['Philosophical & Reflective Essays'], nanotopics: {} },
        'Socio-Economic': { subtopics: ['Socio-Economic Essays'], nanotopics: {} },
        'Political & Governance': { subtopics: ['Political & Governance Essays'], nanotopics: {} },
        'Science, Tech & Environment': { subtopics: ['Science, Tech & Environment Essays'], nanotopics: {} }
      }
    }
  };

  // Parse GS papers
  if (gsHierarchyMd) {
    const lines = gsHierarchyMd.split('\n');
    let currentPaper = '';
    let currentSubject = '';
    let currentSection = '';
    let currentMicrotopic = '';

    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('# GS-IV')) {
        currentPaper = 'GS4';
      } else if (trimmed.startsWith('# GS-III')) {
        currentPaper = 'GS3';
      } else if (trimmed.startsWith('# GS-II')) {
        currentPaper = 'GS2';
      } else if (trimmed.startsWith('# GS-I')) {
        currentPaper = 'GS1';
      } else if (trimmed.startsWith('## SUBJECT:')) {
        currentSubject = trimmed.replace('## SUBJECT:', '').trim();
        currentSection = '';
        currentMicrotopic = '';
      } else if (trimmed.startsWith('### Section Group:')) {
        currentSection = trimmed.replace('### Section Group:', '').trim();
        currentMicrotopic = '';
      } else if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        const isIndented = line.startsWith(' ') || line.startsWith('\t');
        const cleanText = trimmed.replace(/^[-*]\s*/, '').trim();

        if (currentPaper && currentSubject && currentSection) {
          if (!syllabus[currentPaper]) syllabus[currentPaper] = {};
          if (!syllabus[currentPaper][currentSubject]) syllabus[currentPaper][currentSubject] = {};
          if (!syllabus[currentPaper][currentSubject][currentSection]) {
            syllabus[currentPaper][currentSubject][currentSection] = {};
          }

          if (!isIndented) {
            currentMicrotopic = cleanText;
            if (!syllabus[currentPaper][currentSubject][currentSection][currentMicrotopic]) {
              syllabus[currentPaper][currentSubject][currentSection][currentMicrotopic] = { subtopics: [], nanotopics: {} };
            }
          } else {
            if (currentMicrotopic) {
              const node = syllabus[currentPaper][currentSubject][currentSection][currentMicrotopic];
              if (!node.subtopics.includes(cleanText)) {
                node.subtopics.push(cleanText);
              }
            }
          }
        }
      }
    }
  }

  // Parse Optional
  const parseAnthro = (text: string) => {
    if (!text) return;
    const lines = text.split('\n');
    const paper = 'Optional';
    const subject = 'Anthropology';
    let currentSection = '';
    let currentMicrotopic = '';
    let currentSubtopic = '';

    if (!syllabus[paper]) syllabus[paper] = {};
    if (!syllabus[paper][subject]) syllabus[paper][subject] = {};

    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('## Section Group:')) {
        currentSection = trimmed.replace('## Section Group:', '').trim();
        currentMicrotopic = '';
        currentSubtopic = '';
      } else if (trimmed.startsWith('### Microtopic:')) {
        currentMicrotopic = trimmed.replace('### Microtopic:', '').trim();
        currentSubtopic = '';
      } else if (trimmed.startsWith('- Subtopic:')) {
        currentSubtopic = trimmed.replace('- Subtopic:', '').trim();
        if (currentSection && currentMicrotopic) {
          if (!syllabus[paper][subject][currentSection]) {
            syllabus[paper][subject][currentSection] = {};
          }
          if (!syllabus[paper][subject][currentSection][currentMicrotopic]) {
            syllabus[paper][subject][currentSection][currentMicrotopic] = { subtopics: [], nanotopics: {} };
          }
          const node = syllabus[paper][subject][currentSection][currentMicrotopic];
          if (!node.subtopics.includes(currentSubtopic)) {
            node.subtopics.push(currentSubtopic);
          }
          if (!node.nanotopics[currentSubtopic]) {
            node.nanotopics[currentSubtopic] = [];
          }
        }
      } else if (trimmed.startsWith('- Nanotopic:') || (line.startsWith(' ') && trimmed.startsWith('- Nanotopic:'))) {
        const nanoText = trimmed.replace(/^-\s*Nanotopic:\s*/, '').trim();
        if (currentSection && currentMicrotopic && currentSubtopic) {
          const node = syllabus[paper][subject][currentSection][currentMicrotopic];
          if (node && node.nanotopics[currentSubtopic]) {
            if (!node.nanotopics[currentSubtopic].includes(nanoText)) {
              node.nanotopics[currentSubtopic].push(nanoText);
            }
          }
        }
      }
    }
  };

  parseAnthro(anthroPaper1Text);
  parseAnthro(anthroPaper2Text);

  return syllabus;
}

const hasColumn = (hubId: string, col: string): boolean => {
  if (hubId === 'mains_frameworks') {
    return false; // Frameworks has none of the standard hierarchy columns
  }
  if (hubId === 'mains_data_facts') {
    return ['paper', 'subject', 'section_group'].includes(col);
  }
  if (col === 'nanotopic') {
    // Only mains_questions has nanotopic column
    return hubId === 'mains_questions';
  }
  return true;
};

// ═══════════════════════════════════════════════════════════════════════════════
export function ContentManager({ headerBlock, tabSelector }: { headerBlock?: React.ReactNode; tabSelector?: React.ReactNode }) {
  const { colors } = useTheme();

  const [selectedHub, setSelectedHub] = useState<HubConfig>(hubRegistry[0]);
  const [activeSubTab, setActiveSubTab] = useState<'import' | 'staging' | 'live'>('import');
  const [itemList, setItemList] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // JSON input via Modal (resolves keyboard overlay bug)
  const [pasteValue, setPasteValue] = useState('');
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [detectedHub, setDetectedHub] = useState<HubConfig | null>(null);
  const [pasteModalVisible, setPasteModalVisible] = useState(false);
  const [tempPasteText, setTempPasteText] = useState('');

  // Hub Selector Modal (saves massive vertical space)
  const [hubModalVisible, setHubModalVisible] = useState(false);

  // Copy status feedback indicators
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Prompt modal
  const [editablePrompt, setEditablePrompt] = useState('');
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);

  // Edit modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editFormValues, setEditFormValues] = useState<Record<string, any>>({});
  const [editingAnswers, setEditingAnswers] = useState<any[]>([]);
  const [deletedAnswerIds, setDeletedAnswerIds] = useState<string[]>([]);
  const [editActiveTab, setEditActiveTab] = useState<'edit' | 'json' | 'preview'>('edit');
  const [activePreviewAnswerIndex, setActivePreviewAnswerIndex] = useState(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editJsonText, setEditJsonText] = useState('');
  const [editJsonError, setEditJsonError] = useState('');

  // R2
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Live filters
  const [filterPaper, setFilterPaper] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterMicro, setFilterMicro] = useState('');
  const [filterSubtopic, setFilterSubtopic] = useState('');
  const [filterNanotopic, setFilterNanotopic] = useState('');
  const [filterEthicsType, setFilterEthicsType] = useState('');
  const [filterPyq, setFilterPyq] = useState<'all' | 'pyq' | 'non_pyq'>('all');
  const [filterInstitute, setFilterInstitute] = useState('');
  const [filterProgram, setFilterProgram] = useState('');
  const [liveSearch, setLiveSearch] = useState('');

  // Sidebar and Modal states
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hierarchyModalVisible, setHierarchyModalVisible] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  // Pagination states
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Memoized parsed syllabus structure
  const syllabusData = useMemo(() => parseSyllabus(), []);

  // Bulk mode
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => { setEditablePrompt(selectedHub.aiPromptTemplate); }, [selectedHub]);

  // Parse JSON instantly
  useEffect(() => {
    if (!pasteValue.trim()) { setParsedPreview([]); setParseError(null); setImportSuccess(null); setDetectedHub(null); return; }
    try {
      const raw = JSON.parse(pasteValue);
      const items = Array.isArray(raw) ? raw : [raw];
      
      const { hub: detected, normalized } = detectHubAndNormalize(items[0]);
      const normalizedItems = items.map((itm, index) => {
        if (index === 0) return normalized;
        return detectHubAndNormalize(itm).normalized;
      });
      
      setParsedPreview(normalizedItems);
      setParseError(null);
      
      if (detected && detected.id !== selectedHub.id) {
        setDetectedHub(detected);
      } else {
        setDetectedHub(null);
      }
    } catch {
      setParsedPreview([]);
      setDetectedHub(null);
      if (pasteValue.length > 15) setParseError('JSON syntax error. Verify brackets and commas.');
    }
  }, [pasteValue]);

  useEffect(() => {
    if (activeSubTab !== 'import') {
      fetchItems(true); // reset to page 0
    }
    setBulkMode(false);
    setSelectedIds(new Set());
  }, [
    selectedHub,
    activeSubTab,
    filterPaper,
    filterSubject,
    filterSection,
    filterMicro,
    filterSubtopic,
    filterNanotopic,
    filterEthicsType,
  ]);

  const fetchItems = async (reset = false) => {
    const nextPage = reset ? 0 : page;
    if (reset) {
      setPage(0);
      setItemList([]);
      setLoadingItems(true);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const status = activeSubTab === 'staging' ? 'draft' : 'published';
      
      // Relational join if Question Bank to pull matching answers
      const selectFields = selectedHub.id === 'mains_questions' 
        ? '*, mains_answers(*)' 
        : '*';
        
      let query = supabase.from(selectedHub.targetTable).select(selectFields).eq('status', status);
      
      if (selectedHub.id.startsWith('mains_ethics_')) {
        const type = selectedHub.id.replace('mains_ethics_', '');
        query = query.eq('ethics_type', type);
      }

      // Apply server-side filters if active (query columns if they exist, else query hierarchy_path array containment)
      if (filterPaper && filterPaper !== 'All') {
        if (hasColumn(selectedHub.id, 'paper')) {
          query = query.eq('paper', filterPaper);
        } else if (selectedHub.id !== 'mains_frameworks') {
          query = query.contains('hierarchy_path', [filterPaper]);
        }
      }
      if (filterSubject && filterSubject !== 'All') {
        if (hasColumn(selectedHub.id, 'subject')) {
          query = query.eq('subject', filterSubject);
        } else if (selectedHub.id !== 'mains_frameworks') {
          query = query.contains('hierarchy_path', [filterSubject]);
        }
      }
      if (filterSection && filterSection !== 'All') {
        if (hasColumn(selectedHub.id, 'section_group')) {
          query = query.eq('section_group', filterSection);
        } else if (selectedHub.id !== 'mains_frameworks') {
          query = query.contains('hierarchy_path', [filterSection]);
        }
      }
      if (filterMicro && filterMicro !== 'All') {
        if (hasColumn(selectedHub.id, 'microtopic')) {
          query = query.eq('microtopic', filterMicro);
        } else if (selectedHub.id !== 'mains_frameworks') {
          query = query.contains('hierarchy_path', [filterMicro]);
        }
      }
      if (filterSubtopic && filterSubtopic !== 'All') {
        if (hasColumn(selectedHub.id, 'subtopic')) {
          query = query.eq('subtopic', filterSubtopic);
        } else if (selectedHub.id !== 'mains_frameworks') {
          query = query.contains('hierarchy_path', [filterSubtopic]);
        }
      }
      if (filterNanotopic && filterNanotopic !== 'All') {
        if (hasColumn(selectedHub.id, 'nanotopic')) {
          query = query.eq('nanotopic', filterNanotopic);
        } else if (selectedHub.id !== 'mains_frameworks') {
          query = query.contains('hierarchy_path', [filterNanotopic]);
        }
      }

      const PAGE_SIZE = 50;
      const fromRange = nextPage * PAGE_SIZE;
      const toRange = (nextPage + 1) * PAGE_SIZE - 1;

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(fromRange, toRange);

      if (error) throw error;
      const fetched = data || [];

      if (reset) {
        setItemList(fetched);
      } else {
        setItemList(prev => [...prev, ...fetched]);
      }

      setHasMore(fetched.length === PAGE_SIZE);
      setPage(reset ? 1 : nextPage + 1);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoadingItems(false); 
      setLoadingMore(false); 
    }
  };

  // Hierarchy options populated from static parsed syllabus
  const paperOpts = useMemo(() => ['All', ...Object.keys(syllabusData)].sort(), [syllabusData]);
  
  const subjectOpts = useMemo(() => {
    if (!filterPaper || filterPaper === 'All') return [];
    return Object.keys(syllabusData[filterPaper] || {}).sort();
  }, [syllabusData, filterPaper]);

  const sectionOpts = useMemo(() => {
    if (!filterPaper || filterPaper === 'All' || !filterSubject || filterSubject === 'All') return [];
    return Object.keys(syllabusData[filterPaper]?.[filterSubject] || {}).sort();
  }, [syllabusData, filterPaper, filterSubject]);

  const microOpts = useMemo(() => {
    if (!filterPaper || filterPaper === 'All' || !filterSubject || filterSubject === 'All' || !filterSection || filterSection === 'All') return [];
    return Object.keys(syllabusData[filterPaper]?.[filterSubject]?.[filterSection] || {}).sort();
  }, [syllabusData, filterPaper, filterSubject, filterSection]);

  const subtopicOpts = useMemo(() => {
    if (!filterPaper || filterPaper === 'All' || !filterSubject || filterSubject === 'All' || !filterSection || filterSection === 'All' || !filterMicro || filterMicro === 'All') return [];
    return (syllabusData[filterPaper]?.[filterSubject]?.[filterSection]?.[filterMicro]?.subtopics || []).sort();
  }, [syllabusData, filterPaper, filterSubject, filterSection, filterMicro]);

  const nanotopicOpts = useMemo(() => {
    if (!filterPaper || filterPaper === 'All' || !filterSubject || filterSubject === 'All' || !filterSection || filterSection === 'All' || !filterMicro || filterMicro === 'All' || !filterSubtopic || filterSubtopic === 'All') return [];
    return (syllabusData[filterPaper]?.[filterSubject]?.[filterSection]?.[filterMicro]?.nanotopics?.[filterSubtopic] || []).sort();
  }, [syllabusData, filterPaper, filterSubject, filterSection, filterMicro, filterSubtopic]);

  // Relational options dynamically extracted from loaded itemList
  const instituteOpts = useMemo(() => {
    const insts = new Set<string>();
    itemList.forEach(item => {
      if (Array.isArray(item.mains_answers)) {
        item.mains_answers.forEach((ans: any) => {
          if (ans.institute) insts.add(ans.institute);
        });
      }
    });
    return Array.from(insts).sort();
  }, [itemList]);

  const programOpts = useMemo(() => [...new Set(itemList.map(i => i.program_name).filter(Boolean))].sort(), [itemList]);

  // Client-side text search and relational filtering on fetched items
  const filteredItems = useMemo(() => {
    return itemList.filter(item => {
      // 1. Text search
      if (liveSearch.trim()) {
        const query = liveSearch.toLowerCase();
        const t = String(item.question_text || item.questionText || item.card_title || item.title || item.mnemonic_number_title || item.framework_name || '').toLowerCase();
        
        let aText = '';
        if (Array.isArray(item.mains_answers)) {
          aText = item.mains_answers.map((a: any) => a.answer_text || a.answerText || '').join(' ');
        }
        const b = String(item.body || item.content_markdown || item.content || item.explanation_examples || aText || '').toLowerCase();
        if (!t.includes(query) && !b.includes(query)) return false;
      }

      // 2. PYQ status
      if (selectedHub.id === 'mains_questions') {
        if (filterPyq === 'pyq' && !item.is_pyq) return false;
        if (filterPyq === 'non_pyq' && item.is_pyq) return false;
      }

      // 3. Institute
      if (filterInstitute) {
        const hasInst = Array.isArray(item.mains_answers) && item.mains_answers.some((ans: any) => ans.institute === filterInstitute);
        if (!hasInst) return false;
      }

      // 4. Program Name
      if (filterProgram && item.program_name !== filterProgram) return false;

      return true;
    });
  }, [itemList, liveSearch, filterPyq, filterInstitute, filterProgram, selectedHub.id]);

  const handleCopyHierarchy = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const sanitizeItemForDatabase = (item: any, hub: HubConfig) => {
    const cleaned: any = {};
    
    if (item.id) cleaned.id = item.id;
    if (item.created_at) cleaned.created_at = item.created_at;
    if (item.updated_at) cleaned.updated_at = item.updated_at;
    if (item.status) cleaned.status = item.status;
    
    const paperVal = item.paper || '';
    const subjectVal = item.subject || '';
    const secGroupVal = item.section_group || item.sectionGroup || '';
    const microVal = item.microtopic || item.microTopic || '';
    const subVal = item.subtopic || item.subTopic || '';
    const nanoVal = item.nanotopic || item.nanoTopic || item.nano_topic || '';
    
    const path = [paperVal, subjectVal, secGroupVal, microVal, subVal, nanoVal]
      .map(s => String(s).trim())
      .filter(Boolean);
      
    if (path.length > 0) {
      cleaned.hierarchy_path = path;
    }
    
    if (hub.id === 'mains_questions') {
      cleaned.question_text = item.questionText || item.question_text || '';
      cleaned.exam_year = item.year !== undefined ? String(item.year) : (item.exam_year !== undefined ? String(item.exam_year) : '2026');
      cleaned.section_group = item.sectionGroup || item.section_group || '';
      cleaned.microtopic = item.microTopic || item.microtopic || '';
      cleaned.subtopic = item.subTopic || item.subtopic || '';
      cleaned.nanotopic = item.nanotopic || item.nanoTopic || item.nano_topic || '';
      cleaned.is_pyq = item.is_pyq !== undefined ? (item.is_pyq === 'true' || item.is_pyq === true) : false;
      cleaned.marks = item.marks !== undefined ? String(item.marks) : '10';
      cleaned.paper = item.paper || '';
      cleaned.subject = item.subject || '';
      
      const optionalFields = [
        'question_number', 'macrotag', 'microtag', 'source_attribution_label',
        'exam_info', 'stage', 'exam', 'exam_group', 'is_upsc_cse', 'is_allied',
        'is_others', 'exam_category', 'course', 'institute', 'program_id', 'program_name'
      ];
      optionalFields.forEach(f => {
        if (item[f] !== undefined) cleaned[f] = item[f];
      });
    } else {
      let allowedColumns: string[] = [];
      
      if (hub.id === 'mains_data_facts') {
        allowedColumns = ['paper', 'subject', 'section_group', 'parameter', 'card_title', 'content_markdown', 'source'];
      } else if (hub.id === 'mains_intro_conclusions') {
        allowedColumns = ['paper', 'subject', 'section_group', 'microtopic', 'subtopic', 'card_title', 'body'];
      } else if (hub.id === 'mains_essay_value_add') {
        allowedColumns = ['paper', 'subject', 'section_group', 'microtopic', 'subtopic', 'title', 'category', 'entry_type', 'content', 'author', 'usage_guide'];
      } else if (hub.id.startsWith('mains_ethics_')) {
        allowedColumns = ['ethics_type', 'paper', 'subject', 'section_group', 'microtopic', 'subtopic', 'title', 'content_markdown', 'diagram_image_path', 'officer_name', 'initiative', 'impact', 'core_values', 'pyqs'];
        cleaned.ethics_type = hub.id.replace('mains_ethics_', '');
      } else if (hub.id === 'mains_mnemonics') {
        allowedColumns = ['paper', 'subject', 'section_group', 'microtopic', 'subtopic', 'mnemonic_number_title', 'mnemonic_keyword', 'formula_expansion', 'explanation_examples'];
      } else if (hub.id === 'mains_frameworks') {
        allowedColumns = ['framework_name', 'diagram_image_path', 'breakdown_markdown', 'hierarchies', 'hierarchy_1_path', 'hierarchy_2_path', 'hierarchy_3_path', 'hierarchy_4_path', 'hierarchy_5_path'];
      }
      
      allowedColumns.forEach(col => {
        if (item[col] !== undefined) {
          cleaned[col] = item[col];
        }
      });
      if (hub.id === 'mains_essay_value_add' && !cleaned.category && (cleaned.microtopic || item.microTopic || item.microtopic)) {
        cleaned.category = cleaned.microtopic || item.microTopic || item.microtopic;
      }
    }
    
    return cleaned;
  };

  const handleImport = async () => {
    const hubToUse = detectedHub || selectedHub;
    if (!parsedPreview.length) return;
    setIsImporting(true);
    try {
      for (let i = 0; i < parsedPreview.length; i++) {
        const item = parsedPreview[i];
        for (const field of hubToUse.formFields) {
          if (field.required && (item[field.name] === undefined || item[field.name] === null || item[field.name] === '')) {
            throw new Error(`Item ${i + 1}: missing required field "${field.label}" (${field.name})`);
          }
        }
      }

      // Generate question payloads alongside coaching answers
      const payload = parsedPreview.map(item => {
        const id = item.id || deterministicUUID(hubToUse.targetTable, hubToUse.uniqueKeyFn(item));
        const cleaned = sanitizeItemForDatabase(item, hubToUse);
        return { id, ...cleaned, status: 'draft' };
      });

      // Upsert parent cards
      for (let i = 0; i < payload.length; i += 30) {
        const { error } = await supabase.from(hubToUse.targetTable).upsert(payload.slice(i, i + 30), { onConflict: 'id' });
        if (error) throw new Error(error.message);
      }

      // If Question Bank: upsert child answers relational payload
      if (hubToUse.id === 'mains_questions') {
        const answerPayloads: any[] = [];
        parsedPreview.forEach((item, itemIdx) => {
          const qId = payload[itemIdx].id;
          const ansList = item.answers || item.mains_answers || [];
          ansList.forEach((ans: any, ansIdx: number) => {
            answerPayloads.push({
              id: ans.id || `${qId}-${ans.institute || 'model'}-${ansIdx}`,
              question_id: qId,
              institute: ans.institute || 'Model Answer',
              answer_text: ans.answerText || ans.answer_text || ''
            });
          });
        });

        if (answerPayloads.length > 0) {
          for (let i = 0; i < answerPayloads.length; i += 30) {
            const { error } = await supabase.from('mains_answers').upsert(answerPayloads.slice(i, i + 30), { onConflict: 'id' });
            if (error) throw new Error(error.message);
          }
        }
      }

      setImportSuccess(`✓ ${payload.length} card${payload.length > 1 ? 's' : ''} sent to Staging!`);
      setPasteValue('');
      setParsedPreview([]);
      setDetectedHub(null);
    } catch (err: any) {
      Alert.alert('Import Failed', err.message);
    } finally { setIsImporting(false); }
  };

  const handlePublish = async (id: string) => {
    const { error } = await supabase.from(selectedHub.targetTable).update({ status: 'published' }).eq('id', id);
    if (error) Alert.alert('Error', error.message);
    else { Alert.alert('Published!'); fetchItems(); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete?', 'Permanently delete this item?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from(selectedHub.targetTable).delete().eq('id', id);
        if (error) Alert.alert('Error', error.message); else fetchItems();
      }},
    ]);
  };

  // Bulk Operations
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkPublish = async () => {
    if (selectedIds.size === 0) return;
    try {
      const { error } = await supabase.from(selectedHub.targetTable)
        .update({ status: 'published' })
        .in('id', Array.from(selectedIds));
      if (error) throw error;
      Alert.alert('Success', `Published ${selectedIds.size} draft items!`);
      fetchItems();
      setBulkMode(false);
      setSelectedIds(new Set());
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    Alert.alert('Delete selected?', `Permanently delete all ${selectedIds.size} selected items?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete All', style: 'destructive', onPress: async () => {
        try {
          const { error } = await supabase.from(selectedHub.targetTable)
            .delete()
            .in('id', Array.from(selectedIds));
          if (error) throw error;
          Alert.alert('Success', `Deleted ${selectedIds.size} items!`);
          fetchItems();
          setBulkMode(false);
          setSelectedIds(new Set());
        } catch (e: any) { Alert.alert('Error', e.message); }
      }}
    ]);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setEditActiveTab('edit');
    setActivePreviewAnswerIndex(0);
    setDeletedAnswerIds([]);
    
    const vals: Record<string, any> = {};
    selectedHub.formFields.forEach(f => {
      let dbKey = f.name;
      if (selectedHub.id === 'mains_questions') {
        if (f.name === 'questionText') dbKey = 'question_text';
        else if (f.name === 'year') dbKey = 'exam_year';
        else if (f.name === 'sectionGroup') dbKey = 'section_group';
        else if (f.name === 'microTopic') dbKey = 'microtopic';
        else if (f.name === 'subTopic') dbKey = 'subtopic';
      }
      vals[f.name] = item[dbKey] !== undefined ? item[dbKey] : '';
    });
    setEditFormValues(vals);

    if (selectedHub.id === 'mains_questions') {
      setEditingAnswers(item.mains_answers ? item.mains_answers.map((a: any) => ({ ...a })) : []);
    } else {
      setEditingAnswers([]);
    }

    // Pre-fill JSON tab with the raw item snapshot
    setEditJsonText(JSON.stringify({
      ...vals,
      ...(selectedHub.id === 'mains_questions' ? {
        answers: (item.mains_answers || []).map((a: any) => ({
          institute: a.institute,
          answer_text: a.answer_text,
        }))
      } : {})
    }, null, 2));
    setEditJsonError('');

    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setIsSavingEdit(true);
    try {
      const rawData: Record<string, any> = {};
      selectedHub.formFields.forEach(f => {
        const v = editFormValues[f.name];
        rawData[f.name] = f.type === 'boolean' ? (v === 'true' || v === true) : v;
      });

      const sanitized = sanitizeItemForDatabase({ ...editingItem, ...rawData }, selectedHub);
      delete sanitized.id;
      delete sanitized.created_at;
      delete sanitized.updated_at;
      
      const { error } = await supabase.from(selectedHub.targetTable).update(sanitized).eq('id', editingItem.id);
      if (error) throw error;

      // Question Bank relation sync
      if (selectedHub.id === 'mains_questions') {
        // 1. Remove deleted answers
        if (deletedAnswerIds.length > 0) {
          const { error: delErr } = await supabase.from('mains_answers').delete().in('id', deletedAnswerIds);
          if (delErr) throw delErr;
        }

        // 2. Insert/Update active answers
        for (let idx = 0; idx < editingAnswers.length; idx++) {
          const ans = editingAnswers[idx];
          if (ans.id) {
            // Update
            const { error: updErr } = await supabase.from('mains_answers').update({
              institute: ans.institute,
              answer_text: ans.answer_text
            }).eq('id', ans.id);
            if (updErr) throw updErr;
          } else {
            // Insert
            const newId = `${editingItem.id}-${ans.institute || 'model'}-${Date.now()}-${idx}`;
            const { error: insErr } = await supabase.from('mains_answers').insert({
              id: newId,
              question_id: editingItem.id,
              institute: ans.institute || 'Model Answer',
              answer_text: ans.answer_text
            });
            if (insErr) throw insErr;
          }
        }
      }

      Alert.alert('Saved');
      setEditModalVisible(false);
      fetchItems();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setIsSavingEdit(false); }
  };

  const handlePickImage = async () => {
    setIsUploadingImage(true);
    try {
      const asset = await r2UploadService.pickImage();
      if (!asset) return;
      const res = await r2UploadService.uploadImage(asset, `VA_uploads/${selectedHub.id}`);
      if (res.success && res.publicUrl) {
        await Clipboard.setStringAsync(res.publicUrl);
        Alert.alert('Uploaded!', 'CDN link copied:\n' + res.publicUrl);
      } else Alert.alert('Failed', res.error || 'Unknown error');
    } catch (e) { Alert.alert('Error', (e as Error).message); }
    finally { setIsUploadingImage(false); }
  };

  const hubInUse = detectedHub || selectedHub;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {headerBlock}
      {tabSelector}

      {/* ── Compact Toolbar Row ── */}
      <View style={[styles.compactToolbar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => setHubModalVisible(true)}
          style={[styles.hubPickerBtn, { borderColor: colors.border }]}
        >
          <Database size={12} color={colors.primary} />
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textPrimary, flex: 1, marginRight: 4 }} numberOfLines={1}>
            {selectedHub.displayName}
          </Text>
          <ChevronDown size={11} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* Toggle Sidebar Filter Button */}
        {activeSubTab !== 'import' && (
          <TouchableOpacity 
            onPress={() => setSidebarOpen(s => !s)} 
            style={[styles.toolbarActionBtn, { 
              borderColor: sidebarOpen ? colors.primary : colors.border, 
              borderWidth: 1, 
              backgroundColor: sidebarOpen ? colors.primary + '15' : 'transparent' 
            }]}
          >
            <Text style={{ fontSize: 10.5, fontWeight: '800', color: sidebarOpen ? colors.primary : colors.textPrimary }}>
              {sidebarOpen ? '✕ Filters' : '🔍 Filters'}
            </Text>
          </TouchableOpacity>
        )}

        {/* AI Prompt Button */}
        <TouchableOpacity 
          onPress={() => setShowPromptModal(true)} 
          style={[styles.toolbarActionBtn, { backgroundColor: colors.primary + '15' }]}
        >
          <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.primary }}>✦ AI Prompt</Text>
        </TouchableOpacity>

        {/* Diagram Picker */}
        <TouchableOpacity 
          onPress={handlePickImage} 
          disabled={isUploadingImage} 
          style={[styles.toolbarActionBtn, { borderColor: colors.border, borderWidth: 1 }]}
        >
          <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.textPrimary }}>📸 Diagram</Text>
        </TouchableOpacity>

        {/* Bulk Select Mode Toggle */}
        <TouchableOpacity 
          onPress={() => {
            setBulkMode(b => !b);
            setSelectedIds(new Set());
          }} 
          style={[styles.toolbarActionBtn, { 
            borderColor: bulkMode ? colors.primary : colors.border, 
            borderWidth: 1, 
            backgroundColor: bulkMode ? colors.primary + '15' : 'transparent' 
          }]}
        >
          <Text style={{ fontSize: 10.5, fontWeight: '800', color: bulkMode ? colors.primary : colors.textPrimary }}>
            {bulkMode ? '✕ Cancel' : '☑ Select'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Sub-tabs ── */}
      <View style={[styles.subTabSegmentRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {(['import', 'staging', 'live'] as const).map(tab => {
          const active = activeSubTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveSubTab(tab)}
              style={[styles.subTabSegmentBtn, active && { borderBottomColor: colors.primary }]}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: active ? colors.primary : colors.textTertiary }}>
                {tab === 'import' ? '⬆ Import Source' : tab === 'staging' ? '📥 Staging Drafts' : '✅ Live Content'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Hierarchy clipboard Quick Copiers (Only in import) ── */}
      {activeSubTab === 'import' && (
        <View style={[styles.hierarchyBar, { backgroundColor: colors.surfaceStrong, borderBottomColor: colors.border }]}>
          <Text style={{ fontSize: 9.5, fontWeight: '800', color: colors.textTertiary, marginRight: 6 }}>HIERARCHY COPIERS:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              { label: 'GS 1-4', text: gsHierarchyMd },
              { label: 'Anthro P1', text: anthroPaper1Text },
              { label: 'Anthro P2', text: anthroPaper2Text },
            ].map(h => {
              const copied = copiedKey === h.label;
              return (
                <TouchableOpacity
                  key={h.label}
                  onPress={() => handleCopyHierarchy(h.text, h.label)}
                  style={[styles.hierarchyBtn, { backgroundColor: copied ? '#22c55e15' : colors.surface, borderColor: copied ? '#22c55e' : colors.border }]}
                >
                  {copied ? <Check size={10} color="#22c55e" /> : <CopyIcon size={10} color={colors.textSecondary} />}
                  <Text style={{ fontSize: 10, fontWeight: '700', color: copied ? '#22c55e' : colors.textSecondary }}>{copied ? 'Copied' : h.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Split layout: Collapsible Sidebar + Main Content List */}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* Left Sidebar drawer */}
        {sidebarOpen && activeSubTab !== 'import' && (
          <View style={{ width: 250, borderRightWidth: 0.5, borderRightColor: colors.border, backgroundColor: colors.surface }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 40 }} nestedScrollEnabled>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ fontSize: 10, fontWeight: '900', color: colors.textTertiary, letterSpacing: 0.5 }}>RELATIONAL FILTERS</Text>
                <TouchableOpacity onPress={() => setSidebarOpen(false)}><X size={14} color={colors.textTertiary} /></TouchableOpacity>
              </View>

              {/* PYQ Switcher */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 9.5, fontWeight: '800', color: colors.textTertiary, marginBottom: 5 }}>PYQ STATUS</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {(['all', 'pyq', 'non_pyq'] as const).map(mode => {
                    const active = filterPyq === mode;
                    return (
                      <TouchableOpacity
                        key={mode}
                        onPress={() => setFilterPyq(mode)}
                        style={{
                          flex: 1,
                          backgroundColor: active ? colors.primary : colors.surface,
                          borderWidth: 1,
                          borderColor: active ? colors.primary : colors.border,
                          borderRadius: 6,
                          paddingVertical: 5,
                          alignItems: 'center'
                        }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: '800', color: active ? '#fff' : colors.textSecondary }}>
                          {mode === 'all' ? 'All' : mode === 'pyq' ? 'PYQ' : 'Non'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Institute Answer Filter */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 9.5, fontWeight: '800', color: colors.textTertiary, marginBottom: 5 }}>INSTITUTE ANSWER</Text>
                <HierarchyFilter label="🏢 Select Institute" value={filterInstitute} options={instituteOpts} onSelect={setFilterInstitute} colors={colors} />
              </View>

              {/* Program Name Filter */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 9.5, fontWeight: '800', color: colors.textTertiary, marginBottom: 5 }}>PROGRAM NAME</Text>
                <HierarchyFilter label="🎓 Select Program" value={filterProgram} options={programOpts} onSelect={setFilterProgram} colors={colors} />
              </View>

              {/* Ethics Type Tag Filters */}
              {selectedHub.id.startsWith('mains_ethics_') && (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ fontSize: 9.5, fontWeight: '800', color: colors.textTertiary, marginBottom: 5 }}>ETHICS TYPE</Text>
                  {['All', 'keyword', 'diagram', 'dimension', 'comparison', 'innovation', 'pyq_quote', 'situation'].map(type => {
                    const active = (filterEthicsType || 'All') === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        onPress={() => setFilterEthicsType(type === 'All' ? '' : type)}
                        style={{
                          backgroundColor: active ? '#8b5cf6' : colors.surface,
                          borderWidth: 1,
                          borderColor: active ? '#8b5cf6' : colors.border,
                          borderRadius: 6,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          marginBottom: 4
                        }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: '800', color: active ? '#fff' : colors.textSecondary, textTransform: 'uppercase' }}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {/* Right main pane */}
        <View style={{ flex: 1 }}>
          {/* Cascading Horizontal Pills Row (Only in Staging or Live view) */}
          {activeSubTab !== 'import' && (
            <View style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', gap: 6 }}>
                {/* Browse Topics button */}
                <TouchableOpacity
                  onPress={() => setHierarchyModalVisible(true)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#3b82f6',
                    borderRadius: 20,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    backgroundColor: (filterPaper || filterSubject) ? '#3b82f6' : 'transparent'
                  }}
                >
                  <BookOpen size={11} color={(filterPaper || filterSubject) ? '#fff' : '#3b82f6'} style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: (filterPaper || filterSubject) ? '#fff' : colors.textSecondary }}>
                    {(filterNanotopic || filterSubtopic || filterMicro || filterSection || filterSubject || filterPaper || 'Browse Topics')}
                  </Text>
                  <ChevronDown size={11} color={(filterPaper || filterSubject) ? '#fff' : colors.textTertiary} style={{ marginLeft: 4 }} />
                </TouchableOpacity>

                <View style={{ width: 1, height: 14, backgroundColor: colors.border }} />

                {/* Level 1: Paper Selector */}
                {!filterPaper ? (
                  paperOpts.filter(p => p !== 'All').map(p => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => { setFilterPaper(p); setFilterSubject(''); setFilterSection(''); setFilterMicro(''); setFilterSubtopic(''); setFilterNanotopic(''); }}
                      style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.surface }}
                    >
                      <Text style={{ fontSize: 10, color: colors.textSecondary }}>{p}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={() => { setFilterPaper(''); setFilterSubject(''); setFilterSection(''); setFilterMicro(''); setFilterSubtopic(''); setFilterNanotopic(''); }}
                      style={{ borderWidth: 1, borderColor: '#ef4444', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fee2e2' }}
                    >
                      <Text style={{ fontSize: 10, color: '#ef4444', fontWeight: '800' }}>📄 Paper: {filterPaper} ✕</Text>
                    </TouchableOpacity>

                    {/* Level 2: Subject */}
                    {!filterSubject ? (
                      subjectOpts.map(sub => (
                        <TouchableOpacity
                          key={sub}
                          onPress={() => { setFilterSubject(sub); setFilterSection(''); setFilterMicro(''); setFilterSubtopic(''); setFilterNanotopic(''); }}
                          style={{ borderWidth: 1, borderColor: '#8b5cf6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.surface }}
                        >
                          <Text style={{ fontSize: 10, color: '#8b5cf6' }}>{sub}</Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <>
                        <TouchableOpacity
                          onPress={() => { setFilterSubject(''); setFilterSection(''); setFilterMicro(''); setFilterSubtopic(''); setFilterNanotopic(''); }}
                          style={{ borderWidth: 1, borderColor: '#ef4444', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fee2e2' }}
                        >
                          <Text style={{ fontSize: 10, color: '#ef4444', fontWeight: '800' }}>📚 Subject: {filterSubject} ✕</Text>
                        </TouchableOpacity>

                        {/* Level 3: Section Group */}
                        {!filterSection ? (
                          sectionOpts.map(sec => (
                            <TouchableOpacity
                              key={sec}
                              onPress={() => { setFilterSection(sec); setFilterMicro(''); setFilterSubtopic(''); setFilterNanotopic(''); }}
                              style={{ borderWidth: 1, borderColor: '#f59e0b', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.surface }}
                            >
                              <Text style={{ fontSize: 10, color: '#f59e0b' }}>{sec}</Text>
                            </TouchableOpacity>
                          ))
                        ) : (
                          <>
                            <TouchableOpacity
                              onPress={() => { setFilterSection(''); setFilterMicro(''); setFilterSubtopic(''); setFilterNanotopic(''); }}
                              style={{ borderWidth: 1, borderColor: '#ef4444', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fee2e2' }}
                            >
                              <Text style={{ fontSize: 10, color: '#ef4444', fontWeight: '800' }}>📁 Section: {filterSection} ✕</Text>
                            </TouchableOpacity>

                            {/* Level 4: Microtopic */}
                            {!filterMicro ? (
                              microOpts.map(mt => (
                                <TouchableOpacity
                                  key={mt}
                                  onPress={() => { setFilterMicro(mt); setFilterSubtopic(''); setFilterNanotopic(''); }}
                                  style={{ borderWidth: 1, borderColor: '#10b981', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.surface }}
                                >
                                  <Text style={{ fontSize: 10, color: '#10b981' }}>{mt}</Text>
                                </TouchableOpacity>
                              ))
                            ) : (
                              <>
                                <TouchableOpacity
                                  onPress={() => { setFilterMicro(''); setFilterSubtopic(''); setFilterNanotopic(''); }}
                                  style={{ borderWidth: 1, borderColor: '#ef4444', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fee2e2' }}
                                >
                                  <Text style={{ fontSize: 10, color: '#ef4444', fontWeight: '800' }}>🔍 Micro: {filterMicro} ✕</Text>
                                </TouchableOpacity>

                                {/* Level 5: Subtopic */}
                                {!filterSubtopic ? (
                                  subtopicOpts.map(st => (
                                    <TouchableOpacity
                                      key={st}
                                      onPress={() => { setFilterSubtopic(st); setFilterNanotopic(''); }}
                                      style={{ borderWidth: 1, borderColor: '#3b82f6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.surface }}
                                    >
                                      <Text style={{ fontSize: 10, color: '#3b82f6' }}>{st}</Text>
                                    </TouchableOpacity>
                                  ))
                                ) : (
                                  <>
                                    <TouchableOpacity
                                      onPress={() => { setFilterSubtopic(''); setFilterNanotopic(''); }}
                                      style={{ borderWidth: 1, borderColor: '#ef4444', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fee2e2' }}
                                    >
                                      <Text style={{ fontSize: 10, color: '#ef4444', fontWeight: '800' }}>📌 Sub: {filterSubtopic} ✕</Text>
                                    </TouchableOpacity>

                                    {/* Level 6: Nanotopic (Optionals only) */}
                                    {filterPaper === 'Optional' && (
                                      !filterNanotopic ? (
                                        nanotopicOpts.map(nt => (
                                          <TouchableOpacity
                                            key={nt}
                                            onPress={() => setFilterNanotopic(nt)}
                                            style={{ borderWidth: 1, borderColor: '#ec4899', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.surface }}
                                          >
                                            <Text style={{ fontSize: 10, color: '#ec4899' }}>{nt}</Text>
                                          </TouchableOpacity>
                                        ))
                                      ) : (
                                        <TouchableOpacity
                                          onPress={() => setFilterNanotopic('')}
                                          style={{ borderWidth: 1, borderColor: '#ef4444', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fee2e2' }}
                                        >
                                          <Text style={{ fontSize: 10, color: '#ef4444', fontWeight: '800' }}>🌸 Nano: {filterNanotopic} ✕</Text>
                                        </TouchableOpacity>
                                      )
                                    )}
                                  </>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </ScrollView>
            </View>
          )}

          <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* ══════ IMPORT TAB CONTENT ══════ */}
            {activeSubTab === 'import' && (
              <View>
                {detectedHub && (
                  <TouchableOpacity
                    onPress={() => { setSelectedHub(detectedHub); setDetectedHub(null); }}
                    style={[styles.feedback, { backgroundColor: '#f59e0b12', borderColor: '#f59e0b', marginBottom: 8 }]}
                  >
                    <Text style={{ fontSize: 11, color: '#b45309', flex: 1 }}>
                      🔍 Detected: <Text style={{ fontWeight: '800' }}>{detectedHub.displayName}</Text> hub — tap to switch hub automatically
                    </Text>
                  </TouchableOpacity>
                )}

                {parseError && (
                  <View style={[styles.feedback, { backgroundColor: '#ef444412', borderColor: '#ef4444', marginBottom: 6 }]}>
                    <AlertTriangle size={13} color="#ef4444" />
                    <Text style={{ fontSize: 11, color: '#ef4444', flex: 1 }}>{parseError}</Text>
                  </View>
                )}
                {importSuccess && (
                  <View style={[styles.feedback, { backgroundColor: '#22c55e12', borderColor: '#22c55e', marginBottom: 6 }]}>
                    <CheckCircle size={13} color="#22c55e" />
                    <Text style={{ fontSize: 11, color: '#22c55e', fontWeight: '800', flex: 1 }}>{importSuccess}</Text>
                  </View>
                )}
                {parsedPreview.length > 0 && (
                  <View style={[styles.feedback, { backgroundColor: '#22c55e08', borderColor: '#22c55e40', marginBottom: 8 }]}>
                    <CheckCircle size={13} color="#22c55e" />
                    <Text style={{ fontSize: 11, color: '#22c55e', fontWeight: '800' }}>
                      {parsedPreview.length} card{parsedPreview.length > 1 ? 's' : ''} ready · Hub: {hubInUse.displayName}
                    </Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginBottom: 5 }]}>JSON SOURCE</Text>
                    <TextInput
                      multiline
                      placeholder="Paste AI-generated JSON array here..."
                      placeholderTextColor={colors.textTertiary}
                      value={pasteValue}
                      onChangeText={setPasteValue}
                      style={[styles.jsonInputTrigger, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginBottom: 5 }]}>LIVE PREVIEW</Text>
                    {parsedPreview.length === 0 ? (
                      <View style={[styles.previewPlaceholder, { borderColor: colors.border, backgroundColor: colors.background }]}>
                        <Text style={{ fontSize: 10, color: colors.textTertiary, textAlign: 'center', fontStyle: 'italic', lineHeight: 16 }}>
                          Paste JSON output here{'\n'}preview renders in real{'\n'}card layouts instantly
                        </Text>
                      </View>
                    ) : (
                      <View>
                        {parsedPreview.map((item, idx) => (
                          <View key={idx} style={{ marginBottom: 16 }}>
                            {parsedPreview.length > 1 && (
                              <View style={{ backgroundColor: colors.primary + '10', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6, alignSelf: 'flex-start' }}>
                                <Text style={{ fontSize: 9, fontWeight: '800', color: colors.primary }}>CARD {idx + 1} / {parsedPreview.length}</Text>
                              </View>
                            )}
                            <HubCardPreview item={item} hub={hubInUse} colors={colors} />
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleImport}
                  disabled={isImporting || parsedPreview.length === 0}
                  style={[styles.importBtn, { backgroundColor: parsedPreview.length > 0 && !isImporting ? colors.primary : colors.border, marginTop: 16 }]}
                >
                  {isImporting
                    ? <ActivityIndicator size={16} color="#FFF" />
                    : <Text style={styles.importBtnText}>
                        {parsedPreview.length > 0
                          ? `Validate & Import ${parsedPreview.length} Card${parsedPreview.length > 1 ? 's' : ''} → Staging`
                          : 'Validate & Import to Staging'}
                      </Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* ══════ STAGING TAB CONTENT ══════ */}
            {activeSubTab === 'staging' && (
              <View>
                <View style={[styles.searchBox, { borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 10 }]}>
                  <Search size={14} color={colors.textTertiary} />
                  <TextInput placeholder="Search drafts…" placeholderTextColor={colors.textTertiary} value={liveSearch} onChangeText={setLiveSearch} style={{ flex: 1, color: colors.textPrimary, paddingLeft: 6, fontSize: 13 }} />
                  {liveSearch.length > 0 && <TouchableOpacity onPress={() => setLiveSearch('')}><X size={13} color={colors.textTertiary} /></TouchableOpacity>}
                </View>

                {loadingItems
                  ? <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
                  : filteredItems.length === 0
                    ? <Text style={{ textAlign: 'center', color: colors.textTertiary, fontStyle: 'italic', marginTop: 30 }}>No draft items.</Text>
                    : (
                      <View>
                        <Text style={{ fontSize: 10, color: colors.textTertiary, marginBottom: 6 }}>
                          {filteredItems.length} of {itemList.length} drafts {bulkMode ? `(Selected: ${selectedIds.size})` : ''}
                        </Text>
                        {filteredItems.map(item => (
                          <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {bulkMode && (
                              <TouchableOpacity 
                                onPress={() => toggleSelect(item.id)} 
                                style={{
                                  marginRight: 10,
                                  width: 20,
                                  height: 20,
                                  borderRadius: 6,
                                  borderWidth: 2,
                                  borderColor: selectedIds.has(item.id) ? colors.primary : colors.border,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: selectedIds.has(item.id) ? colors.primary : 'transparent'
                                }}
                              >
                                {selectedIds.has(item.id) && <Check size={12} color="#fff" strokeWidth={3} />}
                              </TouchableOpacity>
                            )}
                            <View style={{ flex: 1 }}>
                              <ItemCard item={item} colors={colors} isStaging
                                onPublish={() => handlePublish(item.id)}
                                onEdit={() => handleOpenEdit(item)}
                                onDelete={() => handleDelete(item.id)}
                              />
                            </View>
                          </View>
                        ))}

                        {/* Staging Load More */}
                        {hasMore && (
                          <TouchableOpacity 
                            onPress={() => fetchItems(false)} 
                            disabled={loadingMore}
                            style={{
                              margin: 16,
                              paddingVertical: 12,
                              backgroundColor: colors.surfaceStrong,
                              borderColor: colors.border,
                              borderWidth: 1,
                              borderRadius: 10,
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {loadingMore ? (
                              <ActivityIndicator size={16} color={colors.primary} />
                            ) : (
                              <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.primary }}>
                                Load More Items
                              </Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
              </View>
            )}

            {/* ══════ LIVE TAB CONTENT ══════ */}
            {activeSubTab === 'live' && (
              <View>
                <View style={[styles.searchBox, { borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 8 }]}>
                  <Search size={14} color={colors.textTertiary} />
                  <TextInput placeholder="Search live items…" placeholderTextColor={colors.textTertiary} value={liveSearch} onChangeText={setLiveSearch} style={{ flex: 1, color: colors.textPrimary, paddingLeft: 6, fontSize: 13 }} />
                  {liveSearch.length > 0 && <TouchableOpacity onPress={() => setLiveSearch('')}><X size={13} color={colors.textTertiary} /></TouchableOpacity>}
                </View>
                
                <Text style={{ fontSize: 10, color: colors.textTertiary, marginBottom: 6 }}>
                  {filteredItems.length} of {itemList.length} items {bulkMode ? `(Selected: ${selectedIds.size})` : ''}
                </Text>

                {loadingItems
                  ? <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
                  : filteredItems.length === 0
                    ? <Text style={{ textAlign: 'center', color: colors.textTertiary, fontStyle: 'italic', marginTop: 30 }}>No items match.</Text>
                    : (
                      <View>
                        {filteredItems.map(item => (
                          <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {bulkMode && (
                              <TouchableOpacity 
                                onPress={() => toggleSelect(item.id)} 
                                style={{
                                  marginRight: 10,
                                  width: 20,
                                  height: 20,
                                  borderRadius: 6,
                                  borderWidth: 2,
                                  borderColor: selectedIds.has(item.id) ? colors.primary : colors.border,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: selectedIds.has(item.id) ? colors.primary : 'transparent'
                                }}
                              >
                                {selectedIds.has(item.id) && <Check size={12} color="#fff" strokeWidth={3} />}
                              </TouchableOpacity>
                            )}
                            <View style={{ flex: 1 }}>
                              <ItemCard item={item} colors={colors} isStaging={false}
                                onPublish={() => {}} onEdit={() => handleOpenEdit(item)} onDelete={() => handleDelete(item.id)}
                              />
                            </View>
                          </View>
                        ))}

                        {/* Live Load More */}
                        {hasMore && (
                          <TouchableOpacity 
                            onPress={() => fetchItems(false)} 
                            disabled={loadingMore}
                            style={{
                              margin: 16,
                              paddingVertical: 12,
                              backgroundColor: colors.surfaceStrong,
                              borderColor: colors.border,
                              borderWidth: 1,
                              borderRadius: 10,
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {loadingMore ? (
                              <ActivityIndicator size={16} color={colors.primary} />
                            ) : (
                              <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.primary }}>
                                Load More Items
                              </Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* ── BROWSE HIERARCHY SELECTOR MODAL ── */}
      <Modal visible={hierarchyModalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.surface, height: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: colors.textPrimary }}>Browse Syllabus Topics</Text>
              <TouchableOpacity onPress={() => setHierarchyModalVisible(false)}><X size={20} color={colors.textTertiary} /></TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, paddingHorizontal: 4 }} showsVerticalScrollIndicator={false}>
              {Object.entries(syllabusData).map(([paper, subMap]) => {
                const isPaperExpanded = !!expandedKeys[paper];
                return (
                  <View key={paper} style={{ marginBottom: 10 }}>
                    <TouchableOpacity
                      onPress={() => setExpandedKeys(prev => ({ ...prev, [paper]: !prev[paper] }))}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: isPaperExpanded ? `${colors.primary}10` : 'transparent',
                        padding: 8,
                        borderRadius: 8,
                        marginBottom: 4
                      }}
                    >
                      <ChevronRight size={16} color={colors.primary} style={{ transform: [{ rotate: isPaperExpanded ? '90deg' : '0deg' }], marginRight: 6 }} />
                      <Text style={{ fontSize: 13, fontWeight: '900', color: colors.primary }}>{paper}</Text>
                    </TouchableOpacity>

                    {isPaperExpanded && Object.entries(subMap).map(([subject, secMap]) => {
                      const subjectKey = `${paper}|${subject}`;
                      const isSubjectExpanded = !!expandedKeys[subjectKey];
                      return (
                        <View key={subject} style={{ paddingLeft: 12, borderLeftWidth: 1.5, borderLeftColor: colors.border, marginBottom: 6, marginLeft: 8 }}>
                          <TouchableOpacity
                            onPress={() => setExpandedKeys(prev => ({ ...prev, [subjectKey]: !prev[subjectKey] }))}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 4
                            }}
                          >
                            <ChevronRight size={14} color={colors.textPrimary} style={{ transform: [{ rotate: isSubjectExpanded ? '90deg' : '0deg' }], marginRight: 4 }} />
                            <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.textPrimary }}>{subject}</Text>
                          </TouchableOpacity>

                          {isSubjectExpanded && Object.entries(secMap).map(([section, microMap]) => {
                            const sectionKey = `${subjectKey}|${section}`;
                            const isSectionExpanded = !!expandedKeys[sectionKey];
                            return (
                              <View key={section} style={{ paddingLeft: 12, marginBottom: 4 }}>
                                <TouchableOpacity
                                  onPress={() => setExpandedKeys(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 3
                                  }}
                                >
                                  <ChevronRight size={12} color={colors.textSecondary} style={{ transform: [{ rotate: isSectionExpanded ? '90deg' : '0deg' }], marginRight: 4 }} />
                                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.textSecondary }}>📁 {section}</Text>
                                </TouchableOpacity>

                                {isSectionExpanded && Object.entries(microMap).map(([micro, node]) => {
                                  const microKey = `${sectionKey}|${micro}`;
                                  const isMicroExpanded = !!expandedKeys[microKey];
                                  const hasSubtopics = node.subtopics && node.subtopics.length > 0;
                                  return (
                                    <View key={micro} style={{ paddingLeft: 12, marginBottom: 2 }}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        {hasSubtopics && (
                                          <TouchableOpacity
                                            onPress={() => setExpandedKeys(prev => ({ ...prev, [microKey]: !prev[microKey] }))}
                                            style={{ padding: 4 }}
                                          >
                                            <ChevronRight size={10} color={colors.textTertiary} style={{ transform: [{ rotate: isMicroExpanded ? '90deg' : '0deg' }] }} />
                                          </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                          onPress={() => {
                                            setFilterPaper(paper);
                                            setFilterSubject(subject);
                                            setFilterSection(section);
                                            setFilterMicro(micro);
                                            setFilterSubtopic('');
                                            setFilterNanotopic('');
                                            setHierarchyModalVisible(false);
                                          }}
                                          style={{ flex: 1, paddingVertical: 2, paddingLeft: hasSubtopics ? 0 : 12 }}
                                        >
                                          <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textTertiary }}>🔍 {micro}</Text>
                                        </TouchableOpacity>
                                      </View>

                                      {isMicroExpanded && hasSubtopics && node.subtopics.map(sub => (
                                        <TouchableOpacity
                                          key={sub}
                                          onPress={() => {
                                            setFilterPaper(paper);
                                            setFilterSubject(subject);
                                            setFilterSection(section);
                                            setFilterMicro(micro);
                                            setFilterSubtopic(sub);
                                            setFilterNanotopic('');
                                            setHierarchyModalVisible(false);
                                          }}
                                          style={{ paddingLeft: 24, paddingVertical: 2 }}
                                        >
                                          <Text style={{ fontSize: 9.5, color: '#3b82f6', textDecorationLine: 'underline' }}>📌 {sub}</Text>
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  );
                                })}
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══════ EDIT MODAL (With Relational Question Editor Modal + Live Markdown Preview Tab) ══════ */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.overlay}>
            <View style={[styles.sheet, { backgroundColor: colors.surface, height: '85%' }]}>
              <View style={styles.modalHeader}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: colors.textPrimary }}>
                  Edit {selectedHub.id === 'mains_questions' ? 'Question Bank Card' : 'Card'}
                </Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}><X size={20} color={colors.textTertiary} /></TouchableOpacity>
              </View>

              {selectedHub.id === 'mains_questions' ? (
                // ── RELATIONAL QUESTION BANK EDITOR LAYOUT ──
                <View style={{ flex: 1, minHeight: 380 }}>
                  {/* Segmented controls: Edit vs Preview */}
                  <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 12 }}>
                    <TouchableOpacity 
                      onPress={() => setEditActiveTab('edit')} 
                      style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: editActiveTab === 'edit' ? colors.primary : 'transparent' }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '800', color: editActiveTab === 'edit' ? colors.primary : colors.textTertiary }}>✏️ Edit Fields</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => setEditActiveTab('json')} 
                      style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: editActiveTab === 'json' ? '#f59e0b' : 'transparent' }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '800', color: editActiveTab === 'json' ? '#f59e0b' : colors.textTertiary }}>{'{ }'} JSON</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => setEditActiveTab('preview')} 
                      style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: editActiveTab === 'preview' ? colors.primary : 'transparent' }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '800', color: editActiveTab === 'preview' ? colors.primary : colors.textTertiary }}>👁️ Preview</Text>
                    </TouchableOpacity>
                  </View>

                  {editActiveTab === 'json' ? (
                    // ── JSON PASTE EDITOR TAB ──
                    <View style={{ flex: 1, marginBottom: 12 }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, marginBottom: 6 }}>
                        Paste ChatGPT JSON below — all fields + answers array will be applied.
                      </Text>
                      <TextInput
                        multiline
                        value={editJsonText}
                        onChangeText={t => { setEditJsonText(t); setEditJsonError(''); }}
                        style={[
                          styles.formInput,
                          { color: '#10b981', backgroundColor: '#0f172a', fontFamily: 'monospace',
                            fontSize: 11, minHeight: 260, flex: 1, borderColor: editJsonError ? '#ef4444' : '#334155' }
                        ]}
                        placeholder={'{\n  "questionText": "...",\n  "marks": "15",\n  "paper": "GS2",\n  "answers": [{ "institute": "Vision IAS", "answer_text": "..." }]\n}'}
                        placeholderTextColor="#475569"
                        autoCorrect={false}
                        autoCapitalize="none"
                      />
                      {!!editJsonError && (
                        <Text style={{ color: '#ef4444', fontSize: 10, marginTop: 4 }}>⚠️ {editJsonError}</Text>
                      )}
                      <TouchableOpacity
                        onPress={async () => {
                          await Clipboard.setStringAsync(editJsonText);
                          Alert.alert('Copied', 'JSON copied to clipboard!');
                        }}
                        style={[styles.importBtn, { backgroundColor: colors.border, marginTop: 10, marginBottom: 4 }]}
                      >
                        <Text style={[styles.importBtnText, { color: colors.textPrimary }]}>📋 Copy JSON to Clipboard</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          try {
                            const parsed = JSON.parse(editJsonText);
                            // Apply scalar fields to editFormValues
                            const newVals: Record<string, any> = { ...editFormValues };
                            Object.keys(parsed).forEach(key => {
                              if (key !== 'answers' && key !== 'mains_answers') {
                                newVals[key] = parsed[key];
                              }
                            });
                            setEditFormValues(newVals);
                            // Apply answers array if present
                            const ans = parsed.answers || parsed.mains_answers;
                            if (Array.isArray(ans)) {
                              setEditingAnswers(ans.map((a: any, i: number) => ({
                                id: (editingAnswers[i] || {}).id || undefined,
                                institute: a.institute || a.source || `Answer ${i + 1}`,
                                answer_text: a.answer_text || a.answerText || a.text || '',
                              })));
                            }
                            setEditJsonError('');
                            setEditActiveTab('edit'); // switch to field view to confirm
                          } catch (e: any) {
                            setEditJsonError(e.message);
                          }
                        }}
                        style={[styles.importBtn, { backgroundColor: '#f59e0b', marginTop: 4 }]}
                      >
                        <Text style={styles.importBtnText}>⚡ Apply JSON → Fields</Text>
                      </TouchableOpacity>
                    </View>
                  ) : editActiveTab === 'edit' ? (
                    <ScrollView style={{ flex: 1, marginBottom: 12 }} showsVerticalScrollIndicator={false}>
                      {/* Question Text */}
                      <View style={{ marginBottom: 10 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, marginBottom: 3 }}>Question Text *</Text>
                        <TextInput
                          multiline
                          value={editFormValues.questionText || ''}
                          onChangeText={t => setEditFormValues(prev => ({ ...prev, questionText: t }))}
                          style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, minHeight: 80 }]}
                        />
                      </View>

                      {/* Marks, Year & PYQ Status */}
                      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, marginBottom: 3 }}>Marks *</Text>
                          <TextInput
                            value={editFormValues.marks || ''}
                            onChangeText={t => setEditFormValues(prev => ({ ...prev, marks: t }))}
                            style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, minHeight: 36 }]}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, marginBottom: 3 }}>Exam Year *</Text>
                          <TextInput
                            value={editFormValues.year || ''}
                            onChangeText={t => setEditFormValues(prev => ({ ...prev, year: t }))}
                            style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, minHeight: 36 }]}
                          />
                        </View>
                        <View style={{ flex: 1, justifyContent: 'center' }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, marginBottom: 3 }}>Is PYQ?</Text>
                          <TouchableOpacity
                            onPress={() => setEditFormValues(prev => ({ ...prev, is_pyq: !(prev.is_pyq === 'true' || prev.is_pyq === true) }))}
                            style={{
                              backgroundColor: editFormValues.is_pyq === 'true' || editFormValues.is_pyq === true ? '#22c55e' : colors.border,
                              paddingVertical: 8,
                              borderRadius: 8,
                              alignItems: 'center'
                            }}
                          >
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                              {editFormValues.is_pyq === 'true' || editFormValues.is_pyq === true ? 'YES' : 'NO'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Paper, Subject, Section Group */}
                      <View style={{ marginBottom: 10 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, marginBottom: 3 }}>Paper *</Text>
                        <TextInput
                          value={editFormValues.paper || ''}
                          onChangeText={t => setEditFormValues(prev => ({ ...prev, paper: t }))}
                          style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, minHeight: 36 }]}
                        />
                      </View>
                      <View style={{ marginBottom: 10 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, marginBottom: 3 }}>Subject *</Text>
                        <TextInput
                          value={editFormValues.subject || ''}
                          onChangeText={t => setEditFormValues(prev => ({ ...prev, subject: t }))}
                          style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, minHeight: 36 }]}
                        />
                      </View>
                      <View style={{ marginBottom: 10 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, marginBottom: 3 }}>Section Group *</Text>
                        <TextInput
                          value={editFormValues.sectionGroup || ''}
                          onChangeText={t => setEditFormValues(prev => ({ ...prev, sectionGroup: t }))}
                          style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, minHeight: 36 }]}
                        />
                      </View>
                      <View style={{ marginBottom: 10 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, marginBottom: 3 }}>Microtopic</Text>
                        <TextInput
                          value={editFormValues.microTopic || ''}
                          onChangeText={t => setEditFormValues(prev => ({ ...prev, microTopic: t }))}
                          style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, minHeight: 36 }]}
                        />
                      </View>
                      <View style={{ marginBottom: 10 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, marginBottom: 3 }}>Subtopic</Text>
                        <TextInput
                          value={editFormValues.subTopic || ''}
                          onChangeText={t => setEditFormValues(prev => ({ ...prev, subTopic: t }))}
                          style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, minHeight: 36 }]}
                        />
                      </View>
                      <View style={{ marginBottom: 10 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, marginBottom: 3 }}>Nanotopic (5th layer)</Text>
                        <TextInput
                          value={editFormValues.nanotopic || ''}
                          onChangeText={t => setEditFormValues(prev => ({ ...prev, nanotopic: t }))}
                          style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, minHeight: 36 }]}
                        />
                      </View>

                      {/* Relational Answers Editing Section */}
                      <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <Text style={{ fontSize: 12, fontWeight: '900', color: colors.textPrimary }}>Model Answers ({editingAnswers.length})</Text>
                          <TouchableOpacity 
                            onPress={() => setEditingAnswers(prev => [...prev, { institute: 'New Institute', answer_text: '' }])}
                            style={{ backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>+ Add Answer</Text>
                          </TouchableOpacity>
                        </View>

                        {editingAnswers.map((ans, idx) => (
                          <View key={idx} style={{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary }}>Answer #{idx + 1}</Text>
                              <TouchableOpacity 
                                onPress={() => {
                                  if (ans.id) {
                                    setDeletedAnswerIds(prev => [...prev, ans.id]);
                                  }
                                  setEditingAnswers(prev => prev.filter((_, i) => i !== idx));
                                }}
                                style={{ padding: 4 }}
                              >
                                <Trash2 size={13} color="#ef4444" />
                              </TouchableOpacity>
                            </View>
                            <View style={{ marginBottom: 6 }}>
                              <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textTertiary, marginBottom: 2 }}>Institute *</Text>
                              <TextInput
                                value={ans.institute}
                                onChangeText={t => {
                                  const next = [...editingAnswers];
                                  next[idx].institute = t;
                                  setEditingAnswers(next);
                                }}
                                style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, minHeight: 32 }]}
                              />
                            </View>
                            <View>
                              <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textTertiary, marginBottom: 2 }}>Answer Markdown *</Text>
                              <TextInput
                                multiline
                                value={ans.answer_text}
                                onChangeText={t => {
                                  const next = [...editingAnswers];
                                  next[idx].answer_text = t;
                                  setEditingAnswers(next);
                                }}
                                style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, minHeight: 120 }]}
                              />
                            </View>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  ) : (
                    // ── LIVE MARKDOWN RENDERING PREVIEW TAB ──
                    <View style={{ flex: 1, marginBottom: 12 }}>
                      {editingAnswers.length === 0 ? (
                        <Text style={{ fontStyle: 'italic', color: colors.textTertiary, textAlign: 'center', marginTop: 40 }}>No answers drafted yet.</Text>
                      ) : (
                        <View style={{ flex: 1 }}>
                          {/* Horizontal selector for active answer preview */}
                          <View style={{ marginBottom: 8 }}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                              {editingAnswers.map((ans, idx) => {
                                const active = activePreviewAnswerIndex === idx;
                                return (
                                  <TouchableOpacity
                                    key={idx}
                                    onPress={() => setActivePreviewAnswerIndex(idx)}
                                    style={{
                                      paddingHorizontal: 12,
                                      paddingVertical: 6,
                                      borderRadius: 14,
                                      backgroundColor: active ? colors.primary : colors.border,
                                    }}
                                  >
                                    <Text style={{ fontSize: 10, fontWeight: '800', color: active ? '#fff' : colors.textSecondary }}>
                                      {ans.institute || `Answer ${idx + 1}`}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </ScrollView>
                          </View>

                          <ScrollView style={{ flex: 1, backgroundColor: colors.background, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                            <Text style={{ fontSize: 13, fontWeight: '900', color: colors.textPrimary, marginBottom: 12 }}>
                              {editFormValues.questionText}
                            </Text>
                            <Markdown style={getMarkdownStyles(colors)}>
                              {editingAnswers[activePreviewAnswerIndex]?.answer_text || ''}
                            </Markdown>
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              ) : (
                // ── GENERIC CARD METADATA EDITOR ──
                <View style={{ flex: 1, minHeight: 380 }}>
                  {/* Tab bar: Fields | JSON */}
                  <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 12 }}>
                    <TouchableOpacity
                      onPress={() => setEditActiveTab('edit')}
                      style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: editActiveTab === 'edit' ? colors.primary : 'transparent' }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '800', color: editActiveTab === 'edit' ? colors.primary : colors.textTertiary }}>✏️ Edit Fields</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setEditActiveTab('json')}
                      style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: editActiveTab === 'json' ? '#f59e0b' : 'transparent' }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '800', color: editActiveTab === 'json' ? '#f59e0b' : colors.textTertiary }}>{'{ }'} JSON</Text>
                    </TouchableOpacity>
                  </View>

                  {editActiveTab === 'json' ? (
                    <View style={{ flex: 1, marginBottom: 12 }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, marginBottom: 6 }}>
                        Paste ChatGPT JSON — all fields will be applied.
                      </Text>
                      <TextInput
                        multiline
                        value={editJsonText}
                        onChangeText={t => { setEditJsonText(t); setEditJsonError(''); }}
                        style={[
                          styles.formInput,
                          { color: '#10b981', backgroundColor: '#0f172a', fontFamily: 'monospace',
                            fontSize: 11, minHeight: 260, borderColor: editJsonError ? '#ef4444' : '#334155' }
                        ]}
                        placeholder={'{\n  "title": "...",\n  "content": "..."\n}'}
                        placeholderTextColor="#475569"
                        autoCorrect={false}
                        autoCapitalize="none"
                      />
                      {!!editJsonError && (
                        <Text style={{ color: '#ef4444', fontSize: 10, marginTop: 4 }}>⚠️ {editJsonError}</Text>
                      )}
                      <TouchableOpacity
                        onPress={async () => {
                          await Clipboard.setStringAsync(editJsonText);
                          Alert.alert('Copied', 'JSON copied to clipboard!');
                        }}
                        style={[styles.importBtn, { backgroundColor: colors.border, marginTop: 10, marginBottom: 4 }]}
                      >
                        <Text style={[styles.importBtnText, { color: colors.textPrimary }]}>📋 Copy JSON to Clipboard</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          try {
                            const parsed = JSON.parse(editJsonText);
                            const newVals: Record<string, any> = { ...editFormValues };
                            Object.keys(parsed).forEach(key => { newVals[key] = parsed[key]; });
                            setEditFormValues(newVals);
                            setEditJsonError('');
                            setEditActiveTab('edit');
                          } catch (e: any) {
                            setEditJsonError(e.message);
                          }
                        }}
                        style={[styles.importBtn, { backgroundColor: '#f59e0b', marginTop: 4 }]}
                      >
                        <Text style={styles.importBtnText}>⚡ Apply JSON → Fields</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <FlatList
                      data={selectedHub.formFields}
                      keyExtractor={f => f.name}
                      style={{ maxHeight: 380, marginBottom: 12 }}
                      renderItem={({ item: field }) => {
                        const val = editFormValues[field.name] || '';
                        return (
                          <View style={{ marginBottom: 10 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, marginBottom: 3 }}>{field.label}{field.required ? ' *' : ''}</Text>
                            <TextInput
                              multiline={field.type === 'markdown'} numberOfLines={field.type === 'markdown' ? 4 : 1}
                              value={val} onChangeText={t => setEditFormValues(prev => ({ ...prev, [field.name]: t }))}
                              style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, minHeight: field.type === 'markdown' ? 72 : 36 }]}
                            />
                          </View>
                        );
                      }}
                    />
                  )}
                </View>
              )}


              <TouchableOpacity onPress={handleSaveEdit} disabled={isSavingEdit} style={[styles.importBtn, { backgroundColor: colors.primary }]}>
                {isSavingEdit ? <ActivityIndicator size={16} color="#FFF" /> : <Text style={styles.importBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── FLOATING BULK OPERATIONS BOTTOM BAR ── */}
      {bulkMode && selectedIds.size > 0 && (
        <View style={[styles.bulkActionBar, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textPrimary }}>
            {selectedIds.size} Selected
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {activeSubTab === 'staging' && (
              <TouchableOpacity onPress={handleBulkPublish} style={[styles.bulkBtn, { backgroundColor: '#22c55e' }]}>
                <Play size={13} color="#fff" />
                <Text style={styles.bulkBtnText}>Publish</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleBulkDelete} style={[styles.bulkBtn, { backgroundColor: '#ef4444' }]}>
              <Trash2 size={13} color="#fff" strokeWidth={2.5} />
              <Text style={styles.bulkBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── HUB SELECTOR MODAL ── */}
      <Modal visible={hubModalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.surface, height: '70%' }]}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: colors.textPrimary }}>Select Database / Hub</Text>
              <TouchableOpacity onPress={() => setHubModalVisible(false)}><X size={20} color={colors.textTertiary} /></TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {hubRegistry.map((h) => {
                const active = selectedHub.id === h.id;
                return (
                  <TouchableOpacity
                    key={h.id}
                    onPress={() => {
                      setSelectedHub(h);
                      setHubModalVisible(false);
                    }}
                    style={[
                      styles.hubOption,
                      {
                        borderBottomColor: colors.border,
                        backgroundColor: active ? colors.primary + '15' : 'transparent',
                      },
                    ]}
                  >
                    <Database size={15} color={active ? colors.primary : colors.textSecondary} style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: active ? colors.primary : colors.textPrimary }}>
                        {h.displayName}
                      </Text>
                      <Text style={{ fontSize: 9.5, color: colors.textTertiary, marginTop: 1 }}>
                        Table: {h.targetTable}
                      </Text>
                    </View>
                    {active && <Check size={14} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── AI PROMPT EDIT MODAL ── */}
      <Modal visible={showPromptModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.surface, height: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: colors.textPrimary }}>AI Prompt Template</Text>
              <TouchableOpacity onPress={() => setShowPromptModal(false)}><X size={20} color={colors.textTertiary} /></TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <TextInput
                multiline
                style={[
                  styles.promptInput,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.border,
                    backgroundColor: colors.bg,
                  },
                ]}
                value={editablePrompt}
                onChangeText={setEditablePrompt}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => {
                    setEditablePrompt(selectedHub.aiPromptTemplate);
                    Alert.alert('Reset', 'AI Prompt reset to registry default.');
                  }}
                  style={[styles.btn, { flex: 1, backgroundColor: colors.border }]}
                >
                  <Text style={[styles.btnText, { color: colors.textSecondary }]}>Reset to Default</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowPromptModal(false);
                    Alert.alert('Saved', 'AI Prompt template updated for this session.');
                  }}
                  style={[styles.btn, { flex: 1, backgroundColor: colors.primary }]}
                >
                  <Text style={styles.btnText}>Save Prompt</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Reusable item row ──────────────────────────────────────────────────────────
function ItemCard({ item, colors, isStaging, onPublish, onEdit, onDelete }: any) {
  const title = item.question_text || item.questionText || item.card_title || item.title || item.mnemonic_number_title || item.framework_name || 'No Title';
  
  let body = '';
  if (item.question_text || item.questionText) {
    const firstAns = Array.isArray(item.mains_answers) ? item.mains_answers[0] : null;
    body = firstAns ? firstAns.answer_text : 'No answer drafted yet.';
  } else {
    body = item.body || item.content_markdown || item.content || item.explanation_examples || '';
  }

  const preview = body.replace(/[\*\#\>\n]/g, ' ').substring(0, 90);
  
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textPrimary }} numberOfLines={2}>{title}</Text>
        <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }} numberOfLines={2}>{preview}…</Text>
        <View style={{ flexDirection: 'row', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
          {item.paper && <Text style={[styles.chip, { backgroundColor: colors.primary + '12', color: colors.primary }]}>{item.paper}</Text>}
          {item.subject && <Text style={[styles.chip, { backgroundColor: colors.border, color: colors.textSecondary }]}>{item.subject}</Text>}
          {item.section_group && <Text style={[styles.chip, { backgroundColor: colors.border, color: colors.textTertiary }]}>{item.section_group}</Text>}
          {item.ethics_type && (
            <Text style={[styles.chip, { backgroundColor: 'rgba(139,92,246,0.12)', color: '#8b5cf6', fontWeight: '800', textTransform: 'uppercase' }]}>
              🏷️ {item.ethics_type}
            </Text>
          )}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 5, marginLeft: 8 }}>
        {isStaging && (
          <TouchableOpacity onPress={onPublish} style={[styles.iconBtn, { backgroundColor: '#22c55e15' }]}>
            <Play size={13} color="#22c55e" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onEdit} style={[styles.iconBtn, { backgroundColor: colors.primary + '15' }]}>
          <Edit size={13} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={[styles.iconBtn, { backgroundColor: '#ef444415' }]}>
          <Trash2 size={13} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compactToolbar: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, alignItems: 'center', gap: 6 },
  hubPickerBtn: { flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, gap: 4 },
  toolbarActionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  subTabSegmentRow: { flexDirection: 'row', borderBottomWidth: 1 },
  subTabSegmentBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  hierarchyBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1 },
  hierarchyBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, marginRight: 6, gap: 4 },
  
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10 },
  btnText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  
  jsonInputTrigger: { borderWidth: 1.5, borderRadius: 12, padding: 10, minHeight: 280, borderStyle: 'dashed', justifyContent: 'flex-start' },
  pasteModalInput: { flex: 1, borderWidth: 1.5, borderRadius: 12, padding: 12, fontSize: 12, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), textAlignVertical: 'top' },
  modalHeaderBtn: { padding: 4 },
  
  previewPlaceholder: { borderWidth: 1.5, borderRadius: 12, borderStyle: 'dashed', minHeight: 280, alignItems: 'center', justifyContent: 'center', padding: 16 },
  feedback: { flexDirection: 'row', gap: 7, padding: 9, borderRadius: 9, borderWidth: 1, alignItems: 'center' },
  importBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  importBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  filterChip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, gap: 6 },
  filterDropdown: { borderWidth: 1, borderRadius: 8, marginTop: 2 },
  filterOption: { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 0.5 },
  card: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 11, marginBottom: 8, alignItems: 'center' },
  chip: { fontSize: 9, fontWeight: '800', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  iconBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 32 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  hubOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 0.5, borderRadius: 8 },
  promptInput: { borderWidth: 1.5, borderRadius: 10, padding: 10, fontSize: 11, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), minHeight: 260, textAlignVertical: 'top', marginBottom: 8 },
  formInput: { borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 12, textAlignVertical: 'top' },
  
  bulkActionBar: { position: 'absolute', bottom: 10, left: 16, right: 16, height: 52, borderRadius: 14, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  bulkBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  bulkBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' }
});
