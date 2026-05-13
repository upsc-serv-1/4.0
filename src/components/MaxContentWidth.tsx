import React from 'react';
import { View, ViewStyle } from 'react-native';

interface MaxContentWidthProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Override the default max-width (full-width on all devices). */
  maxWidth?: number;
}

/**
 * Wrapper that renders children at full device width on all screens
 * (phones and tablets alike). Use this inside PageWrapper to wrap
 * individual sections that should never overflow horizontally.
 *
 * opt-in maxWidth prop lets specific sections self-constrain
 * (e.g. a narrow settings card) without affecting the rest of the layout.
 */
export const MaxContentWidth: React.FC<MaxContentWidthProps> = ({
  children,
  style,
  maxWidth,
}) => {
  return (
    <View
      style={[
        { width: '100%', flex: 1 },
        maxWidth !== undefined && { maxWidth, alignSelf: 'center' },
        style,
      ]}
    >
      {children}
    </View>
  );
};

export default MaxContentWidth;