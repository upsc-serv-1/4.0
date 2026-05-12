import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Pressable, TextInput, Modal, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius } from '../theme';
import { TaggedQuestion } from '../hooks/useTaggedQuestions';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Eye, Trash2, Zap, ExternalLink, BookOpen, ChevronDown, ChevronUp, Plus, X as XIcon } from 'lucide-react-native';
import { FlashcardSvc } from '../services/FlashcardService';
import { AddToFlashcardSheet } from './flashcards/AddToFlashcardSheet';
import { autoCleanupQuestionState } from '../utils/questionStateUtils';
import { TagsQuestionAIPanel } from './tags/TagsQuestionAIPanel';
import { useRouter } from 'expo-router';
import { normalizeTag } from '../utils/tagUtils';

interface RepoQuestionCardProps {
  question: TaggedQuestion;
  onUpdate?: () => void;
  isZenMode?: boolean;
  /** When provided, "Ask AI" opens the floating PilotV2AIChat chatbot instead of a local chat modal */
  onOpenAIChat?: (questionData: { id: string; question_text: string; correct_answer: string; explanation: string; subject?: string }) => void;
}

export const RepoQuestionCard = ({ question, onUpdate, isZenMode, onOpenAIChat }: RepoQuestionCardProps) => {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  
  const [revealStage, setRevealStage] = useState(0);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<'remove' | 'flash' | null>(null);
  const [aff, setAff] = useState<{ visible: boolean; cardId: string | null; hint: any }>({ visible: false, cardId: null, hint: {} });
  const [tagManageVisible, setTagManageVisible] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [savingTag, setSavingTag] = useState(false);
  
  const zenTextColor = isZenMode ? '#433422' : colors.textPrimary;
  const zenSecColor = isZenMode ? '#43342295' : colors.textSecondary;
  const zenTertColor = isZenMode ? '#43342260' : colors.textTertiary;
  
  const normSelected = (question.selectedAnswer || '').trim().toUpperCase();
  const normCorrect = (question.correctAnswer || '').trim().toUpperCase();
  const isCorrect = normSelected === normCorrect;

  const handleNextStage = () => {
    if (revealStage < 2) setRevealStage(revealStage + 1);
    else setRevealStage(0); 
  };

  const handleRemoveTag = async () => {
    if (!session?.user?.id) return;
    setLoadingAction('remove');
    try {
      const { error } = await supabase
        .from('question_states')
        .update({ review_tags: null })
        .eq('user_id', session.user.id)
        .eq('question_id', question.id);
      if (error) throw error;
      // Auto-cleanup: if removing tags made the row fully empty, delete it
      await autoCleanupQuestionState(session.user.id, question.id);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAddToFlashcard = async () => {
    if (!session?.user?.id) return;
    setLoadingAction('flash');
    try {
      const qData = {
        id: question.id,
        question_text: question.questionText,
        explanation_markdown: question.explanation,
        correct_answer: question.correctAnswer,
        subject: question.subject,
        section_group: question.sectionGroup,
        micro_topic: question.microTopic,
        test_id: question.testId || 'repo'
      };
      const cardId = await FlashcardSvc.createFromQuestion(session.user.id, qData);
      setAff({
        visible: true,
        cardId,
        hint: {
          subject: question.subject || 'General',
          section_group: question.sectionGroup || 'General',
          microtopic: question.microTopic || 'General',
        },
      });
    } catch (err: any) {
      console.error("Flashcard add error:", err);
      Alert.alert('Error', 'Failed to add to Flashcards. ' + (err.message || ''));
    } finally {
      setLoadingAction(null);
    }
  };

  const renderOptions = () => {
    if (!question.options || revealStage === 0) return null;
    const optionsList = Array.isArray(question.options) 
      ? question.options 
      : Object.entries(question.options).map(([key, value]) => ({ key, value }));

    return (
      <View style={styles.optionsContainer}>
        {optionsList.map((opt: any, idx: number) => {
          const key = (opt.key || String.fromCharCode(65 + idx)).trim().toUpperCase();
          const value = typeof opt === 'string' ? opt : opt.value;
          const isUserChoice = normSelected === key;
          const isCorrectAns = normCorrect === key;
          const shouldHighlight = revealStage === 2;

          return (
            <View key={idx} style={[styles.optionRow, { borderColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : colors.border }, shouldHighlight && isCorrectAns && { backgroundColor: '#22c55e10', borderColor: '#22c55e' }, shouldHighlight && isUserChoice && !isCorrectAns && { backgroundColor: '#f9731610', borderColor: '#f97316' }]}>
              <View style={[styles.optionLetter, { backgroundColor: isZenMode ? 'rgba(67, 52, 34, 0.05)' : colors.surfaceStrong + '15' }, shouldHighlight && isCorrectAns && { backgroundColor: '#22c55e' }, shouldHighlight && isUserChoice && !isCorrectAns && { backgroundColor: '#f97316' }]}>
                <Text style={[styles.optionLetterText, { color: zenTextColor }, shouldHighlight && (isCorrectAns || isUserChoice) && { color: '#fff' }]}>{key}</Text>
              </View>
              <Text style={[styles.optionValue, { color: zenTextColor }]} numberOfLines={2}>{value}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <>
    <TouchableOpacity activeOpacity={0.95} onPress={handleNextStage} style={[styles.card, { backgroundColor: isZenMode ? 'transparent' : colors.surface, borderColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : 'rgba(255, 255, 255, 0.4)' }]}>
      <View style={[styles.progressIndicator, { backgroundColor: revealStage === 0 ? (isZenMode ? 'rgba(67, 52, 34, 0.2)' : colors.textTertiary + '20') : revealStage === 1 ? colors.primary + '50' : '#22c55e' }]} />
      
      <View style={styles.header}>
        <View style={styles.tagRow}>
          {question.reviewTags.slice(0, 3).map((tag, idx) => (
            <View key={idx} style={[styles.tagBadge, { backgroundColor: isZenMode ? 'rgba(67, 52, 34, 0.05)' : colors.surfaceStrong + '10' }]}><Text style={[styles.tagText, { color: zenSecColor }]}>{tag}</Text></View>
          ))}
          {question.reviewTags.length > 3 && (
            <View style={[styles.tagBadge, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.tagText, { color: colors.primary }]}>+{question.reviewTags.length - 3}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.statusText, { color: zenTertColor }]}>{revealStage === 0 ? 'RECALL' : revealStage === 1 ? 'CHECK' : 'SAVED'}</Text>
      </View>

      <Text style={[styles.questionText, { color: zenTextColor }]} numberOfLines={revealStage === 0 ? 2 : 0}>{question.questionText}</Text>

      {revealStage === 0 && (
        <View style={[styles.hiddenPlaceholder, { backgroundColor: isZenMode ? 'rgba(67, 52, 34, 0.02)' : 'rgba(255, 255, 255, 0.02)', borderColor: isZenMode ? 'rgba(67, 52, 34, 0.2)' : 'rgba(255, 255, 255, 0.3)' }]}><Eye size={10} color={zenTertColor} opacity={0.4} /><Text style={[styles.placeholderText, { color: zenTertColor }]}>REVEAL</Text></View>
      )}

      {renderOptions()}

      {revealStage === 2 && (
        <View style={[styles.revealArea, { borderTopColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : 'rgba(255, 255, 255, 0.05)' }]}>
          <View style={styles.answerSummary}>
             <Text style={styles.ansLine}><Text style={[styles.ansLabel, { color: zenTertColor }]}>ANS: </Text><Text style={{ color: '#22c55e', fontWeight: '900' }}>{normCorrect}</Text> <Text style={[styles.ansLabel, { color: zenTertColor }]}> | YOU: </Text><Text style={{ color: isCorrect ? '#22c55e' : '#f97316', fontWeight: '900' }}>{normSelected || 'SKP'}</Text></Text>
          </View>
          <Text style={[styles.explanationText, { color: zenSecColor }]}>{question.explanation}</Text>

          <View style={styles.actionsBar}>
            {/* Issue 32: Inline AI Panel toggle — keeps user in Tags tab. */}
            <TouchableOpacity
              onPress={() => setAiPanelOpen((o) => !o)}
              style={[styles.actionBtn, { backgroundColor: '#a855f715', borderColor: '#a855f733', flex: 1.4 }]}
              testID="ai-panel-toggle"
            >
              <Zap size={10} color="#a855f7" />
              <Text style={[styles.actionBtnText, { color: '#a855f7' }]}>AI Panel</Text>
              {aiPanelOpen ? <ChevronUp size={10} color="#a855f7" /> : <ChevronDown size={10} color="#a855f7" />}
            </TouchableOpacity>
            {/* Issue #2: Full View button opens question in unified engine with all AI features */}
            <TouchableOpacity
              onPress={() => {
                router.push({
                  pathname: '/unified/engine',
                  params: {
                    testId: question.testId || 'manual',
                    mode: 'learning',
                    questionId: question.id,
                    fromTags: 'true',
                    revealAll: '1',
                  },
                });
              }}
              style={[styles.actionBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30', flex: 1.4 }]}
              testID="full-view-btn"
            >
              <BookOpen size={10} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>Learn</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                router.push({
                  pathname: '/unified/engine',
                  params: {
                    testId: question.testId || 'manual',
                    mode: 'learning',
                    questionId: question.id,
                    fromTags: 'true',
                    revealAll: '1',
                    aiExpand: '1',
                    explSource: 'ai',
                  },
                });
              }}
              style={[styles.actionBtn, { backgroundColor: colors.primary + '22', borderColor: colors.primary + '44', flex: 1.6 }]}
              testID="ai-explain-btn"
              accessibilityLabel="Open AI Explain & My Vitamin"
            >
              <Zap size={10} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>AI Explain</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleRemoveTag} disabled={!!loadingAction} style={[styles.actionBtn, { borderColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : colors.border }]}>
              {loadingAction === 'remove' ? <ActivityIndicator size="small" color={zenTertColor} /> : <Trash2 size={10} color={zenSecColor} />}
              <Text style={[styles.actionBtnText, { color: zenSecColor }]}>Remove</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAddToFlashcard} disabled={!!loadingAction} style={[styles.actionBtn, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '20' }]}>
              {loadingAction === 'flash' ? <ActivityIndicator size="small" color={colors.primary} /> : <Zap size={10} color={colors.primary} />}
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>Flash</Text>
            </TouchableOpacity>
            {question.testId && (
              <TouchableOpacity
                onPress={() => {
                  router.push({
                    pathname: '/unified/engine',
                    params: {
                      testId: question.testId,
                      mode: 'learning',
                      questionId: question.id,
                      fromTags: 'true',
                      revealAll: '1',
                    },
                  });
                }}
                style={[styles.actionBtn, { borderColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : colors.border }]}
                testID="view-source-btn"
              >
                <ExternalLink size={10} color={zenSecColor} />
                <Text style={[styles.actionBtnText, { color: zenSecColor }]}>Source</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Issues 2/3/32 — inline AI Vitamin / institute-explanation panel */}
          {/* ALL tags shown inline below answer with add/remove */}
          {revealStage === 2 && (
            <View style={[styles.tagsSection, { borderTopColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : 'rgba(255, 255, 255, 0.05)', marginTop: 6, paddingTop: 6 }]}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                {question.reviewTags.map((tag, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.inlineTag, { backgroundColor: isZenMode ? 'rgba(67, 52, 34, 0.08)' : colors.primary + '12', borderColor: isZenMode ? 'rgba(67, 52, 34, 0.2)' : colors.primary + '25' }]}
                    onPress={async () => {
                      if (!session?.user?.id) return;
                      try {
                        const { error } = await supabase
                          .from('question_states')
                          .update({ review_tags: question.reviewTags.filter(t => t !== tag) })
                          .eq('user_id', session.user.id)
                          .eq('question_id', question.id);
                        if (error) throw error;
                        if (onUpdate) onUpdate();
                      } catch (err: any) {
                        Alert.alert('Error removing tag', err.message);
                      }
                    }}
                  >
                    <Text style={[styles.inlineTagText, { color: isZenMode ? '#433422' : colors.primary, fontSize: 9 }]}>{tag}</Text>
                    <XIcon size={10} color={isZenMode ? '#433422' : colors.primary} />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.inlineTagAdd, { borderColor: colors.primary + '40' }]}
                  onPress={() => setTagManageVisible(true)}
                >
                  <Plus size={10} color={colors.primary} />
                  <Text style={[styles.inlineTagText, { color: colors.primary, fontSize: 8 }]}>ADD</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {aiPanelOpen ? (
            <Pressable onPress={(e) => e.stopPropagation()}>
              <TagsQuestionAIPanel
                questionId={question.id}
                testId={question.testId || 'manual'}
                questionText={question.questionText}
                defaultExplanation={question.explanation}
                subject={question.subject}
                sectionGroup={question.sectionGroup}
                microTopic={question.microTopic}
                isZenMode={isZenMode}
                instituteExplanations={question.instituteExplanations}
                institutes={question.institutes}
                mergedIds={question.mergedIds}
                onOpenAIChat={onOpenAIChat}
              />
            </Pressable>
          ) : null}

          {/* Inline Add Tag Modal */}
          <Modal transparent visible={tagManageVisible} animationType="fade" onRequestClose={() => setTagManageVisible(false)}>
            <Pressable style={styles.modalOverlay} onPress={() => setTagManageVisible(false)}>
              <View style={[styles.addTagModal, { backgroundColor: colors.surface, borderColor: colors.border }]} onStartShouldSetResponder={() => true}>
                <Text style={[styles.addTagTitle, { color: colors.textPrimary }]}>Add Tag</Text>
                <TextInput
                  value={newTagInput}
                  onChangeText={setNewTagInput}
                  placeholder="Enter tag name..."
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.addTagInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                  autoFocus
                />
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.surfaceStrong, alignItems: 'center' }}
                    onPress={() => { setTagManageVisible(false); setNewTagInput(''); }}
                  >
                    <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 13 }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={!newTagInput.trim() || savingTag}
                    style={[styles.addTagBtn, { backgroundColor: colors.primary, opacity: !newTagInput.trim() || savingTag ? 0.5 : 1 }]}
                    onPress={async () => {
                      if (!session?.user?.id || !newTagInput.trim()) return;
                      setSavingTag(true);
                      try {
                        const currentTags = question.reviewTags || [];
                        const newTags = [...currentTags, newTagInput.trim()];
                        const { error } = await supabase
                          .from('question_states')
                          .update({ review_tags: newTags })
                          .eq('user_id', session.user.id)
                          .eq('question_id', question.id);
                        if (error) throw error;
                        setNewTagInput('');
                        setTagManageVisible(false);
                        if (onUpdate) onUpdate();
                      } catch (err: any) {
                        Alert.alert('Error', err.message);
                      } finally {
                        setSavingTag(false);
                      }
                    }}
                  >
                    {savingTag ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Add</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </Modal>
        </View>
      )}
    </TouchableOpacity>
    <AddToFlashcardSheet
      visible={aff.visible}
      onClose={() => setAff(s => ({ ...s, visible: false }))}
      userId={session?.user?.id || ''}
      cardId={aff.cardId}
      hint={aff.hint}
    />
    </>
  );
};

const styles = StyleSheet.create({
  card: { padding: 10, paddingLeft: 14, borderRadius: 16, borderWidth: 1, marginBottom: 6, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1 },
  progressIndicator: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 2.5 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  tagRow: { flexDirection: 'row', gap: 3 },
  tagBadge: { paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 5 },
  tagText: { fontSize: 6, fontWeight: '900', textTransform: 'uppercase' },
  statusText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  questionText: { fontSize: 12, fontWeight: '800', lineHeight: 16, marginBottom: 6 },
  hiddenPlaceholder: { height: 32, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderStyle: 'dashed', borderWidth: 0.8, borderColor: 'rgba(255, 255, 255, 0.3)' },
  placeholderText: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  optionsContainer: { gap: 5, marginBottom: 6 },
  optionRow: { flexDirection: 'row', alignItems: 'center', padding: 6, borderRadius: 8, borderWidth: 1, gap: 6 },
  optionLetter: { width: 20, height: 20, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  optionLetterText: { fontSize: 9, fontWeight: '900' },
  optionValue: { fontSize: 11, fontWeight: '600', flex: 1 },
  revealArea: { marginTop: 2, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.05)' },
  answerSummary: { marginBottom: 6 },
  ansLine: { fontSize: 10, fontWeight: '700' },
  ansLabel: { fontSize: 8, fontWeight: '800' },
  explanationText: { fontSize: 11, lineHeight: 16, fontWeight: '500', marginBottom: 10 },
  actionsBar: { flexDirection: 'row', gap: 6 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  actionBtnText: { fontSize: 9, fontWeight: '800' },
  // Inline tag management
  tagsSection: { borderTopWidth: 1 },
  inlineTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  inlineTagText: { fontWeight: '700' },
  inlineTagAdd: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed' },
  // Add tag modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  addTagModal: { width: '80%', padding: 20, borderRadius: 16, borderWidth: 1 },
  addTagTitle: { fontSize: 18, fontWeight: '900', marginBottom: 16 },
  addTagInput: { borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 14, fontWeight: '600' },
  addTagBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
});
