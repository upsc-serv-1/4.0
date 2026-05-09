/**
 * CollapsibleHeaderContainer (Issue 31)
 * -------------------------------------
 * Wraps a screen body with a fade+translate header that mimics the Tracker
 * tab's premium scroll-linked motion. Drop-in replacement for any screen
 * currently using a sticky header above a `FlatList` / `ScrollView`.
 *
 *   <CollapsibleHeaderContainer
 *     header={<MyHeader />}
 *     headerHeight={120}
 *     scrollViewProps={{ data, renderItem, ... }}
 *     mode="flatlist"
 *   />
 *
 * The header opacity & translateY are interpolated against a single
 * `Animated.Value` driven by the inner scroll listener.
 */
import React, { useRef } from 'react';
import {
  Animated, View, StyleSheet, Platform, FlatListProps, ScrollViewProps,
  StyleProp, ViewStyle,
} from 'react-native';

interface BaseProps {
  header: React.ReactNode;
  /** Total height of the header (used for translateY range). */
  headerHeight?: number;
  /** Extra top safe-area inset (for status bar / notch). */
  topInset?: number;
  /** Background colour shown behind the header during fade (matches screen bg). */
  backgroundColor?: string;
  /** Disable the collapse animation (useful for keyboard-open screens). */
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

interface ScrollProps extends BaseProps {
  mode: 'scroll';
  scrollViewProps: ScrollViewProps;
  children: React.ReactNode;
}
interface FlatProps extends BaseProps {
  mode: 'flatlist';
  scrollViewProps: FlatListProps<any>;
}

export type CollapsibleHeaderContainerProps = ScrollProps | FlatProps;

const DEFAULT_HEADER_HEIGHT = 120;

export function CollapsibleHeaderContainer(props: CollapsibleHeaderContainerProps) {
  const headerHeight = props.headerHeight || DEFAULT_HEADER_HEIGHT;
  const topInset = props.topInset || 0;
  const scrollY = useRef(new Animated.Value(0)).current;

  // Smooth premium curve — most of the fade happens in the first 60% of the
  // header height to mirror the Tracker tab feel.
  const translateY = scrollY.interpolate({
    inputRange: [0, headerHeight],
    outputRange: [0, -headerHeight],
    extrapolate: 'clamp',
  });
  const opacity = scrollY.interpolate({
    inputRange: [0, headerHeight * 0.5, headerHeight],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  );

  const headerStyle: any = props.disabled
    ? null
    : { transform: [{ translateY }], opacity };

  return (
    <View style={[{ flex: 1, backgroundColor: props.backgroundColor }, props.containerStyle]}>
      {/* Animated header pinned to the top */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.header,
          {
            top: topInset,
            backgroundColor: props.backgroundColor || 'transparent',
            // Use elevation/zIndex so the header sits above the scroll content.
            ...Platform.select({
              web: { zIndex: 10 } as any,
              default: { elevation: 4 },
            }),
          },
          headerStyle,
        ]}
      >
        {props.header}
      </Animated.View>

      {/* Scrollable body */}
      {props.mode === 'flatlist' ? (
        <Animated.FlatList
          {...(props.scrollViewProps as any)}
          contentContainerStyle={[
            { paddingTop: topInset + headerHeight },
            (props.scrollViewProps as any).contentContainerStyle,
          ]}
          onScroll={onScroll}
          scrollEventThrottle={16}
          testID="pilot-collapsible-flatlist"
        />
      ) : (
        <Animated.ScrollView
          {...(props as ScrollProps).scrollViewProps}
          contentContainerStyle={[
            { paddingTop: topInset + headerHeight },
            ((props as ScrollProps).scrollViewProps as any)?.contentContainerStyle,
          ]}
          onScroll={onScroll}
          scrollEventThrottle={16}
          testID="pilot-collapsible-scroll"
        >
          {(props as ScrollProps).children}
        </Animated.ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
