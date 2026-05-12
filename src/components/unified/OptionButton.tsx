import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export const OptionButton = ({ label, text, isSelected, isCorrect, isWrong, showResult, onSelect, disabled, fontSize = 16 }: any) => {
  const { colors } = useTheme();
  
  // FIX #10: Add animated background color transition
  const bgColorAnim = React.useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.timing(bgColorAnim, {
      toValue: isSelected || showResult ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isSelected, showResult, bgColorAnim]);
  
  let borderColor = colors.border;
  let baseBackgroundColor = colors.surface;
  let selectedBackgroundColor = colors.primary + '10';
  let textColor = colors.textPrimary;
  let letterBg = colors.surfaceStrong;
  let letterColor = colors.textSecondary;

  if (isSelected && !showResult) {
    borderColor = colors.primary;
    selectedBackgroundColor = colors.primary + '10';
    letterBg = colors.primary;
    letterColor = colors.buttonText;
  }

  if (showResult) {
    if (isCorrect) {
      borderColor = '#22c55e';
      selectedBackgroundColor = '#dcfce7';
      baseBackgroundColor = '#dcfce7';
      textColor = '#15803d';
      letterBg = '#22c55e';
      letterColor = '#fff';
    } else if (isWrong) {
      borderColor = '#ef4444';
      selectedBackgroundColor = '#fee2e2';
      baseBackgroundColor = '#fee2e2';
      textColor = '#b91c1c';
      letterBg = '#ef4444';
      letterColor = '#fff';
    }
  }
  
  // Animate background color smoothly
  const animatedBgColor = bgColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [baseBackgroundColor, selectedBackgroundColor],
  });

  return (
    <TouchableOpacity
      onPress={onSelect}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        styles.optionBtn,
        { borderColor, borderWidth: isSelected || showResult ? 2 : 1 },
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: animatedBgColor,
            borderRadius: 16,
            zIndex: -1,
          },
        ]}
      />
      <View style={[styles.optionLabel, { backgroundColor: letterBg }]}>
        <Text style={[styles.optionLabelText, { color: letterColor }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.optionText, { 
        color: textColor, 
        fontWeight: (isCorrect && showResult) || isSelected ? '700' : '500', 
        fontSize: Math.max(12, fontSize - 1), 
        lineHeight: Math.max(18, (fontSize - 1) * 1.35) 
      }]}>
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
    borderWidth: 1, 
    gap: 12,
    marginBottom: 8 
  },
  optionLabel: { 
    width: 28, 
    height: 28, 
    borderRadius: 8, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  optionLabelText: { 
    fontSize: 14, 
    fontWeight: '900' 
  },
  optionText: { 
    flex: 1 
  },
});
