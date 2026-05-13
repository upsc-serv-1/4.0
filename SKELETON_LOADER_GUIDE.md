# Skeleton Loader Usage Guide

## Quick Start

Import skeleton loaders in any screen:

```tsx
import { SkeletonLoader, SkeletonFlashcardReview, SkeletonAnalytics } from '../components/common/SkeletonLoader';
```

## Pre-built Screen Skeletons (Ready to Use)

### 1. Flashcard Review
```tsx
if (loading) {
  return <SkeletonFlashcardReview colors={colors} />;
}
```
Shows: Header + Main card area + Question with options + Action buttons

### 2. Analytics/Performance
```tsx
if (loading) {
  return <SkeletonAnalytics colors={colors} />;
}
```
Shows: Stat boxes + Chart area + List items

### 3. Notes List
```tsx
if (loading) {
  return <SkeletonNotesList colors={colors} />;
}
```
Shows: Search bar + List of note items

### 4. PYQ Analysis
```tsx
if (loading) {
  return <SkeletonPyqAnalysis colors={colors} />;
}
```
Shows: Header + Stats cards + Chart + Data list

## Generic Skeleton Loader

Use the generic loader for custom layouts:

```tsx
// List layout (default)
<SkeletonLoader type="list" count={5} colors={colors} />

// Grid layout
<SkeletonLoader type="grid" count={6} colors={colors} />

// Card layout
<SkeletonLoader type="card" count={3} colors={colors} />
```

## Individual Skeleton Components

Compose your own skeleton layouts:

### SkeletonLine
```tsx
<SkeletonLine 
  width="80%" 
  height={14} 
  borderRadius={6}
  style={{ marginBottom: 8 }}
/>
```

### SkeletonCircle
```tsx
<SkeletonCircle size={48} />
```

### SkeletonListItem
```tsx
<SkeletonListItem style={{ padding: 16 }} />
```

### SkeletonCard
```tsx
<SkeletonCard style={{ marginBottom: 16 }} />
```

### SkeletonGridItem
```tsx
<SkeletonGridItem style={{ width: '48%' }} />
```

## Customization

### Size Options
```tsx
// Small line
<SkeletonLine height={8} />

// Medium line
<SkeletonLine height={14} />

// Large line
<SkeletonLine height={24} />
```

### Positioning
```tsx
<SkeletonLine 
  width="100%" 
  height={14}
  style={{ marginBottom: 12, marginTop: 8 }}
/>
```

### Different Widths
```tsx
<SkeletonLine width="100%" height={14} />  // Full width
<SkeletonLine width="80%" height={14} />   // 80% width
<SkeletonLine width={200} height={14} />   // Fixed pixels
```

## Example: Custom Skeleton Layout

```tsx
if (loading) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
      {/* Header */}
      <SkeletonLine width="60%" height={24} borderRadius={8} style={{ marginBottom: 20 }} />

      {/* Content cards */}
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ marginBottom: 16 }}>
          <SkeletonLine width="100%" height={12} borderRadius={6} style={{ marginBottom: 8 }} />
          <SkeletonLine width="90%" height={12} borderRadius={6} style={{ marginBottom: 8 }} />
          <SkeletonLine width="70%" height={12} borderRadius={6} />
        </View>
      ))}
    </View>
  );
}
```

## Animation Details

- **Duration**: 1 second pulse cycle (0.5s fade-in, 0.5s fade-out)
- **Opacity range**: 0.4 (dim) to 0.8 (bright)
- **Performance**: Uses React Native's native `Animated` API for smooth 60fps
- **Loop**: Continuous until component unmounts

## Best Practices

✅ **Do**: Match the skeleton layout to the actual content layout  
✅ **Do**: Use theme colors for consistency  
✅ **Do**: Show skeletons for all content-loading states  
✅ **Do**: Keep skeleton durations under 2-3 seconds for perceived performance  

❌ **Don't**: Mix ActivityIndicator with skeleton loaders  
❌ **Don't**: Use hardcoded colors instead of theme colors  
❌ **Don't**: Show skeletons for minor UI updates  

## Screens Currently Using Skeleton Loaders

1. **Home Screen** (app/index.tsx) - Splash screen
2. **Flashcard Review** (app/flashcards/review.tsx) - Card review
3. **Softnotes** (app/softnotes/[notebookId].tsx) - Notebook editor
4. **Hardnotes Pro** (app/notes/pro-editor.tsx) - Note canvas
5. **Analytics** (src/components/AnalyseBetaSection.tsx) - Performance stats
6. **Test Results** (src/components/unified/ReviewSection.tsx) - Test analysis
7. **Note Glance** (src/components/notes/GlancePanel.tsx) - Quick preview

## Future Enhancement Opportunities

- **PYQ Analysis Screen** (app/pyq.tsx)
- **Tags Screen** (app/tags.tsx)
- **Browser Screen** (app/browser.tsx)
- **Notebook List** (app/softnotes/index.tsx)
- **Notes List** (app/notes/index.tsx)
- **Capsule Screen** (app/capsule/index.tsx)
- **Tracker/Syllabus** (app/tracker.tsx)

## Troubleshooting

**Skeleton not showing?**
- Make sure you're returning it in the `if (loading)` condition
- Verify `colors` prop is passed correctly from `useTheme()`

**Animation stuttering?**
- This shouldn't happen with native Animated API
- Check for heavy re-renders in parent component

**Wrong colors?**
- Pass `colors` from `useTheme()` hook
- Verify your theme colors are defined

**Layout mismatch?**
- Create custom skeleton using individual components
- Refer to "Example: Custom Skeleton Layout" section above
