# React Native Responsive Design Guidelines

This document establishes the responsive standards and rules for all Pilot Pro UI components. The Builder agent must adhere to these strict laws.

## 1. Dimension Metrics & Device Support

We support three main form factors across iOS (iPhone/iPad) and Android:
- **Small Phones** (Width < 375px): Focus on space conservation, smaller gaps, minimal typography, reflowing stacked buttons.
- **Standard Phones** (375px <= Width < 768px): Default target size. Follow standard mockups.
- **Tablets** (Width >= 768px): Focus on information density, centered max-width containers, multi-column grid reflows, and floating centered modal cards.

## 2. Layout Containment Rules

### No Massive Stretching
- **Rule:** Any screen displaying standard lists, profile information, stats, or text MUST NOT stretch edge-to-edge across the full width of an iPad.
- **Implementation:** Use a `max-width` boundary (target ~750px to 850px) and `alignSelf: 'center'` for the main content block on tablets.

### Modals & Sheets
- **Rule:** Bottom sheets on mobile must become floating, centered modals on tablets.
- **Constraint:** Max width of centered modals should be restricted to `540px` on iPads to maintain visual containment.

## 3. Responsive Values Implementation

### No Hardcoded Scaling Logic
- Use the upcoming `useResponsive` hook to drive style variances rather than raw `Platform.OS === 'ios'` or manual `Dimensions` calls scattered everywhere.
- Apply HSL tailored color schemes dynamically with theme providers, preserving visual excellence.

### Typography
- **Dynamic Font Clamping:** Avoid text clipping or wrapping to many lines on small phones by scaling headings down by 10-15% if screen width is under 360px.
- **Min Touch Targets:** All interactive elements (buttons, avatars, menu rows) MUST retain a minimum tappable height/width of **44px**, regardless of scale.

## 4. Safe Areas

- **Dynamic Insets:** Always import `useSafeAreaInsets` for absolute-positioned header elements, floating FABs, or fixed bottom toolbars.
- **Edge Insets:** Avoid double padding inside `PageWrapper` by selectively applying `edges={['top']}` or `edges={['bottom']}` on child views where appropriate.
