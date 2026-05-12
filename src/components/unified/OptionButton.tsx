import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export const OptionButton = ({ label, text, isSelected, isCorrect, isWrong, showResult, onSelect, disabled, fontSize = 16 }: any) => {
  const { colors } = useTheme();

  // Smooth opacity-based selection overlay (more performant than color interpolation)
  const selectedOpacity = useRef(new Animated.Value(0)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate selection highlight smoothly
    Animated.timing(selectedOpacity, {
      toValue: isSelected ? 1 : 0,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [isSelected, selectedOpacity]);

  useEffect(() => {
    // Animate result (correct/wrong) overlay smoothly
    Animated.timing(resultOpacity, {
      toValue: showResult ? 1 : 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [showResult, resultOpacity]);

  let borderColor = colors.border;
  let textColor = colors.textPrimary;
  let letterBg = colors.surfaceStrong;
  let letterColor = colors.textSecondary;
  let borderWidth = 1;

  const overlayColor = 'transparent';
  const resultOverlayColor = 'transparent';
  let resultLetterBg = letterBg;
  let resultLetterColor = letterColor;
  let resultTextColor = textColor;

  if (isSelected && !showResult) {
    borderColor = colors.primary;
    borderWidth = 2;
    letterBg = colors.primary;
    letterColor = colors.buttonText;
  }

  if (showResult) {
    borderWidth = 2;
    if (isCorrect) {
      borderColor = '#22c55e';
      textColor = '#15803d';
      letterBg = '#22c55e';
      letterColor = '#fff';
      resultLetterBg = '#22c55e';
      resultLetterColor = '#fff';
      resultTextColor = '#15803d';
    } else if (isWrong) {
      borderColor = '#ef4444';
      textColor = '#b91c1c';
      letterBg = '#ef4444';
      letterColor = '#fff';
      resultLetterBg = '#ef4444';
      resultLetterColor = '#fff';
      resultTextColor = '#b91c1c';
    } else {
      // Unselected option when results shown — subtle background
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
        { borderColor, borderWidth },
      ]}
    >
      {/* Soft selection highlight overlay (fades in/out with opacity) */}
      {!showResult && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colors.primary,
              borderRadius: 16,
              opacity: Animated.multiply(selectedOpacity, 0.1),
              zIndex: -1,
            },
          ]}
        />
      )}

      {/* Result overlay — correct (green) or wrong (red) with smooth fade */}
      {showResult && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: 16,
              zIndex: -1,
              opacity: resultOpacity,
              backgroundColor: isCorrect
                ? '#dcfce7'
                : isWrong
                  ? '#fee2e2'
                  : 'transparent',
            },
          ]}
        />
      )}

      <View style={[
        styles.optionLabel,
        { backgroundColor: showResult && !isCorrect && !isWrong ? colors.surfaceStrong : letterBg },
      ]}>
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
    overflow: 'hidden',
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
