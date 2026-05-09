# Builder Prompt — Pilot V2 UI/UX Animation Law

## Mandatory Mockup-Driven Animation & Transition Law
The `/docs/design/animation-research.md` is the **UNQUESTIONABLE source of truth** for all front-end transition, expansion, and collapse physics in the sidebar.

You must NOT use static snaps or basic bounding-box layout transitions that cause micro-stutters or jerkiness. Before implementing or refining the sidebar, review the animation research file and implement the GPU-accelerated **React Native Reanimated** spring interpolation and correlated property fades exactly as specified.

---

## Priority Order for Next Session (Phase 6)

1. **Implement FR-005 (Inline Reanimated Spring Collapsible)**: 
   - Replace standard LayoutAnimation in `PilotV2Sidebar.tsx` with a Reanimated `<InlineCollapsible>` container.
   - Animate height, opacity, and translateY smoothly to achieve the fade-and-slide "emerging" look.
2. **Implement FR-006 (Viewport Edge Fade-out)**:
   - Apply ScrollView content-offset listeners to fade-out and scale-down sidebar items as they approach the top or bottom boundaries of the sidebar.
