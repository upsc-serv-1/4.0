# Complete Design Specification: UPSC Notes App
## Pixel-Perfect Implementation Guide

This document contains every design specification needed to recreate this application exactly. All measurements are in pixels unless otherwise stated.

**Version:** 2.0 - Complete 7-Screen Navigation System
**Last Updated:** 2026-05-08
**Target Platform:** iPad/Tablet Landscape (1024×768px primary)

---

## TABLE OF CONTENTS

1. [Color System](#1-color-system)
2. [Typography System](#2-typography-system)
3. [Spacing System](#3-spacing-system)
4. [Border Radius System](#4-border-radius-system)
5. [Layout Specifications](#5-layout-specifications)
6. [Navigation Flow & State Management](#6-navigation-flow--state-management)
7. [Icon Specifications](#7-icon-specifications)
8. [Shadow System](#8-shadow-system)
9. [Animation & Transitions](#9-animation--transitions)
10. [Responsive Breakpoints](#10-responsive-breakpoints)
11. [Specific Component Measurements](#11-specific-component-measurements)
12. [7-Screen Detailed Specifications](#12-7-screen-detailed-specifications)
13. [Editor Toolbar Complete Specification](#13-editor-toolbar-complete-specification)
14. [Scrolling & Infinite Scroll Behavior](#14-scrolling--infinite-scroll-behavior)
15. [Z-Index Layers](#15-z-index-layers)
16. [Accessibility Requirements](#16-accessibility-requirements)
17. [Data Structure Examples](#17-data-structure-examples)
18. [Implementation Checklist](#18-implementation-checklist)
19. [Exact Pixel Measurements Reference](#19-exact-pixel-measurements-reference)
20. [Final Notes](#20-final-notes)

---

## 1. COLOR SYSTEM

### Primary Colors
```css
--primary: #5B4EFA (Deep Indigo)
--primary-foreground: #FFFFFF
--primary-hover: #4D3FE8
--primary-light: #EEECFF (10% opacity background)
```

### Background Colors
```css
--canvas-background: #F9FAFB (Very light gray - main canvas)
--surface-background: #FFFFFF (Pure white - cards, sidebar, editor)
--input-background: #F3F3F5 (Input field backgrounds)
```

### Border Colors
```css
--border: #E5E7EB (Subtle light gray)
--border-opacity: 1
```

### Text Colors
```css
--text-primary: #111827 (Dark slate - headings, primary text)
--text-secondary: #6B7280 (Medium gray - metadata, secondary text)
--text-muted: #9CA3AF (Light gray - timestamps, hints)
```

### Tag/Highlight Colors
```css
/* Yellow Tag - "Key Point" */
--tag-yellow-bg: #FEF3C7
--tag-yellow-text: #92400E
--highlight-yellow: #FDE68A (inline text highlight)

/* Green Tag - "Important Case" */
--tag-green-bg: #D1FAE5
--tag-green-text: #065F46
--highlight-green: #86EFAC (inline text highlight)

/* Red Tag - "Unconstitutional" */
--tag-red-bg: #FEE2E2
--tag-red-text: #991B1B
--highlight-red: #FCA5A5 (inline text highlight)
```

### Subject Icon Colors
```css
--polity-bg: #E9D5FF (purple-100)
--polity-text: #7C3AED (purple-600)

--economy-bg: #FCE7F3 (pink-100)
--economy-text: #DB2777 (pink-600)

--history-bg: #FED7AA (orange-100)
--history-text: #EA580C (orange-600)

--geography-bg: #D1FAE5 (green-100)
--geography-text: #059669 (green-600)

--ethics-bg: #DBEAFE (blue-100)
--ethics-text: #2563EB (blue-600)

--environment-bg: #CCFBF1 (teal-100)
--environment-text: #0D9488 (teal-600)

--science-tech-bg: #FEF3C7 (amber-100)
--science-tech-text: #D97706 (amber-600)
```

---

## 2. TYPOGRAPHY SYSTEM

### Font Family
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

### Font Sizes & Line Heights
```css
/* H1 - Main page title */
h1 {
  font-size: 30px;
  line-height: 45px;
  font-weight: 500;
  letter-spacing: -0.02em;
}

/* H2 - Section headings */
h2 {
  font-size: 24px;
  line-height: 36px;
  font-weight: 500;
  letter-spacing: -0.01em;
}

/* H3 - Card titles */
h3 {
  font-size: 18px;
  line-height: 27px;
  font-weight: 500;
  letter-spacing: 0;
}

/* H4 - Small card titles */
h4 {
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  letter-spacing: 0;
}

/* Body text */
p, li {
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0;
}

/* Small text - metadata, timestamps */
.text-sm {
  font-size: 14px;
  line-height: 21px;
  font-weight: 400;
  letter-spacing: 0;
}

/* Extra small - tags, labels */
.text-xs {
  font-size: 12px;
  line-height: 18px;
  font-weight: 400;
  letter-spacing: 0.01em;
  text-transform: none;
}

/* Uppercase labels */
.text-uppercase {
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
```

### Font Weights
```css
--font-normal: 400
--font-medium: 500
--font-semibold: 600
```

---

## 3. SPACING SYSTEM

### Base Unit: 4px

All spacing uses multiples of 4px:
```css
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
--space-10: 40px
--space-12: 48px
--space-16: 64px
--space-20: 80px
```

### Component Spacing
```css
/* Card padding */
--card-padding-sm: 16px
--card-padding-md: 20px
--card-padding-lg: 24px

/* Section gaps */
--section-gap: 40px
--card-gap: 16px

/* List item gaps */
--list-gap: 12px
```

---

## 4. BORDER RADIUS SYSTEM

```css
--radius-sm: 6px (small buttons, tags)
--radius-md: 8px (inputs, small cards)
--radius-lg: 12px (medium cards, buttons)
--radius-xl: 16px (large cards, panels)
--radius-2xl: 20px (dashboard cards)
--radius-full: 9999px (circular elements, pills)
```

---

## 5. LAYOUT SPECIFICATIONS

### Left Sidebar (Home Mode)
```
Width: 300px
Height: 100vh
Background: #FFFFFF
Border-right: 1px solid #E5E7EB
Padding: 0

Logo Section:
  - Padding: 24px
  - Icon size: 40px × 40px
  - Icon background: #5B4EFA, border-radius: 12px
  - Icon color: #FFFFFF
  - Title: "Notes", 30px, weight 500
  - Gap between icon and title: 12px

Navigation Items:
  - Padding: 12px 16px
  - Margin: 0 16px
  - Gap between items: 4px
  - Border-radius: 12px
  - Icon size: 20px × 20px
  - Text: 14px, weight 400
  - Gap between icon and text: 12px
  - Active state: background #EEECFF, text #5B4EFA
  - Hover state: background #F9FAFB

Divider:
  - Height: 1px
  - Color: #E5E7EB
  - Margin: 0 16px

Subjects Section:
  - Padding: 24px 16px
  - Header: 11px, uppercase, letter-spacing 0.05em, color #6B7280
  - Subject items padding: 12px 16px
  - Subject icon: 32px × 32px, border-radius: 12px
  - Gap between icon and label: 12px
  - Chevron icon: 16px × 16px, opacity 0 → 100% on hover

Settings (Bottom):
  - Border-top: 1px solid #E5E7EB
  - Padding: 12px 16px
```

### Left Sidebar (Subject Mode)
```
Width: 300px
Height: 100vh
Background: #FFFFFF
Border-right: 1px solid #E5E7EB

Header Section:
  - Padding: 24px
  - Border-bottom: 1px solid #E5E7EB
  - Back button: padding 8px, text 14px, color #6B7280
  - Subject icon: 40px × 40px, border-radius: 12px
  - Subject title: 24px, weight 500
  - Gap: 12px

Topic List:
  - Padding: 16px
  - Topic item padding: 8px 12px
  - Border-radius: 8px
  - Number width: 20px, 12px, color #9CA3AF
  - Topic text: 14px, weight 400
  - Gap between number and text: 12px
  - Chevron: 16px × 16px
  - Active state: background #EEECFF, text #5B4EFA

Subtopic (Nested):
  - Margin-left: 32px
  - Padding: 8px 12px
  - Same styling as topics

Other Subjects (Bottom):
  - Border-top: 1px solid #E5E7EB
  - Padding: 16px
  - Max-height: 192px (overflow scroll)
  - Subject item: 32px height, icon 24px × 24px
```

### Main Dashboard Area
```
Width: calc(100% - 300px)
Height: 100vh
Background: #F9FAFB

Top Bar:
  - Padding: 24px 32px
  - Background: #F9FAFB (no border)
  - Greeting: h1 (30px)
  - Bell icon: 24px × 24px, with 8px red dot (absolute positioned top-right)
  - Avatar: 40px × 40px, border-radius: 50%
  - Gap between elements: 16px

Search Bar Container:
  - Padding: 0 32px 24px
  - Search input:
    - Padding: 12px 16px 12px 48px
    - Border: 1px solid #E5E7EB
    - Border-radius: 12px
    - Background: #FFFFFF
    - Icon left: 16px from edge, 20px × 20px
  - Grid button: 48px × 48px, border-radius: 12px
  - New button: padding 12px 24px, border-radius: 12px
  - Gap: 12px

Content Area:
  - Padding: 0 32px 32px

Section Headers:
  - Margin-bottom: 20px
  - Title: h2 (24px)
  - "See All" link: 14px, color #5B4EFA
  - Justify space-between

Continue Studying Cards (Horizontal Scroll):
  - Min-width: 240px
  - Padding: 20px
  - Background: #FFFFFF
  - Border: 1px solid #E5E7EB
  - Border-radius: 20px
  - Icon container: 48px × 48px, border-radius: 20px
  - Title: 16px, weight 500, margin-bottom 4px
  - Subject: 14px, color #6B7280
  - Timestamp: 12px, color #9CA3AF
  - Gap between cards: 16px
  - Hover: box-shadow: 0 8px 16px rgba(0,0,0,0.1)

Pinned Notes Grid (2×2):
  - Grid columns: 2
  - Gap: 16px
  - Card padding: 20px
  - Background: #FFFFFF
  - Border: 1px solid #E5E7EB
  - Border-radius: 20px
  - Icon: 40px × 40px, border-radius: 12px
  - Star icon: 20px × 20px, color #FBBF24
  - Title: 16px, weight 500
  - Metadata: 14px, color #6B7280

Recent Notes Grid (3 columns):
  - Grid columns: 3
  - Gap: 16px
  - Same card styling as Pinned Notes
```

### Empty State
```
Container:
  - Width: 100%
  - Height: 100%
  - Display: flex, center both axes
  - Background: #F9FAFB

Icon Container:
  - Width: 96px
  - Height: 96px
  - Background: #EEECFF
  - Border-radius: 50%
  - Icon: 48px × 48px, color #5B4EFA
  - Margin-bottom: 24px

Text:
  - Font-size: 16px
  - Color: #6B7280
  - Text-align: center
```

### Note List View
```
Header:
  - Padding: 16px 24px
  - Background: #FFFFFF
  - Border-bottom: 1px solid #E5E7EB
  - Back button: 32px × 32px, icon 20px
  - Title: 24px, weight 500
  - Margin-bottom: 16px

Search Row:
  - Input padding: 12px 16px 12px 48px
  - Border-radius: 12px
  - Background: #F9FAFB
  - New Note button: padding 12px 24px
  - Gap: 12px

Note Items:
  - Padding: 20px
  - Background: #FFFFFF
  - Border: 1px solid #E5E7EB
  - Border-radius: 12px
  - Margin-bottom: 8px
  - Icon: 40px × 40px, background #DBEAFE, border-radius: 12px
  - Title: 16px, weight 500
  - Timestamp: 14px, color #6B7280
  - Star icon: 20px × 20px (if pinned)
  - Three-dot menu: 16px × 16px, opacity 0 → 100% on hover
  - Gap between elements: 16px
  - Hover: box-shadow: 0 4px 12px rgba(0,0,0,0.08)
```

### Glance View (Reading Mode)
```
Header:
  - Padding: 16px 24px
  - Background: #FFFFFF
  - Border-bottom: 1px solid #E5E7EB
  - Back button: 32px × 32px
  - Title: 24px, weight 500
  - Action icons: 20px × 20px, gap 8px
  - Icon buttons: 32px × 32px, border-radius: 8px, hover #F9FAFB

Content Area:
  - Padding: 32px
  - Max-width: 896px (56rem)
  - Margin: 0 auto

Article Title:
  - Font-size: 36px
  - Line-height: 54px
  - Weight: 500
  - Margin-bottom: 32px

Section Spacing:
  - Margin-bottom: 40px

Section Title (h2):
  - Font-size: 24px
  - Weight: 500
  - Margin-bottom: 16px

Bullet Points:
  - List-style: disc inside
  - Gap: 12px
  - Font-size: 16px
  - Line-height: 24px
  - Color: #374151

Inline Highlights:
  - Yellow: background #FDE68A, padding 2px 0
  - Green: background #86EFAC, padding 2px 0
  - Red: background #FCA5A5, padding 2px 0

Tag Pills:
  - Padding: 4px 12px
  - Border-radius: 9999px
  - Font-size: 12px
  - Margin-top: 8px
  - Yellow: bg #FEF3C7, text #92400E
  - Green: bg #D1FAE5, text #065F46
  - Red: bg #FEE2E2, text #991B1B

End Divider:
  - Border-top: 1px solid #E5E7EB
  - Padding: 32px 0
  - Text: 14px, color #9CA3AF, center aligned
  - Content: "— End of Glance —"

Bottom Action Bar:
  - Padding: 12px 24px
  - Background: #FFFFFF
  - Border-top: 1px solid #E5E7EB
  - Button: padding 8px 24px, background #5B4EFA, color #FFFFFF
  - Border-radius: 8px
  - Font-size: 14px

Sidebar Collapse Button (Glance View Only):
  - Position: fixed, top 16px, left 16px
  - Width: 40px, Height: 40px
  - Background: #FFFFFF
  - Border: 1px solid #E5E7EB
  - Border-radius: 8px
  - Box-shadow: 0 4px 12px rgba(0,0,0,0.1)
  - Icon: 20px × 20px
  - Z-index: 10
```

### Editor View (Full Mode)
```
Top Bar:
  - Padding: 12px 24px
  - Background: #FFFFFF
  - Border-bottom: 1px solid #E5E7EB
  - Left section: document tabs + undo/redo
  - Right section: Saved indicator + close button
  - Undo/Redo icons: 16px × 16px, gap 8px
  - Saved text: 14px, color #059669, icon 16px

Title Section:
  - Padding: 16px 32px
  - Background: #FFFFFF
  - Border-bottom: 1px solid #E5E7EB
  - Title: 30px, weight 500, margin-bottom 16px

Toolbar:
  - Padding: 0
  - Display: flex, gap 4px
  - Button size: 28px × 28px (touch target)
  - Icon size: 20px × 20px
  - Border-radius: 6px
  - Hover background: #F3F4F6
  - Divider: 1px × 24px, color #E5E7EB, margin 0 4px

Highlight Color Picker:
  - Container: padding 12px
  - Background: #FFFFFF
  - Border: 1px solid #E5E7EB
  - Border-radius: 8px
  - Box-shadow: 0 8px 16px rgba(0,0,0,0.12)
  - Color swatches: 28px × 28px, border-radius 50%, gap 8px
  - Active ring: 2px, color #5B4EFA

Main Editor Area:
  - Display: flex
  - Left editor: flex-1
  - Right sidebar: 320px

Editor Content:
  - Padding: 32px
  - Background: #F9FAFB
  - Inner container: max-width 896px, background #FFFFFF
  - Inner padding: 32px
  - Border-radius: 8px
  - Min-height: 100%

Outline Sidebar:
  - Width: 320px
  - Background: #FFFFFF
  - Border-left: 1px solid #E5E7EB

Sidebar Tabs:
  - Height: 48px
  - Tab padding: 12px 16px
  - Font-size: 14px
  - Active: border-bottom 2px solid #5B4EFA, color #5B4EFA
  - Inactive: color #6B7280

Blocks List:
  - Padding: 16px
  - Item padding: 8px 12px
  - Border-radius: 8px
  - Hover: background #F9FAFB
  - Label (H1, H2): 12px, color #9CA3AF, width 24px
  - Text: 14px, truncate
  - Menu icon: 16px × 16px, color #9CA3AF
  - Gap: 12px

Bottom Toolbar:
  - Padding: 12px 24px
  - Background: #FFFFFF
  - Border-top: 1px solid #E5E7EB
  - Font size button: padding 4px 12px
  - Zoom button: padding 4px 12px
  - Icons: 16px × 16px
  - Word count: 14px, color #6B7280
```

---

## 12. 7-SCREEN DETAILED SPECIFICATIONS

This section provides complete pixel-perfect specifications for each of the 7 screen states.

### Screen 1: Home — Subject Hub (Dashboard)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Sidebar (300px)     │ Main Canvas (724px)           │
│ ┌─────────────────┐ │ ┌───────────────────────────┐ │
│ │ Notes Logo      │ │ │ Good Morning, Aspirant 👋 │ │
│ │ Home (active)   │ │ │ [Search] [Grid] [+New]    │ │
│ │ Pinned          │ │ │                           │ │
│ │ Recent          │ │ │ Continue Studying         │ │
│ │ Shared          │ │ │ [Card] [Card] [Card] →    │ │
│ │ Trash           │ │ │                           │ │
│ │ ─────────────   │ │ │ Pinned Notes              │ │
│ │ SUBJECTS        │ │ │ ┌────┐ ┌────┐            │ │
│ │ 🏛️ Polity       │ │ │ │Card│ │Card│            │ │
│ │ 💰 Economy      │ │ │ └────┘ └────┘            │ │
│ │ 📜 History      │ │ │ ┌────┐ ┌────┐            │ │
│ │ 🌍 Geography    │ │ │ │Card│ │Card│            │ │
│ │ ⚖️ Ethics       │ │ │ └────┘ └────┘            │ │
│ │ 🌱 Environment  │ │ └───────────────────────────┘ │
│ │ 🔬 Science      │ │                               │
│ │ + New Subject   │ │                               │
│ │ ─────────────   │ │                               │
│ │ ⚙️ Settings     │ │                               │
│ └─────────────────┘ │                               │
└─────────────────────────────────────────────────────┘
```

**Sidebar Specifications (Home Mode):**
```
Width: 300px
Height: 100vh
Background: #FFFFFF
Border-right: 1px solid #E5E7EB

Logo Section (px-6 py-6):
  Total height: ~88px
  Padding: 24px all sides
  Icon wrapper:
    - Width: 40px
    - Height: 40px
    - Background: #5B4EFA
    - Border-radius: 12px
    - Inner icon (Book): 24px × 24px, #FFFFFF
  Gap to text: 12px
  Text "Notes":
    - Font-size: 30px
    - Line-height: 45px
    - Font-weight: 500
    - Color: #111827

Navigation Section (px-4 pb-4 space-y-1):
  Container padding: 0 16px 16px 16px
  Item vertical gap: 4px
  
  Each navigation item:
    - Full width
    - Padding: 12px 16px
    - Border-radius: 12px
    - Icon: 20px × 20px
    - Icon-to-text gap: 12px
    - Text: 14px, weight 400
    - Color (inactive): #374151
    - Background (inactive): transparent
    - Hover background: #F9FAFB
    
  Active item (Home):
    - Background: #EEECFF
    - Text color: #5B4EFA
    - Icon color: #5B4EFA

Divider:
  - Height: 1px
  - Background: #E5E7EB
  - Margin: 0 16px

SUBJECTS Section (px-4 py-6):
  Header:
    - Padding-left: 16px
    - Margin-bottom: 12px
    - Text: "SUBJECTS"
    - Font-size: 11px
    - Font-weight: 500
    - Letter-spacing: 0.05em
    - Text-transform: uppercase
    - Color: #9CA3AF
  
  Subject Items (space-y-1):
    Each item:
      - Full width
      - Padding: 12px 16px
      - Border-radius: 12px
      - Background (hover): #F9FAFB
      - Transition: all 200ms ease
      
      Icon container:
        - Width: 32px
        - Height: 32px
        - Border-radius: 12px
        - Background: varies per subject
        - Emoji: 16px (base font size)
        - Centered
      
      Text:
        - Font-size: 14px
        - Weight: 400
        - Color: #374151
        - Flex: 1
      
      Chevron (on hover):
        - Width: 16px
        - Height: 16px
        - Color: #9CA3AF
        - Opacity: 0 → 1 (200ms transition)
        - Position: right edge

Settings (Bottom):
  - Border-top: 1px solid #E5E7EB
  - Padding: 12px
  - Same button style as navigation items
```

**Main Canvas Specifications (Dashboard):**
```
Width: calc(100% - 300px) = 724px
Height: 100vh
Background: #F9FAFB
Overflow-y: auto

Top Section (px-8 py-6):
  Padding: 24px 32px
  Background: #F9FAFB
  
  Greeting container (mb-8):
    Display: flex
    Justify: space-between
    Align-items: center
    
    Left side:
      H1: "Good Morning, Aspirant 👋"
        - Font-size: 30px
        - Line-height: 45px
        - Weight: 500
        - Margin-bottom: 4px
      
      Subtitle: "Ready to continue your preparation?"
        - Font-size: 16px
        - Color: #6B7280
    
    Right side (gap: 16px):
      Bell icon button:
        - Width: 48px
        - Height: 48px
        - Padding: 12px
        - Border-radius: 50%
        - Icon: 24px × 24px
        - Hover: background #F3F4F6
        - Position: relative
        
        Red notification dot:
          - Width: 8px
          - Height: 8px
          - Background: #EF4444
          - Border-radius: 50%
          - Position: absolute top-right
          - Top: 8px, Right: 8px
      
      Avatar:
        - Width: 40px
        - Height: 40px
        - Border-radius: 50%
        - Background: gradient purple-blue

Search Bar Section (px-8 pb-6):
  Padding: 0 32px 24px
  Display: flex
  Gap: 12px
  
  Search input container (flex-1):
    Position: relative
    
    Search icon:
      - Position: absolute
      - Left: 16px
      - Top: 50%, transform translateY(-50%)
      - Width: 20px
      - Height: 20px
      - Color: #9CA3AF
    
    Input field:
      - Width: 100%
      - Padding: 12px 16px 12px 48px
      - Background: #FFFFFF
      - Border: 1px solid #E5E7EB
      - Border-radius: 12px
      - Font-size: 16px
      - Placeholder color: #9CA3AF
      
      Focus state:
        - Outline: none
        - Ring: 2px solid #5B4EFA
        - Ring-opacity: 50%
        - Border-color: transparent
  
  Grid button:
    - Width: 48px
    - Height: 48px
    - Padding: 12px
    - Background: #FFFFFF
    - Border: 1px solid #E5E7EB
    - Border-radius: 12px
    - Icon: 20px × 20px, #6B7280
    - Hover: background #F9FAFB
  
  New button:
    - Padding: 12px 24px
    - Background: #5B4EFA
    - Color: #FFFFFF
    - Border-radius: 12px
    - Font-size: 14px
    - Weight: 500
    - Icon: 20px × 20px
    - Icon-to-text gap: 8px
    - Hover: background #4D3FE8

Content Area (px-8 pb-8):
  Padding: 0 32px 32px
  
  Section Header Pattern:
    Display: flex
    Justify: space-between
    Align-items: center
    Margin-bottom: 20px
    
    Title (H2):
      - Font-size: 24px
      - Line-height: 36px
      - Weight: 500
      - Color: #111827
    
    "See All" link:
      - Font-size: 14px
      - Color: #5B4EFA
      - Hover: text-decoration underline

Continue Studying Section (mb-10):
  Margin-bottom: 40px
  
  Cards container:
    Display: flex
    Gap: 16px
    Overflow-x: auto
    Padding-bottom: 8px
    
    Scrollbar styling:
      - Height: 4px
      - Background: #E5E7EB
      - Thumb: #9CA3AF
      - Border-radius: 2px
  
  Each card (button):
    Min-width: 240px
    Padding: 20px
    Background: #FFFFFF
    Border: 1px solid #E5E7EB
    Border-radius: 20px
    Text-align: left
    Cursor: pointer
    Transition: all 200ms ease
    
    Hover state:
      Box-shadow: 0 8px 16px rgba(0,0,0,0.1)
    
    Icon container:
      - Width: 48px
      - Height: 48px
      - Border-radius: 20px
      - Background: varies (subject color)
      - Margin-bottom: 16px
      - Display: flex
      - Align & justify: center
      
      Icon:
        - Width: 24px
        - Height: 24px
        - Color: varies
    
    Title (H3):
      - Font-size: 16px
      - Line-height: 24px
      - Weight: 500
      - Color: #111827
      - Margin-bottom: 8px
    
    Metadata row:
      Display: flex
      Justify: space-between
      
      Subject label:
        - Font-size: 14px
        - Color: #6B7280
      
      Timestamp:
        - Font-size: 14px
        - Color: #6B7280

Pinned Notes Section:
  Grid: 2 columns
  Gap: 16px
  
  Each card:
    Padding: 20px
    Background: #FFFFFF
    Border: 1px solid #E5E7EB
    Border-radius: 20px
    Hover: box-shadow 0 8px 16px rgba(0,0,0,0.1)
    
    Header row (mb-16px):
      Display: flex
      Justify: space-between
      Margin-bottom: 16px
      
      Icon container:
        - Width: 40px
        - Height: 40px
        - Background: #DBEAFE
        - Border-radius: 12px
        - Icon: 20px × 20px, #2563EB
      
      Star icon:
        - Width: 20px
        - Height: 20px
        - Color: #FBBF24
        - Fill: #FBBF24
    
    Title (H4):
      - Font-size: 16px
      - Line-height: 24px
      - Weight: 500
      - Margin-bottom: 8px
    
    Metadata:
      Display: flex
      Justify: space-between
      Font-size: 14px
      Color: #6B7280
```

---

### Screen 2: Subject Selected — Polity (Empty State)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Sidebar (300px)     │ Main Canvas (724px)           │
│ ┌─────────────────┐ │ ┌───────────────────────────┐ │
│ │ ← Back          │ │ │                           │ │
│ │ 🏛️ Polity       │ │ │                           │ │
│ │                 │ │ │         ┌─────┐           │ │
│ │ 1. Constitution │ │ │         │ 📖  │           │ │
│ │ 2. Fund. Rights ▼│ │ │         └─────┘           │ │
│ │ 3. Dir. Princip.│ │ │                           │ │
│ │ 4. Fund. Duties │ │ │  Select a topic to        │ │
│ │ 5. Executive    │ │ │  view notes               │ │
│ │ 6. Legislature  │ │ │                           │ │
│ │ ...             │ │ │                           │ │
│ │                 │ │ │                           │ │
│ │ ─────────────   │ │ └───────────────────────────┘ │
│ │ Other Subjects  │ │                               │
│ │ 💰 Economy      │ │                               │
│ │ 📜 History      │ │                               │
│ └─────────────────┘ │                               │
└─────────────────────────────────────────────────────┘
```

**Sidebar Specifications (Subject Mode):**
```
Width: 300px
Height: 100vh
Background: #FFFFFF
Border-right: 1px solid #E5E7EB

Header Section (px-6 py-6, border-bottom):
  Padding: 24px
  Border-bottom: 1px solid #E5E7EB
  
  Back button (mb-4):
    Display: flex
    Align-items: center
    Gap: 8px
    Padding: 8px
    Margin-bottom: 16px
    Color: #6B7280
    Hover: color #111827
    Cursor: pointer
    
    Icon (ChevronLeft):
      - Width: 20px
      - Height: 20px
    
    Text "Back":
      - Font-size: 14px
      - Weight: 400
  
  Subject header:
    Display: flex
    Align-items: center
    Gap: 12px
    
    Icon container:
      - Width: 40px
      - Height: 40px
      - Border-radius: 12px
      - Background: #E9D5FF
      - Color: #7C3AED
      - Emoji: 20px
    
    Title "Polity":
      - Font-size: 24px
      - Line-height: 36px
      - Weight: 500
      - Color: #111827

Topic List Section (px-4 py-4):
  Padding: 16px
  Flex: 1
  Overflow-y: auto
  
  Each topic item:
    Width: 100%
    Display: flex
    Align-items: center
    Gap: 12px
    Padding: 8px 12px
    Border-radius: 8px
    Cursor: pointer
    Transition: all 150ms ease
    
    Number label:
      - Width: 20px
      - Font-size: 12px
      - Color: #9CA3AF
      - Text-align: right
    
    Topic text:
      - Flex: 1
      - Font-size: 14px
      - Weight: 400
      - Color: #374151
      - Text-align: left
    
    Chevron (for expandable topics):
      - Width: 16px
      - Height: 16px
      - Color: #9CA3AF
      - Transform: rotate(-90deg) when collapsed
      - Transform: rotate(0deg) when expanded
      - Transition: transform 200ms ease
    
    States:
      Default:
        - Background: transparent
        - Text: #374151
      
      Hover:
        - Background: #F9FAFB
      
      Active/Selected:
        - Background: #EEECFF
        - Text: #5B4EFA
        - Number: #5B4EFA
  
  Nested subtopics:
    Margin-left: 32px
    Margin-top: 4px
    
    Each subtopic:
      - Same styling as parent topic
      - No number label
      - Padding: 8px 12px

Other Subjects Section (Bottom):
  Border-top: 1px solid #E5E7EB
  Padding: 16px
  
  Header:
    - Padding: 0 12px 8px
    - Text: "Other Subjects"
    - Font-size: 11px
    - Text-transform: uppercase
    - Letter-spacing: 0.05em
    - Color: #9CA3AF
  
  Subject list:
    Max-height: 192px
    Overflow-y: auto
    Display: flex
    Flex-direction: column
    Gap: 4px
    
    Each subject button:
      Display: flex
      Align-items: center
      Gap: 8px
      Padding: 8px 12px
      Border-radius: 8px
      Cursor: pointer
      
      Icon:
        - Width: 24px
        - Height: 24px
        - Border-radius: 6px
        - Background: varies
        - Emoji: 12px
      
      Text:
        - Font-size: 14px
        - Color: #6B7280
      
      Hover:
        - Background: #F9FAFB
```

**Empty State Specifications:**
```
Container:
  Width: 100%
  Height: 100vh
  Background: #F9FAFB
  Display: flex
  Align-items: center
  Justify-content: center

Content wrapper:
  Text-align: center
  
  Icon container:
    - Width: 96px
    - Height: 96px
    - Background: #EEECFF (primary/10)
    - Border-radius: 50%
    - Margin: 0 auto 24px
    - Display: flex
    - Align & justify: center
    
    BookOpen icon:
      - Width: 48px
      - Height: 48px
      - Color: #5B4EFA
  
  Text:
    - Font-size: 16px
    - Line-height: 24px
    - Color: #6B7280
    - Text: "Select a topic to view notes"
```

---

### Screen 3: Topic Expanded — Fundamental Rights

```
Same as Screen 2, with these changes:

Sidebar Topic List:
  Topic 2 "Fundamental Rights" is expanded:
    - Chevron rotated to down (0deg)
    - Subtopics visible below
    - Margin-top: 4px applied to subtopic container
    
  Subtopic list (ml-8 mt-1 space-y-1):
    - Preamble
    - Right to Equality (pre-selected/hover state)
    - Right to Freedom
    - Right against Exploitation
    - Right to Freedom of Religion
    - Cultural & Educational Rights
    - Right to Constitutional Remedies
  
  "Right to Equality" hover/pre-selection state:
    - Background: #EEECFF
    - Text color: #5B4EFA
    - Cursor: pointer

Main Canvas:
  - Still shows empty state
  - Same specifications as Screen 2
```

---

### Screen 4: Sub-Topic Selected — Right to Equality (Note List)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Sidebar (expanded)  │ Note List View (724px)        │
│                     │ ┌───────────────────────────┐ │
│ (Same as Screen 3)  │ │ ← Right to Equality       │ │
│                     │ │ [Search...] [+ New Note]  │ │
│                     │ ├───────────────────────────┤ │
│                     │ │ 📄 General Overview... ⭐ │ │
│                     │ │    Today, 9:47 AM      ⋮  │ │
│                     │ ├───────────────────────────┤ │
│                     │ │ 📄 Article 14 — Equal...  │ │
│                     │ │    Today, 9:41 AM      ⋮  │ │
│                     │ ├───────────────────────────┤ │
│                     │ │ 📄 Article 15 — Proh...   │ │
│                     │ │    Yesterday           ⋮  │ │
│                     │ └───────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Note List View Specifications:**
```
Container:
  Width: calc(100% - 300px)
  Height: 100vh
  Background: #F9FAFB
  Display: flex
  Flex-direction: column

Header Section (Sticky):
  Background: #FFFFFF
  Border-bottom: 1px solid #E5E7EB
  Padding: 16px 24px
  Position: sticky
  Top: 0
  Z-index: 20
  
  Title row (mb-4):
    Display: flex
    Align-items: center
    Gap: 16px
    Margin-bottom: 16px
    
    Back button:
      - Width: 32px
      - Height: 32px
      - Padding: 8px
      - Border-radius: 8px
      - Hover: background #F9FAFB
      
      Icon (ChevronLeft):
        - Width: 20px
        - Height: 20px
        - Color: #6B7280
    
    Title (H2):
      - Font-size: 24px
      - Line-height: 36px
      - Weight: 500
      - Color: #111827
  
  Search row:
    Display: flex
    Gap: 12px
    
    Search input container (flex-1):
      Position: relative
      
      Icon:
        - Position: absolute
        - Left: 16px
        - Top: 50%, translateY(-50%)
        - Width: 20px
        - Height: 20px
        - Color: #9CA3AF
      
      Input:
        - Width: 100%
        - Padding: 12px 16px 12px 48px
        - Background: #F9FAFB
        - Border: 1px solid #E5E7EB
        - Border-radius: 12px
        - Font-size: 16px
        - Placeholder: "Search in Right to Equality..."
        
        Focus:
          - Outline: none
          - Ring: 2px #5B4EFA 50%
          - Border: transparent
    
    New Note button:
      - Padding: 12px 24px
      - Background: #5B4EFA
      - Color: #FFFFFF
      - Border-radius: 12px
      - Font-size: 14px
      - Weight: 500
      - Icon: 20px × 20px
      - Gap: 8px
      - Hover: background #4D3FE8

Note List Container:
  Flex: 1
  Overflow-y: auto
  Padding: 16px 24px
  
  Note items container:
    Display: flex
    Flex-direction: column
    Gap: 8px
  
  Each note item (button):
    Width: 100%
    Display: flex
    Align-items: center
    Gap: 16px
    Padding: 16px 20px
    Background: #FFFFFF
    Border: 1px solid #E5E7EB
    Border-radius: 12px
    Text-align: left
    Cursor: pointer
    Transition: all 200ms ease
    Position: relative
    
    Hover state:
      Box-shadow: 0 4px 12px rgba(0,0,0,0.08)
    
    Icon container:
      - Width: 40px
      - Height: 40px
      - Background: #DBEAFE
      - Border-radius: 12px
      - Shrink: 0
      - Display: flex
      - Align & justify: center
      
      Icon (FileText):
        - Width: 20px
        - Height: 20px
        - Color: #2563EB
    
    Content section:
      Flex: 1
      Min-width: 0 (for text truncation)
      
      Title (H4):
        - Font-size: 16px
        - Line-height: 24px
        - Weight: 500
        - Color: #111827
        - Margin-bottom: 4px
        - White-space: nowrap
        - Overflow: hidden
        - Text-overflow: ellipsis
      
      Timestamp:
        - Font-size: 14px
        - Line-height: 21px
        - Color: #6B7280
    
    Star icon (if pinned):
      - Width: 20px
      - Height: 20px
      - Color: #FBBF24
      - Fill: #FBBF24
      - Shrink: 0
    
    More menu button:
      - Width: 32px
      - Height: 32px
      - Padding: 8px
      - Border-radius: 8px
      - Opacity: 0
      - Transition: opacity 200ms
      - Hover: background #F3F4F6
      
      Parent hover → Opacity: 1
      
      Icon (MoreVertical):
        - Width: 16px
        - Height: 16px
        - Color: #9CA3AF
```

---

### Screen 5: Note Open — Glance View (Infinite Scroll)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Sidebar (300px)     │ Reading View (724px)          │
│                     │ ┌─────────────── STICKY ────┐ │
│ (Same as Screen 4)  │ │ ← Article 14  🔔 ↗ ⋮ Edit│ │
│                     │ ├───────────────────────────┤ │
│                     │ │ Article 14 — Equality...  │ │
│                     │ │                           │ │
│                     │ │ Introduction              │ │
│                     │ │ • Guarantees equality     │ │
│                     │ │ • Two concepts...         │ │
│                     │ │                           │ │
│                     │ │ Rule of Law               │ │
│                     │ │ • Dicey's principles      │ │
│                     │ │                           │ │
│                     │ │ [SCROLLABLE CONTENT]      │ │
│                     │ │ [8 SECTIONS TOTAL]        │ │
│                     │ │ [15+ BULLET POINTS]       │ │
│                     │ │                           │ │
│                     │ │ — End of Glance —         │ │
│                     │ ├───────────────────────────┤ │
│                     │ │    [Open in Editor]       │ │
│                     │ └───────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Glance View Complete Specifications:**
```
Container:
  Width: calc(100% - 300px)
  Height: 100vh
  Background: #F9FAFB
  Display: flex
  Flex-direction: column
  Overflow: hidden

Sticky Header:
  Background: #FFFFFF
  Border-bottom: 1px solid #E5E7EB
  Padding: 16px 24px
  Position: sticky
  Top: 0
  Z-index: 20
  Shrink: 0
  
  Layout:
    Display: flex
    Justify: space-between
    Align-items: center
  
  Left section:
    Display: flex
    Align-items: center
    Gap: 16px
    
    Back button:
      - Width: 32px
      - Height: 32px
      - Padding: 8px
      - Border-radius: 8px
      - Hover: background #F9FAFB
      - Icon: 20px × 20px
    
    Title (H2):
      - Font-size: 24px
      - Weight: 500
      - Color: #111827
  
  Right section:
    Display: flex
    Align-items: center
    Gap: 8px
    
    Action buttons (all same size):
      - Width: 32px
      - Height: 32px
      - Padding: 8px
      - Border-radius: 8px
      - Hover: background #F9FAFB
      - Cursor: pointer
      
      Icons:
        - Bell: 20px × 20px
        - Share2: 20px × 20px
        - Upload: 20px × 20px
        - MoreVertical: 20px × 20px
        - Color: #6B7280

Scrollable Content Area:
  Flex: 1
  Overflow-y: auto
  Padding: 32px
  
  CRITICAL: This area MUST be scrollable with massive content
  Height calculation: calc(100vh - HeaderHeight - FooterHeight)
  
  Content container:
    Max-width: 896px (56rem)
    Margin: 0 auto
    
    Document structure:
      Main title section (mb-8):
        Display: flex
        Justify: space-between
        Align-items: start
        
        H1:
          - Font-size: 36px
          - Line-height: 54px
          - Weight: 500
          - Color: #111827
          - Flex: 1
        
        Tag pill:
          - Padding: 4px 12px
          - Border-radius: 9999px
          - Background: #FEF3C7
          - Color: #92400E
          - Font-size: 12px
          - Margin-left: 16px
          - Shrink: 0
      
      Subtitle/intro (mb-8):
        - Font-size: 18px
        - Line-height: 27px
        - Color: #6B7280
        - Margin-bottom: 32px
      
      Section spacing:
        - Margin-bottom: 40px
      
      Section H2:
        - Font-size: 24px
        - Line-height: 36px
        - Weight: 500
        - Color: #111827
        - Margin-bottom: 16px
      
      Bullet list (ul):
        - List-style: disc inside
        - Gap: 16px (space-y-4)
        - Font-size: 16px
        - Line-height: 24px
        - Color: #374151
        
        Each list item (li):
          Contains paragraphs with:
          - Inline highlights (bg-yellow-200, bg-green-200, bg-red-200)
          - Tag pills below paragraphs
          - Bold text for case names
      
      Tag pills (inline with content):
        - Display: inline-flex
        - Padding: 4px 12px
        - Border-radius: 9999px
        - Font-size: 12px
        - Line-height: 18px
        - Margin-top: 8px
        
        Yellow "Key Point":
          - Background: #FEF3C7
          - Color: #92400E
        
        Green "Important Case":
          - Background: #D1FAE5
          - Color: #065F46
        
        Red "Important":
          - Background: #FEE2E2
          - Color: #991B1B
      
      Inline highlights:
        <span> with backgrounds:
          - Yellow: #FDE68A (bg-yellow-200)
          - Green: #86EFAC (bg-green-200)
          - Red: #FCA5A5 (bg-red-200)
          - Padding: 2px 0
    
    End marker:
      - Border-top: 1px solid #E5E7EB
      - Padding: 32px 0
      - Text-align: center
      - Font-size: 14px
      - Color: #9CA3AF
      - Text: "— End of Glance —"
      - Margin-top: 64px

Bottom Action Bar:
  Background: #FFFFFF
  Border-top: 1px solid #E5E7EB
  Padding: 12px 24px
  Shrink: 0
  
  Layout:
    Display: flex
    Justify-content: center
  
  Button:
    Padding: 8px 24px
    Background: #5B4EFA
    Color: #FFFFFF
    Border-radius: 8px
    Font-size: 14px
    Weight: 500
    Hover: background #4D3FE8
    Cursor: pointer

CONTENT SECTIONS (8 Total for Scrolling):
1. Introduction to Equality Before Law (3 bullets)
2. The Rule of Law and Dicey's Principles (3 bullets)
3. Exceptions to Article 14 (4 bullets)
4. Doctrine of Reasonable Classification (3 bullets)
5. Landmark Judicial Pronouncements (4 bullets)
6. Relationship with Other Fundamental Rights (4 bullets)
7. Modern Interpretations (3 bullets)
8. Critical Analysis and Challenges (3 bullets)

Total: 27 paragraphs with extensive text
Ensures vertical scrolling is required
Scrollbar always visible on right edge
```

---

### Screen 6: Sidebar Collapsed — Full-Width Reading

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ [<] Full-Width Reading View (1024px)                │
│ ┌───────────────────── STICKY ─────────────────────┐│
│ │ ← Article 14       🔔 ↗ ⋮ Edit                  ││
│ ├──────────────────────────────────────────────────┤│
│ │                                                   ││
│ │  Article 14 — Equality Before Law                ││
│ │                                                   ││
│ │  [SAME CONTENT AS SCREEN 5]                      ││
│ │  [EXPANDED TO FULL WIDTH]                        ││
│ │  [STILL SCROLLABLE]                              ││
│ │                                                   ││
│ │  — End of Glance —                               ││
│ ├──────────────────────────────────────────────────┤│
│ │              [Open in Editor]                     ││
│ └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
Button position: Fixed top-left (16px, 16px)
```

**Specifications:**
```
Same as Screen 5, with these changes:

Sidebar:
  - Display: none

Main content:
  - Width: 100% (full 1024px viewport)
  - All other measurements identical

Collapse/Expand Toggle Button:
  Position: fixed
  Top: 16px
  Left: 16px
  Z-index: 10
  
  Button styling:
    - Width: 40px
    - Height: 40px
    - Padding: 8px
    - Background: #FFFFFF
    - Border: 1px solid #E5E7EB
    - Border-radius: 8px
    - Box-shadow: 0 4px 12px rgba(0,0,0,0.1)
    - Cursor: pointer
    - Transition: all 200ms ease
    
    Hover:
      - Background: #F9FAFB
    
    Icon:
      - Width: 20px
      - Height: 20px
      - Color: #6B7280
      
      When sidebar collapsed: PanelLeft
      When sidebar visible: PanelLeftClose

Content container max-width:
  - Remains 896px
  - Centers in full width
  - More breathing room on sides
```

---

### Screen 7: Open Editor — Dedicated Note Editor

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Full Editor View (1024px)                           │
│ ┌─── TOP BAR ────────────────────────────────────┐ │
│ │ Article 21  ↶ ↷              💾 Saved      ✕  │ │
│ ├────────────────────────────────────────────────┤ │
│ │ Article 14 — Equality Before Law              │ │
│ │ H1 H2 B I U | • ○ ☑ | 🖍 🔗 📷 📅 📎 □ <>   │ │
│ ├─────────────────────┬──────────────────────────┤ │
│ │                     │ ┌─ Blocks | Outline ─┐  │ │
│ │  Key Points         │ │ H1  Protection...   │  │ │
│ │  • No person...     │ │ H2  Key Points      │  │ │
│ │  • Interpreted...   │ │ H2  Important Cases │  │ │
│ │                     │ │ H2  Checklist       │  │ │
│ │  Important Cases    │ │                     │  │ │
│ │  • Maneka...        │ │                     │  │ │
│ │                     │ │                     │  │ │
│ │  [EDITABLE CONTENT] │ │                     │  │ │
│ │                     │ │                     │  │ │
│ ├─────────────────────┴──────────────────────────┤ │
│ │ Aa  100% ▼                      Words: 1234   │ │
│ └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Complete Editor Specifications:**
```
Container:
  Width: 100vw (1024px)
  Height: 100vh
  Background: #FFFFFF
  Display: flex
  Flex-direction: column
  Overflow: hidden

Top Bar:
  Height: 48px
  Padding: 12px 24px
  Background: #FFFFFF
  Border-bottom: 1px solid #E5E7EB
  Display: flex
  Justify: space-between
  Align-items: center
  Shrink: 0
  
  Left section:
    Display: flex
    Align-items: center
    Gap: 16px
    
    Document tab:
      - Font-size: 14px
      - Color: #111827
      - Padding: 4px 8px
    
    Undo button:
      - Width: 24px
      - Height: 24px
      - Padding: 4px
      - Border-radius: 4px
      - Hover: background #F3F4F6
      - Icon (RotateCcw): 16px × 16px, #6B7280
    
    Redo button:
      - Same as undo
      - Icon (RotateCw): 16px × 16px
  
  Right section:
    Display: flex
    Align-items: center
    Gap: 8px
    
    Saved indicator:
      Display: flex
      Align-items: center
      Gap: 8px
      Font-size: 14px
      Color: #059669
      
      Icon (Save):
        - Width: 16px
        - Height: 16px
    
    Close button (if applicable):
      - Width: 32px
      - Height: 32px
      - Padding: 8px
      - Border-radius: 8px
      - Hover: background #F3F4F6
      - Icon (X): 20px × 20px

Title & Toolbar Section:
  Padding: 16px 32px
  Background: #FFFFFF
  Border-bottom: 1px solid #E5E7EB
  Shrink: 0
  
  Document title (H1):
    - Font-size: 30px
    - Line-height: 45px
    - Weight: 500
    - Color: #111827
    - Margin-bottom: 16px
    - Editable contenteditable div
  
  Toolbar:
    Display: flex
    Align-items: center
    Gap: 4px
    Flex-wrap: wrap
    
    Button specifications:
      Standard toolbar button:
        - Width: 28px
        - Height: 28px
        - Padding: 4px
        - Border-radius: 6px
        - Background: transparent
        - Cursor: pointer
        - Transition: background 150ms ease
        
        Hover:
          - Background: #F3F4F6
        
        Active:
          - Background: #E5E7EB
      
      Icon size: 20px × 20px
      Icon color: #374151
    
    Text buttons (H1, H2):
      - Padding: 6px 12px
      - Font-size: 14px
      - Font-weight: 500
      - Border-radius: 6px
    
    Divider:
      - Width: 1px
      - Height: 24px
      - Background: #E5E7EB
      - Margin: 0 4px
    
    Toolbar layout (left to right):
      1. H1 button (text)
      2. H2 button (text)
      3. Bold icon
      4. Italic icon
      5. Underline icon
      6. Divider
      7. Numbered list icon
      8. Bullet list icon
      9. Todo list icon
      10. Divider
      11. Highlight color picker
      12. Link icon
      13. Image icon
      14. Calendar icon
      15. Paperclip icon
      16. Table icon
      17. Code icon
    
    Highlight Color Picker:
      Button:
        - Width: 28px
        - Height: 28px
        - Padding: 4px
        
        Display square:
          - Width: 20px
          - Height: 20px
          - Background: #FDE68A (yellow-300)
          - Border-radius: 2px
      
      Dropdown (when open):
        Position: absolute
        Top: calc(100% + 8px)
        Left: 0
        Padding: 12px
        Background: #FFFFFF
        Border: 1px solid #E5E7EB
        Border-radius: 8px
        Box-shadow: 0 8px 24px rgba(0,0,0,0.12)
        Z-index: 10
        
        Color swatches container:
          Display: flex
          Gap: 8px
          
          Each swatch:
            - Width: 28px
            - Height: 28px
            - Border-radius: 50%
            - Cursor: pointer
            - Transition: all 150ms
            
            Hover:
              - Ring: 2px solid #5B4EFA
            
            Active:
              - Ring: 2px solid #5B4EFA
            
            Colors:
              1. Yellow: #FDE68A
              2. Lime: #D9F99D
              3. Green: #86EFAC
              4. Pink: #FBCFE8
              5. Purple: #DDD6FE
              6. Blue: #BFDBFE

Main Content Split:
  Display: flex
  Flex: 1
  Overflow: hidden
  
  Left: Editor Area
    Flex: 1
    Overflow-y: auto
    Padding: 32px
    Background: #F9FAFB
    
    Inner container:
      Max-width: 896px
      Margin: 0 auto
      Padding: 32px
      Background: #FFFFFF
      Border-radius: 8px
      Min-height: 100%
      
      Content:
        [Editable rich text content]
        
        H2 styling:
          - Font-size: 24px
          - Weight: 500
          - Margin-bottom: 16px
        
        List styling:
          - List-style: disc inside
          - Gap: 12px
          - Font-size: 16px
          - Color: #374151
        
        Checkboxes:
          - Width: 16px
          - Height: 16px
          - Border-radius: 4px
          - Border: 1px solid #D1D5DB
  
  Right: Outline Sidebar
    Width: 320px
    Background: #FFFFFF
    Border-left: 1px solid #E5E7EB
    Shrink: 0
    Display: flex
    Flex-direction: column
    
    Tabs:
      Height: 48px
      Display: flex
      Border-bottom: 1px solid #E5E7EB
      
      Each tab:
        Flex: 1
        Padding: 12px 16px
        Font-size: 14px
        Text-align: center
        Cursor: pointer
        Transition: all 150ms
        Position: relative
        
        Inactive:
          - Color: #6B7280
          - Background: transparent
        
        Active:
          - Color: #5B4EFA
          - Background: transparent
          - Border-bottom: 2px solid #5B4EFA
        
        Hover (inactive):
          - Background: #F9FAFB
    
    Content area:
      Flex: 1
      Overflow-y: auto
      Padding: 16px
      
      Blocks tab content:
        Each block item:
          Display: flex
          Align-items: center
          Justify: space-between
          Padding: 8px 12px
          Border-radius: 8px
          Cursor: pointer
          
          Hover:
            - Background: #F9FAFB
          
          Left section:
            Display: flex
            Align-items: center
            Gap: 12px
            Flex: 1
            Min-width: 0
            
            Label (H1, H2, etc.):
              - Font-size: 12px
              - Color: #9CA3AF
              - Width: 24px
            
            Text:
              - Font-size: 14px
              - Color: #111827
              - Truncate if needed
          
          Menu icon:
            - Width: 16px
            - Height: 16px
            - Color: #9CA3AF
            - Shrink: 0
      
      Outline tab content:
        Hierarchical structure
        
        H1 level:
          - Padding-left: 12px
        
        H2 level:
          - Padding-left: 24px
        
        Same item styling as Blocks

Bottom Toolbar:
  Height: 48px
  Padding: 12px 24px
  Background: #FFFFFF
  Border-top: 1px solid #E5E7EB
  Display: flex
  Justify: space-between
  Align-items: center
  Shrink: 0
  
  Left section:
    Display: flex
    Gap: 16px
    
    Font size button:
      Display: flex
      Align-items: center
      Gap: 8px
      Padding: 4px 12px
      Border-radius: 8px
      Cursor: pointer
      
      Hover:
        - Background: #F3F4F6
      
      Icon (Type):
        - Width: 16px
        - Height: 16px
      
      Text "Aa":
        - Font-size: 14px
    
    Zoom button:
      Same structure
      Text: "100%"
      Icon (ChevronDown): 12px × 12px
  
  Right section:
    Word count:
      - Font-size: 14px
      - Color: #6B7280
      - Text: "Words: 1234"
```

---

## 6. NAVIGATION FLOW & STATE MANAGEMENT

### View States
```typescript
type ViewMode = 'dashboard' | 'subject' | 'noteList' | 'glance' | 'editor';

States:
1. dashboard - Home screen with sidebar in 'home' mode
2. subject - Subject selected, sidebar in 'subject' mode, empty state shown
3. noteList - Subtopic selected, shows list of notes
4. glance - Note opened in reading mode, sidebar visible
5. editor - Full editor mode, no sidebar
```

### Sidebar Modes
```typescript
type SidebarMode = 'home' | 'subject';

home mode:
- Shows main navigation (Home, Pinned, Recent, etc.)
- Shows flat subject list with emoji icons
- "New Subject" button at bottom

subject mode:
- Shows back button
- Shows selected subject header
- Shows numbered topic tree
- Shows expandable subtopics
- Shows "Other Subjects" at bottom (max 4)
```

### Navigation Transitions
```
dashboard → subject:
  - Click subject in sidebar
  - Sidebar transforms to subject mode
  - Main area shows empty state

subject (empty) → subject (topic selected):
  - Click topic without subtopics
  - Stays in empty state or shows topic content

subject → noteList:
  - Click subtopic (e.g., "Right to Equality")
  - Main area shows note list view
  - Sidebar remains in subject mode

noteList → glance:
  - Click a note item
  - Main area shows reading view
  - Sidebar remains visible

glance → glance (collapsed):
  - Click collapse button (top-left)
  - Sidebar slides out
  - Content expands to full width
  - Collapse button remains visible

glance → editor:
  - Click "Open in Editor" button
  - Switches to full editor view
  - Sidebar completely hidden
  - Shows editor top bar and outline panel

editor → glance:
  - Click close (X) button in editor
  - Returns to glance view
  - Sidebar becomes visible again
```

### Interactive States
```css
/* Buttons */
button:hover {
  background: #F9FAFB;
  transition: background 150ms ease;
}

button:active {
  background: #F3F4F6;
}

button.primary:hover {
  background: #4D3FE8;
}

/* Cards */
card:hover {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  transition: box-shadow 200ms ease;
}

/* Input Focus */
input:focus {
  outline: none;
  ring: 2px solid #5B4EFA;
  ring-opacity: 50%;
  border-color: transparent;
}

/* Sidebar Items */
.sidebar-item.active {
  background: #EEECFF;
  color: #5B4EFA;
}

/* Opacity Transitions */
.hover-reveal {
  opacity: 0;
  transition: opacity 200ms ease;
}

.parent:hover .hover-reveal {
  opacity: 1;
}
```

---

## 13. EDITOR TOOLBAR COMPLETE SPECIFICATION

This section details every tool in the editor toolbar with exact specifications.

### Toolbar Layout

```
Position: Below document title
Container: padding 0, display flex, gap 4px, flex-wrap wrap
Background: #FFFFFF
Height: ~40px (with padding)
```

### Toolbar Tools (Left to Right)

#### Group 1: Headings
```
1. H1 Button
   Type: Text button
   Padding: 6px 12px
   Font-size: 14px
   Font-weight: 500
   Text: "H1"
   Border-radius: 6px
   Background (default): transparent
   Background (hover): #F3F4F6
   Background (active): #E5E7EB
   Color: #374151
   Cursor: pointer
   Function: Insert/convert to H1 heading

2. H2 Button
   Same specifications as H1
   Text: "H2"
   Function: Insert/convert to H2 heading
```

#### Group 2: Text Formatting
```
3. Bold Button
   Type: Icon button
   Size: 28px × 28px
   Padding: 4px
   Icon: Bold (lucide-react)
   Icon size: 20px × 20px
   Icon color: #374151
   Border-radius: 6px
   Function: Toggle bold text
   Keyboard shortcut: Cmd/Ctrl + B

4. Italic Button
   Same as Bold
   Icon: Italic
   Function: Toggle italic text
   Keyboard shortcut: Cmd/Ctrl + I

5. Underline Button
   Same as Bold
   Icon: Underline
   Function: Toggle underline text
   Keyboard shortcut: Cmd/Ctrl + U
```

#### Divider 1
```
Width: 1px
Height: 24px
Background: #E5E7EB
Margin: 0 4px
```

#### Group 3: Lists
```
6. Numbered List Button
   Type: Icon button
   Size: 28px × 28px
   Icon: ListOrdered
   Icon size: 20px × 20px
   Function: Create/toggle numbered list

7. Bullet List Button
   Same as Numbered List
   Icon: List
   Function: Create/toggle bullet list

8. Todo List Button
   Same as Numbered List
   Icon: ListTodo
   Function: Create/toggle checkbox list
```

#### Divider 2
```
Same as Divider 1
```

#### Group 4: Styling & Media
```
9. Highlight Color Picker
   Type: Custom button with dropdown
   Size: 28px × 28px
   Padding: 4px
   
   Display square:
     Width: 20px
     Height: 20px
     Background: #FDE68A (current color)
     Border-radius: 2px
   
   Dropdown specification:
     Trigger: Click on button
     Position: Absolute, below button
     Top: calc(100% + 8px)
     Left: 0
     Padding: 12px
     Background: #FFFFFF
     Border: 1px solid #E5E7EB
     Border-radius: 8px
     Box-shadow: 0 8px 24px rgba(0,0,0,0.12)
     Z-index: 10
     
     Color swatches:
       Display: flex
       Gap: 8px
       
       Each swatch:
         Width: 28px
         Height: 28px
         Border-radius: 50%
         Cursor: pointer
         Transition: all 150ms ease
         
         Hover state:
           Ring: 2px solid #5B4EFA
           Ring-offset: 0
         
         Active state:
           Ring: 2px solid #5B4EFA
         
         Colors (6 total):
           1. Yellow: #FDE68A (default active)
           2. Lime: #D9F99D
           3. Green: #86EFAC
           4. Pink: #FBCFE8
           5. Purple: #DDD6FE
           6. Blue: #BFDBFE
     
     Close behavior:
       Click outside → close
       Select color → apply & close

10. Link Button
    Type: Icon button
    Size: 28px × 28px
    Icon: Link (lucide-react)
    Function: Insert/edit hyperlink
    Keyboard shortcut: Cmd/Ctrl + K

11. Image Button
    Same as Link
    Icon: Image
    Function: Insert image
    Opens file picker or URL input

12. Calendar Button
    Same as Link
    Icon: Calendar
    Function: Insert date/event
    Opens date picker

13. Paperclip Button
    Same as Link
    Icon: Paperclip
    Function: Attach file
    Opens file picker

14. Table Button
    Same as Link
    Icon: Table
    Function: Insert table
    Opens table size picker

15. Code Button
    Same as Link
    Icon: Code
    Function: Insert code block
    Toggles monospace formatting
```

### Toolbar States

```css
/* Default state */
.toolbar-button {
  width: 28px;
  height: 28px;
  padding: 4px;
  border-radius: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 150ms ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Hover state */
.toolbar-button:hover {
  background: #F3F4F6;
}

/* Active/pressed state */
.toolbar-button:active {
  background: #E5E7EB;
}

/* Selected state (when format is applied) */
.toolbar-button.selected {
  background: #EEECFF;
  color: #5B4EFA;
}

/* Disabled state */
.toolbar-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

### Toolbar Responsive Behavior

```
Minimum width: 700px
Wrapping: Enabled (flex-wrap: wrap)

If toolbar exceeds container width:
  - Wraps to second line
  - Maintains gap: 4px
  - Maintains grouping with dividers

On iPad in portrait (<1024px):
  - Consider collapsing to icon-only mode
  - Or implement "More" menu for less-used tools
```

---

## 14. SCROLLING & INFINITE SCROLL BEHAVIOR

### Glance View Scrolling Specifications

```
Container structure:
  ┌─────────────────────────────┐
  │ Sticky Header (fixed)       │ ← Height: 64px, z-index: 20
  ├─────────────────────────────┤
  │                             │
  │  Scrollable Content Area    │ ← flex: 1, overflow-y: auto
  │                             │
  │  [8 sections]               │
  │  [27 paragraphs]            │
  │  [2000+ words]              │
  │                             │
  │  — End of Glance —          │
  │                             │
  ├─────────────────────────────┤
  │ Bottom Action Bar (fixed)   │ ← Height: 56px
  └─────────────────────────────┘

Scrollable area height: calc(100vh - 64px - 56px) = calc(100vh - 120px)
```

### Content Sizing for Scrollability

```
CRITICAL: Content MUST overflow viewport to enable scrolling

Minimum content height: 1500px (for 768px viewport height)
Recommended content: 2000-3000px total height

Content structure to ensure scrollability:
  Main title section: ~120px
  Introduction paragraph: ~80px
  Section 1 (3 bullets): ~200px
  Section 2 (3 bullets): ~200px
  Section 3 (4 bullets): ~280px
  Section 4 (3 bullets): ~200px
  Section 5 (4 bullets): ~320px
  Section 6 (4 bullets): ~320px
  Section 7 (3 bullets): ~240px
  Section 8 (3 bullets): ~240px
  End marker: ~80px
  
  Total: ~2080px

This ensures:
  - Vertical scrolling required
  - Scrollbar visible
  - Multiple screen heights of content
  - Demonstrates infinite scroll capability
```

### Scrollbar Styling

```css
/* Custom scrollbar for consistency */
.scrollable-content::-webkit-scrollbar {
  width: 8px;
}

.scrollable-content::-webkit-scrollbar-track {
  background: #F9FAFB;
}

.scrollable-content::-webkit-scrollbar-thumb {
  background: #D1D5DB;
  border-radius: 4px;
}

.scrollable-content::-webkit-scrollbar-thumb:hover {
  background: #9CA3AF;
}

/* For Firefox */
.scrollable-content {
  scrollbar-width: thin;
  scrollbar-color: #D1D5DB #F9FAFB;
}
```

### Scroll Behavior

```javascript
// Smooth scrolling
scrollBehavior: 'smooth'

// Scroll position persistence
onScroll: save position to session storage
onMount: restore scroll position

// Lazy loading (if implementing)
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Load more content
      }
    });
  },
  {
    rootMargin: '200px' // Load 200px before reaching end
  }
);
```

### Sticky Header Behavior

```
Position: sticky
Top: 0
Z-index: 20
Background: #FFFFFF
Border-bottom: 1px solid #E5E7EB
Box-shadow (on scroll): 0 2px 8px rgba(0,0,0,0.05)

Scroll indicators:
  - Header gains subtle shadow when scrolled
  - Breadcrumb can be shown/hidden based on scroll
  - Progress indicator can show read percentage
```

### Editor Scroll Behavior

```
Editor container:
  Padding: 32px
  Background: #F9FAFB
  Overflow-y: auto
  
  Inner document:
    Max-width: 896px
    Margin: 0 auto
    Background: #FFFFFF
    Padding: 32px
    Border-radius: 8px
    Min-height: 100% (ensures always fills viewport)

Scrolling:
  - Independent from toolbar/outline
  - Smooth scroll behavior
  - Cursor/selection preserved during scroll
  - Auto-scroll when typing near bottom
```

### Infinite Scroll Implementation (Future)

```
Trigger point: 300px from bottom
Load behavior: Append 5-10 more sections
Loading indicator: Spinner at bottom
Error handling: Retry button if load fails

Implementation pseudo-code:
```javascript
const handleScroll = (e) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
  
  if (distanceFromBottom < 300 && !loading) {
    loadMoreContent();
  }
};

const loadMoreContent = async () => {
  setLoading(true);
  const newSections = await fetchMoreSections();
  appendSections(newSections);
  setLoading(false);
};
```

### Scroll Performance Optimization

```
1. Virtual scrolling for very long documents (>10,000 lines)
2. Debounce scroll events (100ms)
3. Use CSS containment for sections
4. Lazy load images below fold
5. Minimize repaints during scroll

CSS optimizations:
```css
.content-section {
  contain: layout style paint;
}

.image-lazy {
  content-visibility: auto;
}
```

---

## 7. ICON SPECIFICATIONS

### Icon Library
Use `lucide-react` for all icons.

### Icon Sizes
```
Extra Small: 12px × 12px
Small: 16px × 16px
Medium: 20px × 20px
Large: 24px × 24px
Extra Large: 48px × 48px
```

### Icon Usage Map
```
Sidebar Navigation:
- Home: 20px
- Pin: 20px
- Clock: 20px
- Share2: 20px
- Trash2: 20px
- Settings: 20px
- Book (logo): 24px

Subject Icons (emoji):
- 🏛️ Polity
- 💰 Economy
- 📜 History
- 🌍 Geography
- ⚖️ Ethics
- 🌱 Environment
- 🔬 Science & Tech

Action Icons:
- Search: 20px
- Plus: 20px
- Bell: 24px
- Grid3x3: 20px
- ChevronRight: 16px
- ChevronLeft: 20px
- ChevronDown: 16px
- MoreVertical: 16px
- Star: 20px
- FileText: 20px

Editor Icons:
- Bold: 20px
- Italic: 20px
- Underline: 20px
- List: 20px
- ListOrdered: 20px
- ListTodo: 20px
- Link: 20px
- Image: 20px
- Calendar: 20px
- Paperclip: 20px
- Table: 20px
- Code: 20px
- Type: 16px
- RotateCcw: 16px
- RotateCw: 16px
- Menu: 16px
- Save: 16px
- Share2: 20px
- Upload: 20px
- X: 20px
```

---

## 8. SHADOW SYSTEM

```css
/* Card hover */
--shadow-card: 0 8px 16px rgba(0, 0, 0, 0.1);

/* Card subtle */
--shadow-card-subtle: 0 1px 3px rgba(0, 0, 0, 0.1);

/* Dropdown/Modal */
--shadow-dropdown: 0 8px 24px rgba(0, 0, 0, 0.12);

/* Floating button */
--shadow-float: 0 4px 12px rgba(0, 0, 0, 0.1);

/* Editor container */
--shadow-editor: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
```

---

## 9. ANIMATION & TRANSITIONS

### Transition Speeds
```css
--transition-fast: 150ms
--transition-normal: 200ms
--transition-slow: 300ms
```

### Easing Functions
```css
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)
--ease-out: cubic-bezier(0.0, 0, 0.2, 1)
--ease-in: cubic-bezier(0.4, 0, 1, 1)
```

### Specific Animations
```css
/* Hover states */
.hover-transition {
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Accordion expand/collapse */
@keyframes accordion-down {
  from { height: 0; opacity: 0; }
  to { height: var(--radix-accordion-content-height); opacity: 1; }
}

@keyframes accordion-up {
  from { height: var(--radix-accordion-content-height); opacity: 1; }
  to { height: 0; opacity: 0; }
}

/* Fade in */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide in from right */
@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
```

---

## 10. RESPONSIVE BREAKPOINTS

### Target Device: iPad/Tablet Landscape
```
Primary viewport: 1024px × 768px (iPad landscape)
Minimum width: 1024px
Maximum supported: 1366px (iPad Pro)
```

### Layout Constraints
```css
/* Sidebar */
min-width: 300px;
max-width: 300px;

/* Main content */
min-width: 724px; /* 1024 - 300 */
flex: 1;

/* Editor content max-width */
max-width: 896px; /* 56rem */
margin: 0 auto;

/* Dashboard content max-width */
max-width: 100%;
padding: 0 32px;
```

---

## 11. SPECIFIC COMPONENT MEASUREMENTS

### Dashboard Cards

#### Continue Studying Card
```
Container:
  min-width: 240px
  height: auto
  padding: 20px
  border-radius: 20px
  background: #FFFFFF
  border: 1px solid #E5E7EB

Icon Container:
  width: 48px
  height: 48px
  border-radius: 20px
  margin-bottom: 16px
  background: varies (subject color)

Title:
  font-size: 16px
  font-weight: 500
  line-height: 24px
  margin-bottom: 4px
  color: #111827

Subject Label:
  font-size: 14px
  line-height: 21px
  color: #6B7280
  margin-bottom: 4px

Timestamp:
  font-size: 12px
  line-height: 18px
  color: #9CA3AF
```

#### Pinned Note Card
```
Container:
  width: 100% (grid cell)
  padding: 20px
  border-radius: 20px
  background: #FFFFFF
  border: 1px solid #E5E7EB

Header Row:
  display: flex
  justify-content: space-between
  margin-bottom: 16px

Icon Container:
  width: 40px
  height: 40px
  border-radius: 12px
  background: #DBEAFE (blue-100)

Star Icon:
  width: 20px
  height: 20px
  color: #FBBF24
  fill: #FBBF24

Title:
  font-size: 16px
  font-weight: 500
  margin-bottom: 8px
  color: #111827

Metadata Row:
  display: flex
  justify-content: space-between
  font-size: 14px
  color: #6B7280
```

### Note List Item
```
Container:
  width: 100%
  padding: 16px 20px
  border-radius: 12px
  background: #FFFFFF
  border: 1px solid #E5E7EB
  margin-bottom: 8px
  display: flex
  align-items: center
  gap: 16px

Icon:
  width: 40px
  height: 40px
  border-radius: 12px
  background: #DBEAFE
  flex-shrink: 0

Content:
  flex: 1
  min-width: 0

Title:
  font-size: 16px
  font-weight: 500
  line-height: 24px
  color: #111827
  margin-bottom: 4px
  white-space: nowrap
  overflow: hidden
  text-overflow: ellipsis

Timestamp:
  font-size: 14px
  line-height: 21px
  color: #6B7280

Star Icon (if pinned):
  width: 20px
  height: 20px
  color: #FBBF24
  fill: #FBBF24
  flex-shrink: 0

More Menu:
  width: 32px
  height: 32px
  padding: 8px
  border-radius: 8px
  opacity: 0
  transition: opacity 200ms

Container:hover More Menu:
  opacity: 1
```

### Tag Pills (Content)
```
Container:
  display: inline-flex
  align-items: center
  padding: 4px 12px
  border-radius: 9999px
  font-size: 12px
  line-height: 18px
  font-weight: 400

Yellow "Key Point":
  background: #FEF3C7
  color: #92400E

Green "Important Case":
  background: #D1FAE5
  color: #065F46

Red "Unconstitutional":
  background: #FEE2E2
  color: #991B1B
```

### Inline Highlights
```
Span element:
  background-color: varies
  padding: 2px 0
  border-radius: 2px

Yellow highlight:
  background: #FDE68A

Green highlight:
  background: #86EFAC

Red highlight:
  background: #FCA5A5
```

### Search Input
```
Container:
  position: relative
  flex: 1

Icon:
  position: absolute
  left: 16px
  top: 50%
  transform: translateY(-50%)
  width: 20px
  height: 20px
  color: #9CA3AF

Input:
  width: 100%
  padding: 12px 16px 12px 48px
  background: #FFFFFF (dashboard), #F9FAFB (note list)
  border: 1px solid #E5E7EB
  border-radius: 12px
  font-size: 16px
  line-height: 24px
  color: #111827

Input::placeholder:
  color: #9CA3AF

Input:focus:
  outline: none
  ring: 2px solid #5B4EFA
  ring-opacity: 50%
  border-color: transparent
```

### Buttons

#### Primary Button
```
Padding: 12px 24px
Background: #5B4EFA
Color: #FFFFFF
Border: none
Border-radius: 12px
Font-size: 14px
Font-weight: 500
Line-height: 21px
Cursor: pointer

Hover:
  background: #4D3FE8

Active:
  background: #3F32D9

With icon:
  display: flex
  align-items: center
  gap: 8px
  icon-size: 20px
```

#### Icon Button
```
Width: 32px
Height: 32px
Padding: 8px
Border: none
Background: transparent
Border-radius: 8px
Cursor: pointer

Hover:
  background: #F9FAFB

Active:
  background: #F3F4F6

Icon:
  width: 16px or 20px (varies)
  height: 16px or 20px
  color: #6B7280
```

#### Toolbar Button
```
Width: 28px
Height: 28px
Padding: 4px
Border: none
Background: transparent
Border-radius: 6px
Cursor: pointer

Hover:
  background: #F3F4F6

Active:
  background: #E5E7EB

Icon:
  width: 20px
  height: 20px
  color: #374151
```

---

## 12. Z-INDEX LAYERS

```css
--z-base: 0
--z-sidebar: 10
--z-header: 20
--z-dropdown: 30
--z-modal: 40
--z-toast: 50
--z-sidebar-toggle: 10 (glance view only)
```

---

## 13. ACCESSIBILITY REQUIREMENTS

### Focus States
```css
:focus-visible {
  outline: 2px solid #5B4EFA;
  outline-offset: 2px;
}

/* Or for elements with custom focus rings */
:focus {
  ring: 2px solid #5B4EFA;
  ring-opacity: 50%;
}
```

### Touch Targets
All interactive elements must have minimum touch target of 44px × 44px (iPad).

### Color Contrast Ratios
```
Primary text (#111827) on white: 14.8:1 (AAA)
Secondary text (#6B7280) on white: 5.74:1 (AA)
Primary button (#5B4EFA) on white: 7.1:1 (AAA)
Yellow tag text (#92400E) on yellow bg (#FEF3C7): 7.2:1 (AAA)
Green tag text (#065F46) on green bg (#D1FAE5): 8.1:1 (AAA)
Red tag text (#991B1B) on red bg (#FEE2E2): 7.9:1 (AAA)
```

---

## 14. DATA STRUCTURE EXAMPLES

### Subject Data Structure
```typescript
interface Subject {
  id: string;
  label: string;
  icon: string; // emoji
  color: string; // CSS class for background color
  topics?: Topic[];
}

interface Topic {
  id: string;
  label: string;
  subtopics?: Subtopic[];
}

interface Subtopic {
  id: string;
  label: string;
}
```

### Note Data Structure
```typescript
interface Note {
  id: string;
  title: string;
  content: string; // HTML or markdown
  subject: string;
  topic?: string;
  subtopic?: string;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Card Data Structure
```typescript
interface StudyCard {
  id: string;
  title: string;
  subject: string;
  timestamp: string;
  icon: ReactNode;
  iconBg: string; // CSS color class
}
```

---

## 15. IMPLEMENTATION CHECKLIST

### Phase 1: Foundation
- [ ] Set up color system CSS variables
- [ ] Set up typography system
- [ ] Set up spacing system
- [ ] Configure Tailwind with custom theme
- [ ] Create base layout structure

### Phase 2: Sidebar
- [ ] Build home mode sidebar
- [ ] Build subject mode sidebar
- [ ] Implement accordion navigation
- [ ] Add sidebar transitions
- [ ] Add back button functionality

### Phase 3: Dashboard
- [ ] Create dashboard layout
- [ ] Build greeting header
- [ ] Build search bar
- [ ] Create "Continue Studying" section
- [ ] Create "Pinned Notes" section
- [ ] Create "Recent Notes" section
- [ ] Add card hover effects

### Phase 4: Navigation Views
- [ ] Create empty state component
- [ ] Build note list view
- [ ] Implement note list items
- [ ] Add search functionality
- [ ] Connect navigation flow

### Phase 5: Reading View
- [ ] Build glance view layout
- [ ] Add content formatting
- [ ] Create tag pills
- [ ] Add inline highlights
- [ ] Implement sidebar collapse
- [ ] Add "End of Glance" footer
- [ ] Add "Open in Editor" action

### Phase 6: Editor
- [ ] Create editor layout
- [ ] Build formatting toolbar
- [ ] Add highlight color picker
- [ ] Create outline sidebar
- [ ] Implement blocks/outline tabs
- [ ] Add bottom toolbar
- [ ] Add word count
- [ ] Implement close action

### Phase 7: State Management
- [ ] Set up view mode state
- [ ] Set up sidebar mode state
- [ ] Set up selection state
- [ ] Connect all navigation transitions
- [ ] Test all user flows

### Phase 8: Polish
- [ ] Add all hover states
- [ ] Add all focus states
- [ ] Verify all spacing
- [ ] Verify all typography
- [ ] Test all interactions
- [ ] Verify color contrast
- [ ] Add transitions/animations
- [ ] Final pixel-perfect check

---

## 16. EXACT PIXEL MEASUREMENTS REFERENCE

### Sidebar (Home Mode)
```
Total width: 300px

Logo Section:
├─ Container padding-top: 24px
├─ Container padding-bottom: 24px
├─ Container padding-left: 24px
├─ Container padding-right: 24px
├─ Icon wrapper: 40px × 40px
│  ├─ Background: #5B4EFA
│  ├─ Border-radius: 12px
│  └─ Icon: 24px × 24px, color #FFFFFF
├─ Gap: 12px
└─ Text: 30px, weight 500, color #111827

Navigation Section:
├─ Container padding-top: 0
├─ Container padding-bottom: 16px
├─ Container padding-left: 16px
├─ Container padding-right: 16px
├─ Item margin-bottom: 4px
└─ Each item:
   ├─ Padding: 12px 16px
   ├─ Border-radius: 12px
   ├─ Icon: 20px × 20px
   ├─ Gap: 12px
   └─ Text: 14px, weight 400

Divider:
├─ Height: 1px
├─ Color: #E5E7EB
├─ Margin-left: 16px
└─ Margin-right: 16px

Subjects Section:
├─ Container padding-top: 24px
├─ Container padding-bottom: 24px
├─ Container padding-left: 16px
├─ Container padding-right: 16px
├─ Header padding-left: 16px
├─ Header padding-bottom: 12px
├─ Header text: 11px, uppercase, tracking 0.05em
└─ Each subject:
   ├─ Padding: 12px 16px
   ├─ Border-radius: 12px
   ├─ Icon: 32px × 32px, border-radius 12px
   ├─ Gap: 12px
   ├─ Text: 14px, weight 400
   └─ Chevron: 16px × 16px, opacity 0 → 1 on hover

Settings (Bottom):
├─ Border-top: 1px solid #E5E7EB
├─ Padding: 12px
└─ Button:
   ├─ Padding: 12px 16px
   ├─ Border-radius: 12px
   └─ Same structure as nav items
```

### Dashboard Main Content
```
Container: calc(100vw - 300px)

Top Section:
├─ Padding: 24px 32px
├─ Greeting container:
│  ├─ H1: 30px, line-height 45px, weight 500
│  └─ Paragraph: 16px, line-height 24px, color #6B7280
└─ User controls:
   ├─ Bell icon: 24px × 24px
   ├─ Red notification dot: 8px diameter, position absolute top-right
   ├─ Avatar: 40px × 40px, border-radius 50%
   └─ Gap between: 16px

Search Bar Section:
├─ Container padding: 0 32px 24px
├─ Search input:
│  ├─ Padding: 12px 16px 12px 48px
│  ├─ Icon left: 16px, width 20px
│  ├─ Border: 1px solid #E5E7EB
│  ├─ Border-radius: 12px
│  └─ Height: 48px total
├─ Grid button:
│  ├─ Width: 48px
│  ├─ Height: 48px
│  ├─ Icon: 20px × 20px
│  └─ Border-radius: 12px
├─ New button:
│  ├─ Padding: 12px 24px
│  ├─ Border-radius: 12px
│  └─ Icon + text gap: 8px
└─ Gap between elements: 12px

Content Sections:
├─ Container padding: 0 32px 32px
└─ Each section:
   ├─ Margin-bottom: 40px
   ├─ Header margin-bottom: 20px
   ├─ Title: 24px, weight 500
   └─ Link: 14px, color #5B4EFA

Continue Studying:
├─ Cards container: display flex, gap 16px
└─ Each card:
   ├─ Min-width: 240px
   ├─ Padding: 20px
   ├─ Border-radius: 20px
   ├─ Icon: 48px × 48px, border-radius 20px
   ├─ Icon margin-bottom: 16px
   ├─ Title: 16px, weight 500, margin-bottom 4px
   ├─ Subject: 14px, color #6B7280, margin-bottom 4px
   └─ Timestamp: 12px, color #9CA3AF

Pinned Notes:
├─ Grid: 2 columns, gap 16px
└─ Each card:
   ├─ Padding: 20px
   ├─ Border-radius: 20px
   ├─ Header (flex space-between):
   │  ├─ Icon: 40px × 40px, border-radius 12px
   │  ├─ Star: 20px × 20px
   │  └─ Margin-bottom: 16px
   ├─ Title: 16px, weight 500, margin-bottom 8px
   └─ Metadata (flex space-between): 14px, color #6B7280

Recent Notes:
├─ Grid: 3 columns, gap 16px
└─ Same card structure as Pinned Notes
```

### Editor Measurements
```
Top Bar:
├─ Height: 48px
├─ Padding: 12px 24px
├─ Left section gap: 16px
├─ Undo/Redo icons: 16px × 16px
└─ Saved indicator: 14px, color #059669, icon 16px

Title Bar:
├─ Padding: 16px 32px
├─ Title: 30px, weight 500
└─ Margin-bottom: 16px

Toolbar:
├─ Height: 40px (with padding)
├─ Button size: 28px × 28px
├─ Icon size: 20px × 20px
├─ Gap: 4px
├─ Divider: 1px × 24px, margin 0 4px
└─ Border-radius: 6px

Content Area Split:
├─ Editor (left): flex 1
│  ├─ Padding: 32px
│  ├─ Background: #F9FAFB
│  └─ Inner container:
│     ├─ Max-width: 896px
│     ├─ Background: #FFFFFF
│     ├─ Padding: 32px
│     └─ Border-radius: 8px
└─ Sidebar (right): 320px
   ├─ Background: #FFFFFF
   ├─ Border-left: 1px solid #E5E7EB
   └─ Tabs:
      ├─ Height: 48px
      ├─ Tab padding: 12px 16px
      ├─ Active border-bottom: 2px
      └─ Font-size: 14px

Bottom Toolbar:
├─ Height: 48px
├─ Padding: 12px 24px
├─ Border-top: 1px solid #E5E7EB
├─ Buttons padding: 4px 12px
└─ Text: 14px
```

---

## 17. FINAL NOTES

### Critical Details
1. All spacing must follow the 4px grid system
2. All border-radius values must match the defined system
3. All font-sizes must match exactly (no approximations)
4. All colors must use exact hex codes (no RGB approximations)
5. All icon sizes must be exact (12, 16, 20, 24, 48px only)
6. All transitions must use the defined duration and easing
7. All shadows must match the exact specification
8. All hover states must be implemented
9. All focus states must be accessible
10. All touch targets must be minimum 44px

### Tools & Libraries Required
```json
{
  "react": "^18.3.1",
  "lucide-react": "latest",
  "@radix-ui/react-accordion": "latest",
  "tailwindcss": "^4.x"
}
```

### Design Tokens Export
All design tokens should be available as CSS custom properties in the `:root` selector for easy maintenance and theming.

---

## 21. COMPLETE APPLICATION FLOW SUMMARY

### User Journey Through All 7 Screens

```
START → Screen 1 (Dashboard)
  ↓ User clicks "Polity" subject
Screen 2 (Subject: Polity, Empty State)
  ↓ User clicks "2. Fundamental Rights" to expand
Screen 3 (Topic Expanded)
  ↓ User clicks "Right to Equality" subtopic
Screen 4 (Note List)
  ↓ User clicks "Article 14 — Equality Before Law" note
Screen 5 (Glance View - with sidebar)
  ↓ User clicks collapse button (top-left)
Screen 6 (Glance View - fullscreen)
  ↓ User clicks "Open in Editor"
Screen 7 (Editor Mode)
  ↓ User clicks close (X) button
RETURN → Screen 5 (Glance View)
```

### State Variables Required

```typescript
// View mode state
type ViewMode = 'dashboard' | 'subject' | 'noteList' | 'glance' | 'editor';
const [viewMode, setViewMode] = useState<ViewMode>('dashboard');

// Sidebar mode state
type SidebarMode = 'home' | 'subject';
const sidebarMode = viewMode === 'dashboard' ? 'home' : 'subject';

// Selection state
const [selectedSubject, setSelectedSubject] = useState<string>();
const [selectedTopic, setSelectedTopic] = useState<string>();
const [selectedSubtopic, setSelectedSubtopic] = useState<string>();
const [selectedNote, setSelectedNote] = useState<string>();

// UI state
const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
const [expandedTopics, setExpandedTopics] = useState<string[]>(['fundamental-rights']);
```

### Complete Navigation Functions

```typescript
// Navigate home
const handleNavigateHome = () => {
  setViewMode('dashboard');
  setSelectedSubject(undefined);
  setSelectedTopic(undefined);
  setSelectedSubtopic(undefined);
  setSelectedNote(undefined);
};

// Select subject (Screen 1 → Screen 2)
const handleSelectSubject = (subjectId: string) => {
  setSelectedSubject(subjectId);
  setSelectedTopic(undefined);
  setSelectedSubtopic(undefined);
  setViewMode('subject');
};

// Toggle topic expansion (Screen 2 → Screen 3)
const handleToggleTopic = (topicId: string) => {
  setExpandedTopics(prev =>
    prev.includes(topicId)
      ? prev.filter(id => id !== topicId)
      : [...prev, topicId]
  );
};

// Select subtopic (Screen 3 → Screen 4)
const handleSelectSubtopic = (subtopicId: string) => {
  setSelectedSubtopic(subtopicId);
  setViewMode('noteList');
};

// Select note (Screen 4 → Screen 5)
const handleSelectNote = (noteId: string) => {
  setSelectedNote(noteId);
  setViewMode('glance');
  setSidebarCollapsed(false);
};

// Toggle sidebar (Screen 5 → Screen 6)
const handleToggleSidebar = () => {
  setSidebarCollapsed(prev => !prev);
};

// Open editor (Screen 5/6 → Screen 7)
const handleOpenEditor = () => {
  setViewMode('editor');
  setSidebarCollapsed(false);
};

// Close editor (Screen 7 → Screen 5)
const handleCloseEditor = () => {
  setViewMode('glance');
};

// Back from note list (Screen 4 → Screen 3)
const handleBackFromNoteList = () => {
  setSelectedSubtopic(undefined);
  setViewMode('subject');
};

// Back from glance (Screen 5 → Screen 4)
const handleBackFromGlance = () => {
  setViewMode('noteList');
};
```

### Conditional Rendering Logic

```typescript
// Determine which content to show
const renderMainContent = () => {
  switch (viewMode) {
    case 'dashboard':
      return <Dashboard onViewNote={handleSelectNote} />;
    
    case 'subject':
      return selectedSubtopic ? (
        <NoteList
          topicName={getTopicName()}
          onBack={handleBackFromNoteList}
          onSelectNote={handleSelectNote}
        />
      ) : (
        <EmptyState />
      );
    
    case 'noteList':
      return (
        <NoteList
          topicName={getTopicName()}
          onBack={handleBackFromNoteList}
          onSelectNote={handleSelectNote}
        />
      );
    
    case 'glance':
      return (
        <GlanceView
          onBack={handleBackFromGlance}
          onOpenEditor={handleOpenEditor}
        />
      );
    
    case 'editor':
      return <EditorView onClose={handleCloseEditor} />;
    
    default:
      return <Dashboard onViewNote={handleSelectNote} />;
  }
};

// Determine sidebar visibility
const showSidebar = viewMode !== 'editor' && !sidebarCollapsed;

// Render
return (
  <div className="size-full flex relative">
    {showSidebar && (
      <Sidebar
        mode={sidebarMode}
        selectedSubject={selectedSubject}
        selectedTopic={selectedTopic}
        selectedSubtopic={selectedSubtopic}
        onNavigateHome={handleNavigateHome}
        onSelectSubject={handleSelectSubject}
        onSelectTopic={handleToggleTopic}
        onSelectSubtopic={handleSelectSubtopic}
      />
    )}
    
    {renderMainContent()}
    
    {viewMode === 'glance' && (
      <button
        onClick={handleToggleSidebar}
        className="fixed top-4 left-4 z-10 ..."
      >
        {sidebarCollapsed ? <PanelLeft /> : <PanelLeftClose />}
      </button>
    )}
  </div>
);
```

---

## 22. QUICK REFERENCE GUIDE

### Key Measurements Cheat Sheet

```
Sidebar Width: 300px
Main Content Width: calc(100vw - 300px) = 724px
Full Width (collapsed): 100vw = 1024px

Heights:
- Viewport: 100vh
- Top bar (editor): 48px
- Title section (editor): ~70px
- Bottom toolbar (editor): 48px
- Sticky header (glance): 64px
- Bottom action bar (glance): 56px

Padding System:
- XS: 8px
- SM: 12px
- MD: 16px
- LG: 24px
- XL: 32px

Border Radius:
- SM: 6px
- MD: 8px
- LG: 12px
- XL: 16px
- 2XL: 20px
- Full: 9999px

Icon Sizes:
- XS: 12px
- SM: 16px
- MD: 20px
- LG: 24px
- XL: 48px

Font Sizes:
- H1: 30px / 45px line-height
- H2: 24px / 36px line-height
- H3: 18px / 27px line-height
- H4: 16px / 24px line-height
- Body: 16px / 24px line-height
- Small: 14px / 21px line-height
- XS: 12px / 18px line-height
```

### Color Reference

```
Primary: #5B4EFA
Background: #F9FAFB
Surface: #FFFFFF
Border: #E5E7EB
Text: #111827
Secondary: #6B7280
Muted: #9CA3AF

Tag Yellow: #FEF3C7 / #92400E
Tag Green: #D1FAE5 / #065F46
Tag Red: #FEE2E2 / #991B1B

Highlight Yellow: #FDE68A
Highlight Green: #86EFAC
Highlight Red: #FCA5A5
```

### Component File Structure

```
/src
  /app
    App.tsx (Main application, state management)
    /components
      Sidebar.tsx (Both home & subject modes)
      Dashboard.tsx (Screen 1)
      EmptyState.tsx (Screen 2/3 main content)
      NoteList.tsx (Screen 4)
      GlanceView.tsx (Screen 5/6)
      EditorView.tsx (Screen 7)
  /styles
    theme.css (All CSS variables & tokens)
    fonts.css (Font imports only)
```

### Implementation Priority Order

```
Phase 1: Foundation
1. Set up color system in theme.css
2. Set up typography system
3. Set up spacing/radius systems
4. Create base layout (App.tsx shell)

Phase 2: Sidebar (Both Modes)
5. Build Sidebar component with mode prop
6. Implement home mode UI
7. Implement subject mode UI
8. Add accordion/expand functionality
9. Test navigation between modes

Phase 3: Dashboard & Empty State
10. Build Dashboard component
11. Create card components
12. Implement scrolling sections
13. Build EmptyState component
14. Connect to sidebar selections

Phase 4: Note List
15. Build NoteList component
16. Create note item rows
17. Add search input
18. Implement back navigation

Phase 5: Glance View
19. Build GlanceView component
20. Add sticky header
21. Create MASSIVE scrollable content (2000+ words)
22. Implement tag pills and highlights
23. Add sidebar collapse toggle
24. Add bottom action bar

Phase 6: Editor
25. Build EditorView component
26. Create complete toolbar
27. Implement highlight color picker
28. Build outline sidebar (Blocks/Outline tabs)
29. Create editable content area
30. Add bottom toolbar

Phase 7: State & Navigation
31. Set up all state variables
32. Implement all navigation functions
33. Connect all components with proper props
34. Test complete 7-screen flow

Phase 8: Polish
35. Add all transitions/animations
36. Verify all hover states
37. Test all interactions
38. Verify scrolling behavior
39. Test keyboard navigation
40. Final pixel-perfect review
```

---

**END OF SPECIFICATION**

**Version:** 2.0 Complete
**Document Length:** 3500+ lines
**Sections:** 22 complete sections
**Coverage:** 100% of application design

This document contains every measurement, color, spacing, typography setting, interaction pattern, state management detail, and implementation step needed to recreate the UPSC Notes app pixel-perfectly across all 7 screen states. No design decisions should be made outside of this specification.

**For AI Implementation:**
Read this entire document before starting. Reference specific sections as needed. Follow measurements exactly - do not approximate or "close enough." When in doubt, measure twice, code once.
