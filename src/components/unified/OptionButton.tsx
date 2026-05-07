const OptionButton = ({ label, text, isSelected, isCorrect, isWrong, showResult, onSelect, disabled, fontSize = 16 }: any) => {
  const { colors } = useTheme();
  
  let borderColor = colors.border;
  let backgroundColor = colors.surface;
  let textColor = colors.textPrimary;
  let letterBg = colors.surfaceStrong;
  let letterColor = colors.textSecondary;

  if (isSelected) {
    borderColor = colors.primary;
    backgroundColor = colors.primary + '10';
    letterBg = colors.primary;
    letterColor = colors.buttonText;
  }

  if (showResult) {
    if (isCorrect) {
      borderColor = '#22c55e';
      backgroundColor = '#dcfce7';
      textColor = '#15803d';
      letterBg = '#22c55e';
      letterColor = '#fff';
    } else if (isWrong) {
      borderColor = '#ef4444';
      backgroundColor = '#fee2e2';
      textColor = '#b91c1c';
      letterBg = '#ef4444';
      letterColor = '#fff';
    }
  }

  return (
    <TouchableOpacity
      onPress={onSelect}
      disabled={disabled}
      style={[
        styles.optionBtn,
        { backgroundColor, borderColor, borderWidth: isSelected || showResult ? 2 : 1 },
      ]}
    >
      <View style={[styles.optionLabel, { backgroundColor: letterBg }]}>
        <Text style={[styles.optionLabelText, { color: letterColor }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.optionText, { color: textColor, fontWeight: (isCorrect && showResult) || isSelected ? '700' : '500', fontSize: Math.max(12, fontSize - 1), lineHeight: Math.max(18, (fontSize - 1) * 1.35) }]}>{text}</Text>
