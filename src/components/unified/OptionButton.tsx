import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export const OptionButton = ({ label, text, isSelected, isCorrect, isWrong, showResult, onSelect, disabled, fontSize = 16 }: any) => {
  const { colors } = useTheme();

  let borderColor = colors.border;
  let textColor = colors.textPrimary;
  let letterBg = colors.surfaceStrong;
  let letterColor = colors.textSecondary;
  let borderWidth = 1;
  let bgColor = 'transparent';

  if (isSelected && !showResult) {
    borderColor = colors.primary;
    borderWidth = 2;
    letterBg = colors.primary;
    letterColor = colors.buttonText;
    bgColor = colors.primary + '08';
  }

  if (showResult) {
    borderWidth = 2;
    if (isCorrect) {
      borderColor = '#22c55e';
      textColor = '#15803d';
      letterBg = '#22c55e';
      letterColor = '#fff';
      bgColor = '#dcfce7';
    } else if (isWrong) {
      borderColor = '#ef4444';
      textColor = '#b91c1c';
      letterBg = '#ef4444';
      letterColor = '#fff';
      bgColor = '#fee2e2';
    } else {
      textColor = colors.textSecondary;
      letterBg = colors.surfaceStrong;
      letterColor = colors.textTertiary;
    }
  }

  return (
    <TouchableOpacity
      onPress={onSelect}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        styles.optionBtn,
        {
          borderColor,
          borderWidth,
          backgroundColor: bgColor,
        },
      ]}
    >
      <View style={[styles.optionLabel, { backgroundColor: letterBg }]}>
        <Text style={[styles.optionLabelText, { color: letterColor }]}>
          {label}
        </Text>
      </View>
      <Text
        style={[
          styles.optionText,
          {
            color: textColor,
            fontWeight: (isCorrect && showResult) || isSelected ? '700' : '500',
            fontSize: Math.max(12, fontSize - 1),
            lineHeight: Math.max(18, (fontSize - 1) * 1.35),
          },
        ]}
        numberOfLines={6}
      >
        {text}
      </Text>
      {showResult && isCorrect && <Check size={18} color="#22c55e" style={{ marginLeft: 'auto' }} />}
      {showResult && isWrong && <X size={18} color="#ef4444" style={{ marginLeft: 'auto' }} />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 12,
    marginBottom: 8,
  },
  optionLabel: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabelText: {
    fontSize: 14,
    fontWeight: '900',
  },
  optionText: {
    flex: 1,
  },
});
