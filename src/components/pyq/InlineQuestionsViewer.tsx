import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { X, ExternalLink } from 'lucide-react-native';
import { router } from 'expo-router';

interface InlineQuestionsViewerProps {
  opts: {
    subject?: string;
    section?: string;
    micro?: string;
    subtopic?: string;
    nanotopic?: string;
  };
  label: string;
  rawQuestions: any[];
  onClose: () => void;
}

export const InlineQuestionsViewer: React.FC<InlineQuestionsViewerProps> = ({ opts, label, rawQuestions, onClose }) => {
  const { colors } = useTheme();

  const filteredQuestions = useMemo(() => {
    let q = rawQuestions;
    if (opts.subject) q = q.filter(x => x.subject === opts.subject);
    if (opts.section) q = q.filter(x => x.section_group === opts.section);
    if (opts.micro) q = q.filter(x => x.micro_topic === opts.micro);
    if (opts.subtopic) q = q.filter(x => x.sub_topic === opts.subtopic);
    if (opts.nanotopic) q = q.filter(x => x.nano_topic === opts.nanotopic);
    
    // Sort by year descending
    return q.sort((a, b) => {
      const ya = parseInt(a.exam_year || a.year) || 0;
      const yb = parseInt(b.exam_year || b.year) || 0;
      return yb - ya;
    });
  }, [opts, rawQuestions]);

  const handleOpenInMains = () => {
    const params: any = { fromTab: 'pyq', examStage: 'Mains' };
    if (opts.subject) params.subjects = opts.subject;
    if (opts.section) params.sections = opts.section;
    if (opts.micro) params.microTopics = opts.micro;
    if (opts.subtopic) params.subTopics = opts.subtopic;
    if (opts.nanotopic) params.nanoTopics = opts.nanotopic;
    router.push({ pathname: '/mains', params });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {filteredQuestions.length} Questions
          </Text>
        </View>
        <TouchableOpacity onPress={handleOpenInMains} style={[styles.openBtn, { backgroundColor: colors.primary + '15' }]}>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600', marginRight: 4 }}>Open in Bank</Text>
          <ExternalLink size={14} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.list} nestedScrollEnabled>
        {filteredQuestions.length > 0 ? (
          filteredQuestions.map((q, idx) => (
            <View key={q.id || idx} style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[styles.badgeText, { color: colors.primary }]}>{q.exam_year || q.year || 'N/A'}</Text>
                </View>
                {!!q.marks && (
                  <View style={[styles.badge, { backgroundColor: colors.textTertiary + '22' }]}>
                    <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{q.marks} Marks</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.questionText, { color: colors.text }]}>
                {q.question_text || q.text || ''}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={{ color: colors.textTertiary, textAlign: 'center' }}>No questions found.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: 500,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 12,
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    padding: 12,
  },
  questionCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  questionText: {
    fontSize: 14,
    lineHeight: 22,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
