import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: any;
}

export const SkeletonLine: React.FC<SkeletonLoaderProps> = ({ 
  width = '100%', 
  height = 12, 
  borderRadius = 6,
  style 
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.8],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#e5e7eb',
          opacity,
        },
        style,
      ]}
    />
  );
};

export const SkeletonCircle: React.FC<{ 
  size?: number; 
  style?: any;
}> = ({ size = 40, style }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.8],
  });

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#e5e7eb',
          opacity,
        },
        style,
      ]}
    />
  );
};

// List Item Skeleton - for question/note lists
export const SkeletonListItem: React.FC<{ style?: any }> = ({ style }) => (
  <View style={[styles.listItem, style]}>
    <SkeletonCircle size={48} style={{ marginRight: 12 }} />
    <View style={{ flex: 1 }}>
      <SkeletonLine width="80%" height={14} borderRadius={6} style={{ marginBottom: 8 }} />
      <SkeletonLine width="60%" height={12} borderRadius={6} />
    </View>
  </View>
);

// Card Skeleton - for question cards, notes
export const SkeletonCard: React.FC<{ style?: any }> = ({ style }) => (
  <View style={[styles.card, style]}>
    <SkeletonLine width="60%" height={16} borderRadius={6} style={{ marginBottom: 12 }} />
    <SkeletonLine width="100%" height={12} borderRadius={6} style={{ marginBottom: 8 }} />
    <SkeletonLine width="100%" height={12} borderRadius={6} style={{ marginBottom: 8 }} />
    <SkeletonLine width="85%" height={12} borderRadius={6} />
  </View>
);

// Grid Item Skeleton - for dashboard grids
export const SkeletonGridItem: React.FC<{ style?: any }> = ({ style }) => (
  <View style={[styles.gridItem, style]}>
    <SkeletonLine width="100%" height={100} borderRadius={12} style={{ marginBottom: 12 }} />
    <SkeletonLine width="70%" height={14} borderRadius={6} />
  </View>
);

// Flashcard Review Skeleton
export const SkeletonFlashcardReview: React.FC<{ colors: any }> = ({ colors }) => (
  <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
    {/* Header */}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
      <SkeletonCircle size={32} />
      <SkeletonLine width={100} height={32} borderRadius={16} />
      <SkeletonCircle size={32} />
    </View>

    {/* Main Card Area */}
    <View 
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
      }}
    >
      <SkeletonLine width="40%" height={16} borderRadius={6} style={{ marginBottom: 20 }} />
      <SkeletonLine width="100%" height={14} borderRadius={6} style={{ marginBottom: 12 }} />
      <SkeletonLine width="100%" height={14} borderRadius={6} style={{ marginBottom: 12 }} />
      <SkeletonLine width="80%" height={14} borderRadius={6} style={{ marginBottom: 40 }} />

      {/* Options */}
      {[1, 2, 3, 4].map((i) => (
        <View 
          key={i}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            padding: 12,
            marginBottom: 12,
            flexDirection: 'row',
          }}
        >
          <SkeletonCircle size={24} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <SkeletonLine width="100%" height={12} borderRadius={6} />
          </View>
        </View>
      ))}
    </View>

    {/* Action Buttons */}
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <SkeletonLine width="50%" height={48} borderRadius={10} />
      <SkeletonLine width="50%" height={48} borderRadius={10} />
    </View>
  </View>
);

// Notes List Skeleton
export const SkeletonNotesList: React.FC<{ colors: any }> = ({ colors }) => (
  <View style={{ flex: 1, backgroundColor: colors.bg }}>
    {/* Search bar */}
    <View style={{ padding: 16, backgroundColor: colors.bg }}>
      <SkeletonLine width="100%" height={44} borderRadius={10} />
    </View>

    {/* List items */}
    {[1, 2, 3, 4, 5].map((i) => (
      <SkeletonListItem key={i} style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }} />
    ))}
  </View>
);

// PYQ Analysis Skeleton
export const SkeletonPyqAnalysis: React.FC<{ colors: any }> = ({ colors }) => (
  <View style={{ flex: 1, backgroundColor: colors.bg }}>
    {/* Header */}
    <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <SkeletonLine width="60%" height={24} borderRadius={8} style={{ marginBottom: 8 }} />
      <SkeletonLine width="80%" height={14} borderRadius={6} />
    </View>

    {/* Stats Cards */}
    <View style={{ flexDirection: 'row', padding: 16, gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} style={{ flex: 1, height: 120 }} />
      ))}
    </View>

    {/* Chart area */}
    <View style={{ padding: 16 }}>
      <SkeletonLine width="40%" height={18} borderRadius={6} style={{ marginBottom: 16 }} />
      <View style={{ height: 200, backgroundColor: colors.surface, borderRadius: 12, opacity: 0.5 }} />
    </View>

    {/* Data list */}
    {[1, 2, 3].map((i) => (
      <SkeletonListItem key={i} style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }} />
    ))}
  </View>
);

