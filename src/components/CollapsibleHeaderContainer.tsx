/**
 * CollapsibleHeaderContainer
 * --------------------------
 * Unified scroll-linked collapsing header used across:
 *   - Cards
 *   - Analyze
 *   - Tags
 *   - Notes
 *   - (any future tab with a header above scrollable content)
 *
 * Behaviour mirrors the Tracker tab:
 *   - As the user scrolls down, the header naturally translates upward AND
 *     fades out smoothly (linked to scroll progress).
 *   - As the user scrolls up, opacity & translateY restore proportionally.
 *   - The animation is fully scroll-linked (no abrupt show/hide).
 *
 * Use:
 *   <CollapsibleHeaderContainer header={<MyHeader />} headerHeight={120}>
 *      <FlatList ... />     // or any scrollable child rendered through render prop
 *   </CollapsibleHeaderContainer>
 *
 * The child receives a memoised `onScroll` and `scrollEventThrottle` props it
 * MUST forward to its scrollable element (via `<Animated.FlatList />` or
 * `<Animated.ScrollView />`).
 */
import React, { useMemo, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';

interface Props {
  header: React.ReactNode;
  headerHeight: number;
  /** Render-prop receives scroll handler to wire into Animated.* component. */
  children: (scrollProps: {
    onScroll: (...args: any[]) => void;
    scrollEventThrottle: number;
    contentInsetTop: number;
    contentPaddingTop: number;
  }) => React.ReactNode;
  style?: ViewStyle;
  /** Optional safe-area top inset (status bar offset). */
  safeAreaTop?: number;
  testID?: string;
}

export const CollapsibleHeaderContainer: React.FC<Props> = ({
  header,
  headerHeight,
  children,
  style,
  safeAreaTop = 0,
  testID,
}) => {
  const scrollY = useRef(new Animated.Value(0)).current;

  // translateY: moves header upward as user scrolls down, but never past safe-area.
  const translateY = scrollY.interpolate({
    inputRange: [0, headerHeight],
    outputRange: [0, -(headerHeight)],
    extrapolate: 'clamp',
  });

  // Opacity: fades from 1 → 0 over the full headerHeight scroll distance.
  const opacity = scrollY.interpolate({
    inputRange: [0, headerHeight * 0.55, headerHeight],
    outputRange: [1, 0.55, 0],
    extrapolate: 'clamp',
  });

  // Subtle scale-down for tablet polish (keeps motion premium, not jarring).
  const scale = scrollY.interpolate({
    inputRange: [0, headerHeight],
    outputRange: [1, 0.96],
    extrapolate: 'clamp',
  });

  const onScroll = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: true },
      ),
    [scrollY],
  );

  const childContent = children({
    onScroll,
    scrollEventThrottle: 16,
    contentInsetTop: headerHeight + safeAreaTop,
    contentPaddingTop: headerHeight + safeAreaTop,
  });

  return (
    <View style={[styles.root, style]} testID={testID}>
      {childContent}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.headerOverlay,
          {
            height: headerHeight + safeAreaTop,
            paddingTop: safeAreaTop,
            opacity,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        {header}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, position: 'relative' },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});

export default CollapsibleHeaderContainer;
