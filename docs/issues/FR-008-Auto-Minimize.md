# [FR-008] Auto-Minimize on Modal Overlaps

## Labels
`MUS`, `enhancement`, `ui-interaction`, `reanimated`

## User Story
As an aspirant, I want the floating AI chat to automatically minimize into a bottom-right Brain FAB whenever another sheet or popup (like Save or Add to Notebook) is opened, so that the screen stays perfectly clean and free of overlapping clutter.

---

## Proposed Solution

### Automated Minimization Logic
The floating AI chat component subscribes to the active modal state. If any other popup is triggered (e.g. `saveSheetOpen === true` or `settingsOpen === true`), the card immediately minimizes itself to a non-obstructive floating circular FAB.

```mermaid
graph TD
    A[Save Popup Opened] -->|State Trigger| B(floating-ai-card: isMinimized.value = withSpring(1))
    B --> C[Transforms to 64px circular Brain FAB on bottom right]
    D[Save Popup Closed] -->|State Trigger| E(floating-ai-card: isMinimized.value = withSpring(0))
    E --> F[Re-expands to full 420px x 600px canvas]
```

### Technical Approach (Reanimated Morphing)

We morph the width, height, position, and border-radius using shared values to achieve a fluid, native-grade transition on iPad:

```typescript
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolate } from 'react-native-reanimated';

export function FloatingAICard({ isOtherPopupOpen }) {
  const isMinimized = useSharedValue(0); // 0 = full canvas, 1 = brain FAB

  React.useEffect(() => {
    isMinimized.value = withSpring(isOtherPopupOpen ? 1 : 0, { damping: 15 });
  }, [isOtherPopupOpen]);

  const animatedStyle = useAnimatedStyle(() => {
    const width = interpolate(isMinimized.value, [0, 1], [420, 64]);
    const height = interpolate(isMinimized.value, [0, 1], [600, 64]);
    const borderRadius = interpolate(isMinimized.value, [0, 1], [24, 32]);
    const opacity = interpolate(isMinimized.value, [0, 1], [1, 0.95]);

    return {
      width,
      height,
      borderRadius,
      opacity,
    };
  });

  return (
    <Animated.View style={[styles.card, animatedStyle]}>
      {isOtherPopupOpen ? (
        <TouchableOpacity onPress={() => isMinimized.value = withSpring(0)} style={styles.fabInner}>
          <Text style={{ fontSize: 24 }}>🧠</Text>
        </TouchableOpacity>
      ) : (
        <FullChatContent />
      )}
    </Animated.View>
  );
}
```

---

## Acceptance Criteria
- [ ] Floating AI Card automatically minimizes into a compact `64px x 64px` floating bubble in the bottom right corner when any other popup/modal (such as the Save Sheet) is opened.
- [ ] Floating bubble renders a premium **Brain emoji / Logo** inside it.
- [ ] Closing the other popup automatically re-expands the card to its original full-canvas state with a fluid spring animation.
- [ ] Tapping on the minimized bubble manual-triggers a re-expansion.
