import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { buildCanonicalExplanations } from '../../utils/questionUtils';
import { QuestionActionBar, type QuestionAction } from '../unified/QuestionActionBar';

interface VitaminVersion {
  id: string;
  question_id: string;
  user_id: string;
  text: string;
  rating?: number | null;
  created_at: string;
}

interface InstituteExplanation {
  source: string;
  program?: string;
  answer?: string;
  text: string;
}

interface Props {
  questionId: string;
  testId: string;
  questionText: string;
  defaultExplanation: string;
  subject?: string;
  sectionGroup?: string;
  microTopic?: string;
  isZenMode?: boolean;
  instituteExplanations?: any[];
  institutes?: string[];
  mergedIds?: string[];
}

export function TagsQuestionAIPanel({
  questionId,
  testId,
  questionText,
  defaultExplanation,
  subject,
  microTopic,
  isZenMode,
  instituteExplanations = [],
  mergedIds = [],
}: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [vitamins, setVitamins] = useState<VitaminVersion[]>([]);
  const [vitaminLoading, setVitaminLoading] = useState(true);
  const [otherExplanations, setOtherExplanations] = useState<InstituteExplanation[]>([]);
  const [activeSource, setActiveSource] = useState<string>('default');
  const [savingVitamin, setSavingVitamin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId || !questionId) return;
    setVitaminLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('vitamin_versions')
          .select('id, question_id, user_id, text, rating, created_at')
          .eq('user_id', userId)
          .eq('question_id', questionId)
          .order('created_at', { ascending: false });
        if (!cancelled) setVitamins((data as VitaminVersion[]) || []);
      } catch {
        if (!cancelled) setVitamins([]);
      } finally {
        if (!cancelled) setVitaminLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, questionId]);

  useEffect(() => {
    let cancelled = false;
    const canonical = buildCanonicalExplanations({
      id: questionId,
      question_text: questionText,
      explanation_markdown: defaultExplanation,
      _explanations: instituteExplanations,
    }).filter((entry: any) => String(entry.text || '').trim() && String(entry.text || '').trim() !== String(defaultExplanation || '').trim());

    if (canonical.length > 0) {
      setOtherExplanations(canonical.map((entry: any) => ({
        source: entry.source,
        program: entry.program,
        answer: entry.answer,
        text: entry.text,
      })));
      return;
    }

    if (!subject || !microTopic || !questionText) {
      setOtherExplanations([]);
      return;
    }

    (async () => {
      try {
        let query = supabase
          .from('questions')
          .select('id, test_id, question_text, explanation_markdown, correct_answer, tests(institute,program_name,series)')
          .neq('id', questionId)
          .limit(15);
        if (mergedIds.length > 1) {
          query = query.in('id', mergedIds.filter((id) => id !== questionId));
        } else {
          query = query.eq('subject', subject).eq('micro_topic', microTopic);
        }
        const { data } = await query;
        if (cancelled || !Array.isArray(data)) return;

        const targetLen = questionText.length;
        const matches: InstituteExplanation[] = [];
        for (const row of data as any[]) {
          if (!row.explanation_markdown) continue;
          const rowLen = String(row.question_text || '').length;
          if (mergedIds.length <= 1 && rowLen && (rowLen < targetLen * 0.65 || rowLen > targetLen * 1.35)) continue;
          const tests = Array.isArray(row?.tests) ? row.tests[0] : row?.tests;
          matches.push({
            source: tests?.institute || 'Other Institute',
            program: tests?.program_name || tests?.series || '',
            answer: row.correct_answer || '',
            text: row.explanation_markdown,
          });
          if (matches.length >= 6) break;
        }
        if (!cancelled) setOtherExplanations(matches);
      } catch {
        if (!cancelled) setOtherExplanations([]);
      }
    })();
    return () => { cancelled = true; };
  }, [defaultExplanation, instituteExplanations, mergedIds, microTopic, questionId, questionText, subject]);

  const handleSaveVitamin = useCallback(async () => {
    if (!userId || !defaultExplanation) return;
    setSavingVitamin(true);
    try {
      const { data, error } = await supabase
        .from('vitamin_versions')
        .insert({ user_id: userId, question_id: questionId, text: defaultExplanation })
        .select()
        .single();
      if (error) throw error;
      if (data) setVitamins((prev) => [data as VitaminVersion, ...prev]);
    } catch (e: any) {
      alert(`Could not save Vitamin: ${e?.message || 'unknown error'}`);
    } finally {
      setSavingVitamin(false);
    }
  }, [userId, questionId, defaultExplanation]);

  const openInEngine = (extra: Record<string, string>) => {
    router.push({
      pathname: '/unified/engine',
      params: {
        testId: testId || 'manual',
        mode: 'learning',
        questionId,
        fromTags: 'true',
        revealAll: '1',
        ...extra,
      },
    });
  };

  const sec = isZenMode ? '#43342295' : colors.textSecondary;
  const tert = isZenMode ? '#43342260' : colors.textTertiary;
  const primary = colors.primary;
  const actionText = isZenMode ? '#433422' : colors.textPrimary;

  const actions: QuestionAction[] = [
    { key: 'aiExplain', tint: primary, onPress: () => openInEngine({ aiExpand: '1', explSource: 'ai' }) },
    { key: 'vitamin', tint: '#a855f7', label: savingVitamin ? 'Saving…' : 'Vitamin', disabled: savingVitamin || !defaultExplanation, loading: savingVitamin, onPress: handleSaveVitamin },
    { key: 'save', tint: '#a855f7', label: 'Save', disabled: savingVitamin || !defaultExplanation, loading: savingVitamin, onPress: handleSaveVitamin },
    { key: 'modify', tint: primary, onPress: () => openInEngine({ aiExpand: '1', aiAction: 'modify' }) },
    { key: 'edit', tint: primary, onPress: () => openInEngine({ tool: 'edit' }) },
    { key: 'flashcard', tint: primary, onPress: () => openInEngine({ tool: 'flashcard' }) },
    { key: 'hardNote', tint: primary, onPress: () => openInEngine({ tool: 'hardnote' }) },
    { key: 'highlight', tint: '#f59e0b', onPress: () => openInEngine({ tool: 'highlight' }) },
    { key: 'notes', tint: primary, onPress: () => openInEngine({ tool: 'note' }) },
    { key: 'bookmark', tint: primary, onPress: () => openInEngine({ tool: 'bookmark' }) },
    { key: 'related', tint: primary, onPress: () => openInEngine({ tool: 'related' }) },
    { key: 'retry', tint: primary, onPress: () => openInEngine({ aiExpand: '1', aiAction: 'retry' }) },
    { key: 'simplify', tint: primary, onPress: () => openInEngine({ aiExpand: '1', aiAction: 'simplify' }) },
  ];

  return (
    <View style={[styles.panel, { borderTopColor: colors.border + '55' }]} testID="tags-ai-panel">
      {(otherExplanations.length > 0 || vitamins.length > 0) ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 6 }} testID="tags-institute-chips">
          <SourceChip label="Primary" active={activeSource === 'default'} onPress={() => setActiveSource('default')} primary={primary} />
          {otherExplanations.map((entry, idx) => (
            <SourceChip
              key={`${entry.source}-${entry.program || ''}-${idx}`}
              label={entry.source}
              active={activeSource === `inst-${idx}`}
              onPress={() => setActiveSource(`inst-${idx}`)}
              primary={primary}
            />
          ))}
          {vitamins.length > 0 ? (
            <SourceChip label={`Vitamin (${vitamins.length})`} active={activeSource === 'vitamin'} onPress={() => setActiveSource('vitamin')} primary="#a855f7" />
          ) : null}
        </ScrollView>
      ) : null}

      <View style={styles.bodyBox}>
        {activeSource === 'default' ? (
          <Text style={[styles.bodyText, { color: sec }]}>{defaultExplanation || 'No primary explanation available.'}</Text>
        ) : activeSource === 'vitamin' ? (
          vitaminLoading ? (
            <ActivityIndicator size="small" color={primary} />
          ) : vitamins.length === 0 ? (
            <Text style={[styles.bodyText, { color: tert, fontStyle: 'italic' }]}>No saved Vitamin yet. Use Save as Vitamin to keep your AI explanation here.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {vitamins.map((vitamin) => (
                <View key={vitamin.id} style={[styles.vitaminCard, { borderColor: '#a855f733', backgroundColor: '#a855f708' }]}>
                  <Text style={[styles.bodyText, { color: sec }]}>{vitamin.text}</Text>
                  <Text style={[styles.metaText, { color: tert }]}>
                    {new Date(vitamin.created_at).toLocaleDateString()}{vitamin.rating ? `  ·  ★ ${vitamin.rating}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )
        ) : (
          (() => {
            const idx = parseInt((activeSource || '').replace('inst-', ''), 10);
            const inst = otherExplanations[idx];
            if (!inst) return <Text style={[styles.bodyText, { color: tert }]}>—</Text>;
            return (
              <View>
                {(inst.answer || inst.program) ? (
                  <Text style={[styles.metaText, { color: tert }]}>
                    {inst.program ? `${inst.program}  ·  ` : ''}{inst.answer ? `Answer ${String(inst.answer).toUpperCase()}` : ''}
                  </Text>
                ) : null}
                <Text style={[styles.bodyText, { color: sec }]}>{inst.text}</Text>
              </View>
            );
          })()
        )}
      </View>

      <QuestionActionBar actions={actions} primary={primary} textColor={actionText} />
    </View>
  );
}

interface SourceChipProps { label: string; active: boolean; onPress: () => void; primary: string; }
function SourceChip({ label, active, onPress, primary }: SourceChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: active ? primary + '22' : 'transparent',
        borderWidth: 1,
        borderColor: active ? primary : '#cbd5e1',
      }}
      testID={`tags-source-chip-${label}`}
    >
      <Text style={{ fontSize: 9, fontWeight: '800', color: active ? primary : '#64748b' }}>{label.toUpperCase()}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, gap: 8 },
  bodyBox: { paddingHorizontal: 4, paddingVertical: 4 },
  bodyText: { fontSize: 11, lineHeight: 15, fontWeight: '500' },
  metaText: { fontSize: 9, marginTop: 4, marginBottom: 4, fontWeight: '700' },
  vitaminCard: { borderWidth: 1, borderRadius: 10, padding: 8 },
});