// Analytics/Performance Skeleton
export const SkeletonAnalytics: React.FC<{ colors: any }> = ({ colors }) => (
  <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
    {/* Top stat boxes */}
    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} style={{ flex: 1, height: 100 }} />
      ))}
    </View>

    {/* Chart */}
    <SkeletonCard style={{ height: 250, marginBottom: 20 }} />

    {/* List items */}
    {[1, 2, 3, 4].map((i) => (
      <SkeletonListItem key={i} style={{ marginBottom: 12 }} />
    ))}
  </View>
);

// Generic Loader - shows multiple items
export const SkeletonLoader: React.FC<{ 
  type?: 'list' | 'grid' | 'card';
  count?: number;
  colors: any;
}> = ({ type = 'list', count = 5, colors }) => {
  if (type === 'grid') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {Array(count).fill(0).map((_, i) => (
            <SkeletonGridItem key={i} style={{ width: `${100 / 2 - 8}%` }} />
          ))}
        </View>
      </View>
    );
  }

  if (type === 'card') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
        {Array(count).fill(0).map((_, i) => (
          <SkeletonCard key={i} style={{ marginBottom: 16 }} />
        ))}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {Array(count).fill(0).map((_, i) => (
        <SkeletonListItem key={i} style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }} />
      ))}
    </View>
  );
};

// Dashboard Layout Skeleton
export const SkeletonDashboard: React.FC<{ colors: any }> = ({ colors }) => (
  <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 60 }}>
    {/* 1. Header Row */}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
      <View style={{ gap: 8 }}>
        <SkeletonLine width={100} height={12} borderRadius={6} />
        <SkeletonLine width={180} height={28} borderRadius={14} />
      </View>
      <SkeletonCircle size={50} />
    </View>

    {/* 2. Search Bar Capsule */}
    <SkeletonLine width="100%" height={52} borderRadius={26} style={{ marginBottom: 36 }} />

    {/* 3. Productivity Pulse Header */}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <SkeletonLine width={160} height={12} borderRadius={6} />
      <SkeletonCircle size={16} />
    </View>

    {/* 4. Productivity Grid (Two cards side-by-side) */}
    <View style={{ flexDirection: 'row', gap: 14, marginBottom: 36 }}>
      <View style={{ flex: 1, height: 124, borderRadius: 28, backgroundColor: colors.surface || '#fff', borderWidth: 1, borderColor: colors.border || '#e5e7eb', padding: 20, gap: 10 }}>
        <SkeletonCircle size={36} />
        <SkeletonLine width={50} height={20} borderRadius={10} />
        <SkeletonLine width={80} height={12} borderRadius={6} />
      </View>
      <View style={{ flex: 1, height: 124, borderRadius: 28, backgroundColor: colors.surface || '#fff', borderWidth: 1, borderColor: colors.border || '#e5e7eb', padding: 20, gap: 10 }}>
        <SkeletonCircle size={36} />
        <SkeletonLine width={50} height={20} borderRadius={10} />
        <SkeletonLine width={80} height={12} borderRadius={6} />
      </View>
    </View>

    {/* 5. Syllabus Mastery Large Card */}
    <View style={{ height: 260, borderRadius: 32, backgroundColor: colors.surface || '#fff', borderWidth: 1, borderColor: colors.border || '#e5e7eb', padding: 24, marginBottom: 36 }}>
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 24 }}>
        <SkeletonCircle size={44} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonLine width={140} height={16} borderRadius={8} />
          <SkeletonLine width={80} height={12} borderRadius={6} />
        </View>
        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <SkeletonLine width={50} height={20} borderRadius={10} />
          <SkeletonLine width={70} height={10} borderRadius={5} />
        </View>
      </View>
      
      {/* 2x2 Grid of Progress Bars */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 }}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ width: '48%', gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <SkeletonLine width={60} height={12} borderRadius={6} />
              <SkeletonLine width={30} height={12} borderRadius={6} />
            </View>
            <SkeletonLine width="100%" height={6} borderRadius={3} />
          </View>
        ))}
      </View>
    </View>

    {/* 6. Recent Notes Header */}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <SkeletonLine width={180} height={12} borderRadius={6} />
      <SkeletonLine width={80} height={12} borderRadius={6} />
    </View>
    
    {/* 7. Recent Notes cards (horizontal) */}
    <View style={{ flexDirection: 'row', gap: 16 }}>
      <View style={{ width: 190, height: 140, borderRadius: 28, backgroundColor: colors.surface || '#fff', borderWidth: 1, borderColor: colors.border || '#e5e7eb', padding: 20, gap: 12 }}>
        <SkeletonCircle size={36} />
        <SkeletonLine width={120} height={14} borderRadius={7} />
        <SkeletonLine width={80} height={11} borderRadius={5} />
      </View>
      <View style={{ flex: 1, height: 140, borderRadius: 28, backgroundColor: colors.surface || '#fff', borderWidth: 1, borderColor: colors.border || '#e5e7eb', padding: 20, gap: 12 }}>
        <SkeletonCircle size={36} />
        <SkeletonLine width={120} height={14} borderRadius={7} />
        <SkeletonLine width={80} height={11} borderRadius={5} />
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  card: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  gridItem: {
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    padding: 12,
  },
});
