import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Pressable, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { CheckSquare, Square } from 'lucide-react-native';

export interface AdvancedCopyModalProps {
  visible: boolean;
  onClose: () => void;
  questionText: string;
  currentAnswer: { institute: string; text: string };
  allAnswers: { source: string; text: string }[];
  myVitaminAnswer?: string | null;
  colors: any;
}

export function AdvancedCopyModal({
  visible,
  onClose,
  questionText,
  currentAnswer,
  allAnswers,
  myVitaminAnswer,
  colors
}: AdvancedCopyModalProps) {
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      setSelectedSources(new Set());
    }
  }, [visible]);

  const toggleSource = (source: string) => {
    const next = new Set(selectedSources);
    if (next.has(source)) next.delete(source);
    else next.add(source);
    setSelectedSources(next);
  };

  const handleCopy = async (text: string, successMsg: string) => {
    await Clipboard.setStringAsync(text);
    onClose();
    Alert.alert('Copied', successMsg);
  };

  const handleCopyOnlyQuestion = async () => {
    await handleCopy(questionText, 'Question copied to clipboard.');
  };

  const handleCopyQuestionAndCurrentAnswer = async () => {
    const textToCopy = `Question:\n${questionText}\n\nModel Answer (${currentAnswer.institute}):\n${currentAnswer.text}`;
    await handleCopy(textToCopy, `Question and ${currentAnswer.institute} answer copied.`);
  };

  const handleCopyQuestionAndAllAnswers = async () => {
    let textToCopy = `Question:\n${questionText}\n\n`;
    allAnswers.forEach((ans, i) => {
      textToCopy += `--- Model Answer ${i + 1} (${ans.source}) ---\n${ans.text}\n\n`;
    });
    if (myVitaminAnswer) {
      textToCopy += `--- My Vitamin Answer ---\n${myVitaminAnswer}\n\n`;
    }
    await handleCopy(textToCopy.trim(), 'Question and all answers copied.');
  };

  const handleCopySelected = async () => {
    if (selectedSources.size === 0) return;
    
    let textToCopy = `Question:\n${questionText}\n\n`;
    let count = 1;

    allAnswers.forEach((ans) => {
      if (selectedSources.has(ans.source)) {
        textToCopy += `--- Model Answer ${count} (${ans.source}) ---\n${ans.text}\n\n`;
        count++;
      }
    });

    if (myVitaminAnswer && selectedSources.has('My Vitamin')) {
      textToCopy += `--- My Vitamin Answer ---\n${myVitaminAnswer}\n\n`;
    }

    await handleCopy(textToCopy.trim(), `Question and ${selectedSources.size} selected answers copied.`);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable 
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
        onPress={onClose}
      >
        <Pressable style={{ backgroundColor: colors.surface, borderRadius: 16, width: '100%', maxWidth: 360, padding: 20, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 16, textAlign: 'center' }}>Copy Options</Text>
          
          <TouchableOpacity onPress={handleCopyOnlyQuestion} style={{ paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Copy Question Only</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleCopyQuestionAndCurrentAnswer} style={{ paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Copy Question & Current Answer</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleCopyQuestionAndAllAnswers} style={{ paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Copy Question & All Answers</Text>
          </TouchableOpacity>

          {/* Specific Institutes Checkboxes */}
          <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, textAlign: 'center' }}>Select Specific Institutes</Text>
            <View style={{ maxHeight: 180, width: '100%' }}>
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true}>
                {allAnswers.map((ans, i) => (
                  <TouchableOpacity 
                    key={`copy-inst-${i}`}
                    onPress={() => toggleSource(ans.source)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8 }}
                  >
                    {selectedSources.has(ans.source) 
                      ? <CheckSquare size={18} color={colors.primary} />
                      : <Square size={18} color={colors.textTertiary} />
                    }
                    <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginLeft: 10 }}>{ans.source}</Text>
                  </TouchableOpacity>
                ))}
                {myVitaminAnswer && (
                  <TouchableOpacity 
                    onPress={() => toggleSource('My Vitamin')}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8 }}
                  >
                    {selectedSources.has('My Vitamin') 
                      ? <CheckSquare size={18} color={colors.primary} />
                      : <Square size={18} color={colors.textTertiary} />
                    }
                    <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginLeft: 10 }}>My Vitamin</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>

            {selectedSources.size > 0 && (
              <TouchableOpacity 
                onPress={handleCopySelected}
                style={{ marginTop: 12, backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Copy Selected ({selectedSources.size})</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity onPress={onClose} style={{ marginTop: 16, paddingVertical: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textSecondary }}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
