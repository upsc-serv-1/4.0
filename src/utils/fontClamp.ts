import { ScaledSize } from 'react-native';

/**
 * Clamp font size based on screen width.
 * - Small phones (width < 360): scale down ~10%
 * - Tablets (width >= 768): scale up ~15% (capped)
 * - Standard phones: kept at base size
 *
 * Minimum readable sizes: 11px for captions, 14px for body text.
 */
export function getClampedFontSize(baseSize: number, width: number): number {
  'worklet'; // reanimated-compatible
  if (width < 360) {
    return Math.max(baseSize * 0.9, 11);
  }
  if (width >= 768) {
    return Math.min(baseSize * 1.15, baseSize * 1.5);
  }
  return baseSize;
}

/** Minimum tap target dimension per Apple HIG and Material guidelines */
export const MIN_TOUCH_TARGET = 44;

/**
 * Clamp a spacing value (padding, margin, gap) across device sizes.
 * Scales relative to a 375px baseline and caps tablet scaling at 1.35×.
 */
export function getResponsiveSpacing(
  base: number,
  { width }: ScaledSize,
): number {
  const raw = width / 375;
  const scale = width >= 768
    ? Math.min(Math.max(raw, 1.0), 1.35)
    : Math.min(Math.max(raw, 0.85), 1.15);
  return Math.round(base * scale);
}