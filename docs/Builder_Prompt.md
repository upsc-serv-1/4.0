# Builder Prompt - Analytics Enhancements

## Stack-Specific Instructions
- Use **React Native** components from `src/components/unified`.
- For the **Stacked Status Bar**, create a custom shared component that takes `counts: { correct, incorrect, skipped }`.
- Ensure the hierarchical list is performant using `FlashList` or `SectionList` if nesting is deep.

## Mandatory Mockup-Driven Implementation
The `/docs/mockups` folder is the **UNQUESTIONABLE source of truth** for all front-end UI/UX.
You must NOT deviate from the layout, color palette, typography, or component structure defined in the mockups.
Specifically, replicate the **Stacked Status Bar** design and the **Subject -> Section Group -> Microtopic** drill-down structure from `analytics_breakdown.html`.

## MUS Priority Order
1. **FR-005**: Visual Status Meter component.
2. **FR-001**: Subject Breakdown logic and UI.
3. **FR-002**: Section Group Breakdown logic and UI.
4. **FR-004**: Hierarchical Navigation (Drill-down).
5. **FR-003**: Microtopic Error Analysis.

## Special Considerations
- Ensure the "vibe" segments (Green/Red/Gray) use the exact colors from the design system.
- Match the rounded corner radius (`radius.xl` or 24-32px) from the existing theme.
