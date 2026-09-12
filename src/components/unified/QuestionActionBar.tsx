import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Bookmark,
  BookOpen,
  Edit2,
  Highlighter,
  Layers,
  MessageCircle,
  RefreshCcw,
  Save,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react-native';

export type QuestionActionKey =
  | 'aiExplain'
  | 'vitamin'
  | 'save'
  | 'modify'
  | 'edit'
  | 'flashcard'
  | 'hardNote'
  | 'highlight'
  | 'notes'
  | 'bookmark'
  | 'related'
  | 'retry'
  | 'simplify';

export interface QuestionAction {
  key: QuestionActionKey;
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tint?: string;
}

const ICONS: Record<QuestionActionKey, React.ComponentType<any>> = {
  aiExplain: Sparkles,
  vitamin: Zap,
  save: Save,
  modify: Wand2,
  edit: Edit2,
  flashcard: Layers,
  hardNote: BookOpen,
  highlight: Highlighter,
  notes: MessageCircle,
  bookmark: Bookmark,
  related: BookOpen,
  retry: RefreshCcw,
  simplify: Wand2,
};

const LABELS: Record<QuestionActionKey, string> = {
  aiExplain: 'AI Explain',
  vitamin: 'Vitamin',
  save: 'Save',
  modify: 'Modify',
  edit: 'Edit',
  flashcard: 'Flashcard',
  hardNote: 'Hard Note',
  highlight: 'Highlight',
  notes: 'Notes',
  bookmark: 'Bookmark',
  related: 'Related',
  retry: 'AI Retry',
  simplify: 'Simplify',
};

export function QuestionActionBar({
  actions,
  primary,
  textColor,
}: {
  actions: QuestionAction[];
  primary: string;
  textColor: string;
}) {
  return (
    <View style={styles.wrap} testID="question-action-bar">
      {actions.map((action) => {
        const Icon = ICONS[action.key];
        const tint = action.tint || primary;
        return (
          <TouchableOpacity
            key={action.key}
            disabled={action.disabled || action.loading}
            onPress={action.onPress}
            style={[styles.action, { borderColor: tint + '44', backgroundColor: tint + '10', opacity: action.disabled ? 0.55 : 1 }]}
            testID={`question-action-${action.key}`}
          >
            {action.loading ? <ActivityIndicator size="small" color={tint} /> : <Icon size={11} color={tint} />}
            <Text style={[styles.label, { color: action.tint ? tint : textColor }]} numberOfLines={1}>
              {action.label || LABELS[action.key]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: '23%',
  },
  label: { fontSize: 9, fontWeight: '800' },
});
