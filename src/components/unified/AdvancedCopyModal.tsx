import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Pressable, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { CheckSquare, Square, Copy } from 'lucide-react-native';

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

  // 1. Current Answer Only (without Question)
  const handleCopyOnlyCurrentAnswer = async () => {
    const textToCopy = currentAnswer?.text || '';
    if (!textToCopy.trim()) {
      Alert.alert('No Answer', 'No answer text available to copy.');
      return;
    }
    await handleCopy(textToCopy.trim(), `${currentAnswer.institute || 'Current'} answer copied.`);
  };

  // 2. All Answers Only (without Question)
  const handleCopyOnlyAllAnswers = async () => {
    let textToCopy = '';
    allAnswers.forEach((ans, i) => {
      textToCopy += `--- Model Answer ${i + 1} (${ans.source}) ---\n${ans.text}\n\n`;
    });
    if (myVitaminAnswer) {
      textToCopy += `--- My Vitamin Answer ---\n${myVitaminAnswer}\n\n`;
    }
    if (!textToCopy.trim()) {
      Alert.alert('No Answers', 'No answers available to copy.');
      return;
    }
    await handleCopy(textToCopy.trim(), 'All answers copied (without question).');
  };

  // 3. Question Only
  const handleCopyOnlyQuestion = async () => {
    await handleCopy(questionText, 'Question copied to clipboard.');
  };

  // 4. Question & Current Answer
  const handleCopyQuestionAndCurrentAnswer = async () => {
    const textToCopy = `Question:\n${questionText}\n\nModel Answer (${currentAnswer.institute}):\n${currentAnswer.text}`;
    await handleCopy(textToCopy, `Question and ${currentAnswer.institute} answer copied.`);
  };

  // 5. Question & All Answers
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

  // 6. Selected Answers Only (without Question)
  const handleCopySelectedOnlyAnswers = async () => {
    if (selectedSources.size === 0) return;
    
    let textToCopy = '';
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

    await handleCopy(textToCopy.trim(), `${selectedSources.size} selected answers copied (without question).`);
  };

  // 7. Selected Answers With Question
  const handleCopySelectedWithQuestion = async () => {
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
        <Pressable style={{ backgroundColor: colors.surface, borderRadius: 16, width: '100%', maxWidth: 380, padding: 20, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
            <Copy size={18} color={colors.primary} />
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>Copy Options</Text>
          </View>
          
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {/* Section 1: Answers Only */}
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textTertiary, letterSpacing: 0.8, marginBottom: 6, marginTop: 4 }}>
              ANSWERS ONLY (NO QUESTION)
            </Text>

            <TouchableOpacity 
              onPress={handleCopyOnlyCurrentAnswer} 
              style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.primary + '10', marginBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                Current Answer Only ({currentAnswer?.institute || 'Active'})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleCopyOnlyAllAnswers} 
              style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.primary + '10', marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                All Answers Only ({allAnswers.length} institutes)
              </Text>
            </TouchableOpacity>

            {/* Section 2: Question & Answers */}
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textTertiary, letterSpacing: 0.8, marginBottom: 6 }}>
              WITH QUESTION
            </Text>

            <TouchableOpacity 
              onPress={handleCopyQuestionAndCurrentAnswer} 
              style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.surfaceStrong || (colors.border + '30'), marginBottom: 6 }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>
                Question & Current Answer
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleCopyQuestionAndAllAnswers} 
              style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.surfaceStrong || (colors.border + '30'), marginBottom: 6 }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>
                Question & All Answers
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleCopyOnlyQuestion} 
              style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.surfaceStrong || (colors.border + '30'), marginBottom: 14 }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>
                Question Only
              </Text>
            </TouchableOpacity>

            {/* Section 3: Select Specific Institutes */}
            {allAnswers.length > 1 && (
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textTertiary, letterSpacing: 0.8, marginBottom: 8 }}>
                  SELECT SPECIFIC INSTITUTES
                </Text>
                
                <View style={{ maxHeight: 150, width: '100%' }}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true}>
                    {allAnswers.map((ans, i) => (
                      <TouchableOpacity 
                        key={`copy-inst-${i}`}
                        onPress={() => toggleSource(ans.source)}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6 }}
                      >
                        {selectedSources.has(ans.source) 
                          ? <CheckSquare size={17} color={colors.primary} />
                          : <Square size={17} color={colors.textTertiary} />
                        }
                        <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginLeft: 10 }}>{ans.source}</Text>
                      </TouchableOpacity>
                    ))}
                    {myVitaminAnswer && (
                      <TouchableOpacity 
                        onPress={() => toggleSource('My Vitamin')}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6 }}
                      >
                        {selectedSources.has('My Vitamin') 
                          ? <CheckSquare size={17} color={colors.primary} />
                          : <Square size={17} color={colors.textTertiary} />
                        }
                        <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginLeft: 10 }}>My Vitamin</Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                </View>

                {selectedSources.size > 0 && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity 
                      onPress={handleCopySelectedOnlyAnswers}
                      style={{ flex: 1, backgroundColor: colors.primary + '15', borderWidth: 1, borderColor: colors.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>Answers Only ({selectedSources.size})</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={handleCopySelectedWithQuestion}
                      style={{ flex: 1, backgroundColor: colors.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>With Question ({selectedSources.size})</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity onPress={onClose} style={{ marginTop: 14, paddingVertical: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textSecondary }}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
