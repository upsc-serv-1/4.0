# React Native Skeleton Loader for UPSC Quiz App

Copy the code below and use it in your React Native project (Expo or React Native CLI).

## Installation

First, install the required dependency for animations:

```bash
npm install react-native-reanimated
# or
yarn add react-native-reanimated
```

For Expo:
```bash
npx expo install react-native-reanimated
```

## SkeletonLoader.tsx

```tsx
import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const SkeletonBox = ({ style }: { style?: any }) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 1000 }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(opacity.value, [0.3, 1], [0.3, 1]),
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        style,
        animatedStyle,
      ]}
    />
  );
};

export function SkeletonLoader() {
  return (
    <View style={styles.container}>
      {/* Header Skeleton */}
      <View style={styles.header}>
        <SkeletonBox style={{ width: '75%', height: 28, borderRadius: 6 }} />
        <SkeletonBox style={{ width: '50%', height: 16, borderRadius: 6, marginTop: 8 }} />
      </View>

      {/* Progress Section */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <SkeletonBox style={{ width: 80, height: 16, borderRadius: 6 }} />
          <SkeletonBox style={{ width: 60, height: 16, borderRadius: 6 }} />
        </View>
        <View style={styles.progressBar}>
          <SkeletonBox style={{ width: '40%', height: 8, borderRadius: 999 }} />
        </View>
      </View>

      {/* Question Section */}
      <View style={styles.questionSection}>
        {/* Question Number */}
        <SkeletonBox style={{ width: 120, height: 20, borderRadius: 6, marginBottom: 16 }} />

        {/* Question Text */}
        <View style={{ marginBottom: 32 }}>
          <SkeletonBox style={{ width: '100%', height: 20, borderRadius: 6, marginBottom: 12 }} />
          <SkeletonBox style={{ width: '85%', height: 20, borderRadius: 6, marginBottom: 12 }} />
          <SkeletonBox style={{ width: '80%', height: 20, borderRadius: 6 }} />
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {['A', 'B', 'C', 'D'].map((option) => (
            <View key={option} style={styles.optionCard}>
              <SkeletonBox style={{ width: 24, height: 24, borderRadius: 999 }} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <SkeletonBox style={{ width: '100%', height: 16, borderRadius: 6, marginBottom: 8 }} />
                <SkeletonBox style={{ width: '75%', height: 16, borderRadius: 6 }} />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <SkeletonBox style={{ flex: 1, height: 48, borderRadius: 8, marginRight: 8 }} />
        <SkeletonBox style={{ flex: 1, height: 48, borderRadius: 8 }} />
      </View>

      {/* Timer (Floating) */}
      <View style={styles.timerFloat}>
        <SkeletonBox style={{ width: 20, height: 20, borderRadius: 999, marginRight: 8 }} />
        <SkeletonBox style={{ width: 48, height: 16, borderRadius: 6 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  skeleton: {
    backgroundColor: '#E5E7EB',
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  progressSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
  },
  questionSection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 8,
  },
  bottomNav: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  timerFloat: {
    position: 'absolute',
    top: 80,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});
```

## Usage in Your App

```tsx
import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native';
import { SkeletonLoader } from './components/SkeletonLoader';

export default function QuizScreen() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
    }, 2000);
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <SkeletonLoader />
      </SafeAreaView>
    );
  }

  return (
    // Your actual quiz content here
    <SafeAreaView style={{ flex: 1 }}>
      {/* Quiz content */}
    </SafeAreaView>
  );
}
```

## Alternative: Simple Version (Without react-native-reanimated)

If you don't want to use reanimated, here's a simpler version using basic React Native Animated API:

```tsx
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

const SkeletonBox = ({ style }: { style?: any }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        style,
        { opacity },
      ]}
    />
  );
};

// ... rest of the component code remains the same
```

## Customization Tips

1. **Colors**: Change the `backgroundColor` in the skeleton styles to match your app theme
2. **Animation Speed**: Adjust the `duration` values (default: 1000ms)
3. **Border Radius**: Modify `borderRadius` values to match your design system
4. **Spacing**: Adjust padding and gap values to match your layout

Enjoy your skeleton loader! 🎉
