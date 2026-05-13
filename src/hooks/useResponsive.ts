import { useWindowDimensions, Platform, ScaledSize } from 'react-native';

export interface ResponsiveContext {
  width: number;
  height: number;
  /** width < 375px — compact phone (iPhone SE 1st gen, small Androids) */
  isSmallPhone: boolean;
  /** 375px <= width < 768px — standard phone */
  isPhone: boolean;
  /** width >= 768px — iPad / large Android tablet */
  isTablet: boolean;
  /** width >= 1024px — iPad Pro landscape, large tablets */
  isLargeTablet: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  /** Multiplier for spacing, icon sizes, and padding. Clamped to prevent absurd tablet sizes. */
  scaleFactor: number;
  /**
   * Pick a value per device class.
   * - `phone` (required): value for standard phones
   * - `tablet` (required): value for tablets
   * - `smallPhone` (optional): overrides `phone` on compact screens
   */
  getResponsiveValue: <T>(values: { phone: T; tablet: T; smallPhone?: T }) => T;
}

const STANDARD_WIDTH = 375;

function computeScale(full: ScaledSize, isTablet: boolean, isSmallPhone: boolean): number {
  // Scale relative to 375px mockup baseline
  const raw = full.width / STANDARD_WIDTH;
  if (isTablet) return Math.min(Math.max(raw, 1.0), 1.35); // cap at 1.35× on huge iPads
  if (isSmallPhone) return Math.min(raw, 1.0);
  return Math.min(Math.max(raw, 0.85), 1.15);
}

export function useResponsive(): ResponsiveContext {
  const { width, height } = useWindowDimensions();

  const isSmallPhone = width < 375;
  const isTablet = width >= 768;
  const isLargeTablet = width >= 1024;
  const isIOS = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';

  const scaleFactor = computeScale({ width, height } as ScaledSize, isTablet, isSmallPhone);

  const getResponsiveValue = <T>(values: { phone: T; tablet: T; smallPhone?: T }): T => {
    if (isTablet) return values.tablet;
    if (isSmallPhone && values.smallPhone !== undefined) return values.smallPhone;
    return values.phone;
  };

  return {
    width,
    height,
    isSmallPhone,
    isPhone: !isTablet && !isSmallPhone,
    isTablet,
    isLargeTablet,
    isIOS,
    isAndroid,
    scaleFactor,
    getResponsiveValue,
  };
}