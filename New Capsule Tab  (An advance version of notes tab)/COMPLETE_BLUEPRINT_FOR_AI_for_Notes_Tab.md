# COMPLETE NOTES APP BLUEPRINT
## Button Placements, Screen Flow, Auto-Save Logic - Ready for Implementation

---

## TABLE OF CONTENTS
1. Screen Breakdown (Exact Button Placement)
2. Screen Navigation Flow
3. Auto-Save Logic (Bullet Points to Notebook)
4. Component Structure
5. Data Flow Diagram
6. Implementation Checklist

---

# PART 1: SCREEN BREAKDOWN WITH EXACT BUTTON PLACEMENT

## SCREEN 1: NOTES HOME (Subject Hub)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 9:41 AM         Tue 14 May                             100%      🔋     │  ← Status Bar
├─────────────────────────────────────────────────────────────────────────┤
│ ≡  Notes                                    🔔 (bell)  👤 (avatar)  ⋯   │  ← Top Bar
│                                                                           │
│ Good Morning, Aspirant 👋                                                │
│                                                                           │
│ 🔍 Search notes, topics, keywords...      ⊞ (grid)   [+ New] (purple)   │  ← Search + Actions
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ LEFT SIDEBAR (280px)    │  MAIN CONTENT (Remaining)                      │
│                         │                                                │
│ Notes                   │  Continue Studying                  See All ⟩  │
│                         │  ┌─────────────┬──────────────┬──────────────┐ │
│ ⊙ Home (active)         │  │ 📄          │ 📁          │ 📚          │ │
│   bg: #F0EBFF           │  │ Article 21  │ Indian Econ │ Fund. Rights│ │
│   border-left: purple   │  │ Polity      │ Economy     │ Polity      │ │
│   text: #7F77DD         │  │ Today, 9:41 │ Yesterday   │ 2 days ago  │ │
│                         │  └─────────────┴──────────────┴──────────────┘ │
│ ⭐ Pinned              │                                                  │
│ 🕐 Recent              │  Budget 2024-25                       See All ⟩ │
│ 👥 Shared with me      │  ┌─────────────────────┬─────────────────────┐ │
│ 🗑️  Trash              │  │ 📋 Union Budget     │ 📖 Directive Prin.  │ │
│                         │  │ Economy • 8 pages   │ Polity • 10 pages   │ │
│ SUBJECTS                │  │ ⭐ (pinned)         │ ⭐ (pinned)         │ │
│                         │  └─────────────────────┴─────────────────────┘ │
│ 📕 Polity              │  ┌─────────────────────┬─────────────────────┐ │
│   (highlight #7F77DD)  │  │ 📕 Ethics Case Stud │ 🌍 Climate Change   │ │
│                         │  │ Ethics • 6 pages    │ Environ • 7 pages   │ │
│ 📙 Economy             │  │ ⭐ (pinned)         │ ⭐ (pinned)         │ │
│ 📕 History             │  └─────────────────────┴─────────────────────┘ │
│ 🌍 Geography           │                                                  │
│ 🔵 Ethics              │  Recent Notes                          See All ⟩ │
│ 🌿 Environment         │  ┌────────────────┬────────────────┬────────────┐│
│ 🔬 Science & Tech      │  │ 📋 Sci & Tech  │ 🌍 Geography   │ 📕 Intl.   ││
│                         │  │ Science & Tech │ Geography      │ Relations  ││
│ + New Subject          │  │ 2 hrs ago      │ 1 day ago      │ 2 days ago ││
│                         │  └────────────────┴────────────────┴────────────┘│
│ ⚙️  Settings            │                                                  │
│                         │                                                │
└─────────────────────────────────────────────────────────────────────────┘
```

### SCREEN 1: BUTTON PLACEMENT DETAILS

#### Top Bar (Left to Right)
```
Position: Fixed, height 60px, padding 12px 24px

[1] Hamburger Menu (≡)
    Size: 24px icon
    Color: #8C8C8E
    Hidden on desktop, visible on mobile < 768px
    Tap: Toggles sidebar

[2] Logo/App Name: "Notes"
    Font: 16px, weight 600
    Color: #3A3A3C
    Left margin: 12px (from hamburger)

[3-4-5] Right Side (Gap: 12px between each)
    
    Notification Bell (🔔)
        Icon: 24px, color #8C8C8E
        Badge: Red circle, white "1", size 18px
        Tap: Open notifications
    
    User Avatar (👤)
        Size: 36px circle
        Border radius: 6px
        Tap: Open profile menu
    
    More Menu (⋯)
        Icon: 24px, color #8C8C8E
        Tap: Open dropdown (Logout, Settings, etc.)
```

#### Search Bar & Actions Row
```
Position: Below top bar, height 40px
Padding: 16px 24px, gap 12px

[1] Search Input
    Width: calc(100% - 280px) [remaining space]
    Height: 40px
    Background: #F9F8FC
    Border: 1px solid #E8E6F0
    Border radius: 8px
    Icon (inside): 🔍 16px, #AEAEB2, left padding 8px
    Placeholder: "Search notes, topics, keywords..."
    Font: 14px
    Focus: Border color #7F77DD, bg white, shadow 0px 2px 8px rgba(127,119,221,0.1)

[2] Grid Icon (⊞)
    Size: 24px
    Color: #8C8C8E
    Tap: Toggle between grid/list view
    Margin left: 8px

[3] New Button (+ New) - PURPLE, PROMINENT
    Height: 40px
    Padding: 8px 16px
    Background: #7F77DD
    Color: #FFFFFF
    Font: 14px, weight 600
    Icon: + (plus), 16px, white, right margin 6px
    Border radius: 8px
    Hover: Background #6B65C7, shadow 0px 2px 8px rgba(127,119,221,0.2)
    Active: Background #5F56B8, scale 0.98
    Tap: Open new note/folder dialog
```

#### Left Sidebar
```
Position: Fixed, width 280px
Height: 100vh
Background: #FFFFFF
Border right: 1px solid #E8E6F0

[HEADER] Height 60px
    Title: "Notes"
    Font: 16px, weight 600
    Padding: 12px 16px

[NAVIGATION ITEMS] Each 48px height
    
    ⊙ Home (ACTIVE)
        Icon: 20px, color #7F77DD
        Text: "Home", 14px, weight 500, color #7F77DD
        Background: #F0EBFF
        Left border: 3px solid #7F77DD
        Left margin: -3px
        Padding: 12px 16px
        Hover: Background #F9F8FC
    
    ⭐ Pinned (INACTIVE)
        Icon: 20px, color #8C8C8E
        Text: "Pinned", 14px, weight 400, color #8C8C8E
        Background: transparent
        Padding: 12px 16px
        Hover: Background #F9F8FC
        Tap: Navigate to pinned notes view
    
    🕐 Recent (INACTIVE)
        Same styling as Pinned
        Tap: Navigate to recent notes view
    
    👥 Shared with me (INACTIVE)
        Same styling as Pinned
        Tap: Navigate to shared notes view
    
    🗑️  Trash (INACTIVE)
        Same styling as Pinned
        Tap: Navigate to trash view

[SUBJECTS SECTION HEADER]
    Padding: 16px 16px 8px
    Text: "SUBJECTS"
    Font: 10px, weight 700, letter-spacing 0.5px
    Color: #8C8C8E

[SUBJECT ITEMS] Each 48px height

    📕 Polity
        Icon: 20px, background #7F77DD, border radius 6px, white icon inside
        Text: "Polity", 14px, weight 400, color #3A3A3C
        Right side: Dropdown arrow (optional)
        Hover: Background #F9F8FC
        Tap: Navigate to this subject (Screen 2)

    📙 Economy
        Icon: 20px, background #FF9500 (orange)
        Text: "Economy"
        Same styling as Polity
    
    📕 History
        Icon: 20px, background #D1654B (coral)
        Text: "History"
    
    🌍 Geography
        Icon: 20px, background #4CAF50 (green)
        Text: "Geography"
    
    🔵 Ethics
        Icon: 20px, background #5B7ADB (blue)
        Text: "Ethics"
    
    🌿 Environment
        Icon: 20px, background #52A884 (teal)
        Text: "Environment"
    
    🔬 Science & Tech
        Icon: 20px, background #F5A623 (gold)
        Text: "Science & Tech"

[ADD NEW SUBJECT]
    Height: 48px
    Padding: 12px 16px
    Text: "+ New Subject"
    Font: 14px, weight 500, color #7F77DD
    Icon: + (plus), 16px, color #7F77DD, left of text
    Hover: Background #F9F8FC
    Tap: Open dialog to create new subject

[SETTINGS]
    Height: 48px
    Padding: 12px 16px
    Icon: ⚙️ (gear), 20px, color #8C8C8E
    Text: "Settings", 14px, weight 400, color #3A3A3C
    Hover: Background #F9F8FC
    Tap: Open settings page
```

#### Main Content Area - Cards Grid

```
CONTINUE STUDYING Section
    
    Title Row (Above cards):
        Position: Left margin 24px, top margin 24px
        Title: "Continue Studying"
            Font: 16px, weight 600, color #3A3A3C
        See All Link: "See All" 
            Font: 14px, color #7F77DD
            Position: Right aligned, right margin 24px
            Same vertical level as title
            Tap: Navigate to full continue studying view
    
    Cards Grid:
        Display: Grid, 4 columns (responsive)
        Gap: 12px
        Padding: 0px 24px 24px
        Max width: Full container
        
        [CARD STRUCTURE - Each card]:
            Background: #F9F8FC
            Border: 1px solid #E8E6F0
            Border radius: 12px
            Padding: 12px
            Height: 120px
            Display: flex, flex-direction column, justify-content space-between
            
            [ICON - Top]:
                Size: 36px square
                Background: Subject color (purple, orange, coral, etc.)
                Border radius: 8px
                Icon inside: 20px white
                Icon type: Subject-specific (book, briefcase, etc.)
            
            [TEXT - Bottom]:
                Title:
                    Text: "Article 21"
                    Font: 14px, weight 600, color #3A3A3C
                
                Subject (Subtitle):
                    Text: "Polity"
                    Font: 12px, weight 400, color #8C8C8E
                    Top margin: 4px
                
                Timestamp:
                    Text: "Today, 9:41 AM"
                    Font: 11px, color #AEAEB2
                    Top margin: 4px
            
            Hover State:
                Background: #F0EBFF (light purple)
                Border: 1px solid #7F77DD
                Shadow: 0px 2px 8px rgba(127,119,221,0.1)
                Cursor: pointer
            
            Tap: Navigate to that note (opens glance view - Screen 4)

PINNED NOTES Section
    
    Title Row:
        Position: Left margin 24px, top margin 24px
        Title: "Pinned Notes"
            Font: 16px, weight 600, color #3A3A3C
        See All Link: "See All"
            Same styling as Continue Studying
    
    Cards Grid:
        Display: Grid, 2 columns
        Gap: 12px
        Padding: 0px 24px 24px
        
        [CARD STRUCTURE - Same as above, BUT with additional elements]:
            
            [STAR ICON - Top right corner]:
                Icon: ⭐ (star), 16px, color #FFB800
                Position: Top right, padding 8px
                Background: Optional light hover
                Tap: Unpin the note
            
            [PAGES COUNT - Below subject]:
                Text: "• 8 pages" or "• 10 pages"
                Font: 11px, color #8C8C8E
                Position: Below subject name
                Left margin: 4px

RECENT NOTES Section
    
    Title Row:
        Position: Left margin 24px, top margin 24px
        Title: "Recent Notes"
        See All Link: "See All"
    
    Cards Grid:
        Display: Grid, 3 columns
        Gap: 12px
        Padding: 0px 24px 24px (bottom padding before scroll ends)
        
        [CARD STRUCTURE - Same as Pinned Notes]

[END OF SCREEN 1]
```

---

## SCREEN 2: SUBJECT SELECTED (Topics List)

Triggered when: User taps a subject (e.g., "Polity") from Screen 1

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 9:41 AM         Tue 14 May                             100%      🔋     │  ← Status Bar
├─────────────────────────────────────────────────────────────────────────┤
│ ≡  Notes                                    🔔        👤         ⋯       │  ← Top Bar
├─────────────────────────────────────────────────────────────────────────┤
│ 🔍 Search topics in Polity...             ⊞      [+ New Topic]         │  ← Search + Actions
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ LEFT SIDEBAR (280px)    │  MAIN CONTENT (Remaining)                      │
│                         │                                                │
│ Notes                   │  EMPTY STATE:                                  │
│                         │  (User hasn't selected a topic yet)            │
│ ⊙ Home                  │                                                │
│                         │      [📚 Large Icon - 80px, #AEAEB2]          │
│ Polity ⟩ (highlighted)  │      "Select a topic to view notes"           │
│   bg: #F0EBFF           │      Font: 16px, weight 500, color #8C8C8E    │
│   border-left: purple   │                                                │
│   text: #7F77DD         │      "Choose a topic from the left to"        │
│                         │       "see your notes here."                   │
│   ├─ Constitution (25)  │      Font: 12px, color #AEAEB2                │
│   ├─ Fundamental Right. │                                                │
│   ├─ Directive Princ.   │                                                │
│   ├─ Fundamental Duties │                                                │
│   ├─ Parliament (12)    │                                                │
│   ├─ Executive (9)      │                                                │
│   ├─ Judiciary (15)     │                                                │
│   ├─ Federalism (11)    │                                                │
│   ├─ Election Comm. (8) │                                                │
│   ├─ Const. Bodies (8)  │                                                │
│   ├─ Amendment (7)      │                                                │
│   ├─ Important Art. (12)│                                                │
│   └─ Environment (3)    │                                                │
│                         │                                                │
└─────────────────────────────────────────────────────────────────────────┘
```

### SCREEN 2: BUTTON PLACEMENT DETAILS

#### Left Sidebar (Changed from Screen 1)
```
[HEADER] Same as Screen 1

[NAVIGATION ITEMS] Same as Screen 1, but "Polity" is highlighted instead of "Home"

[SUBJECT TREE] - NEW/CHANGED
    
    Polity (Root - highlighted)
        Text: "Polity"
        Font: 14px, weight 500, color #7F77DD
        Background: #F0EBFF
        Left border: 3px solid #7F77DD
        Padding: 12px 16px
        Height: 48px
        Arrow: Optional "⟩" showing it's expanded
        Tap: Collapse/expand (optional - already expanded on screen 2)
    
    Topic Items (Nested under Polity):
        ├─ Constitution
            Font: 14px, weight 400, color #3A3A3C
            Padding: 12px 16px (left margin 8px more for indent)
            Height: 44px
            Count Badge: "(25)" right-aligned, 12px, color #AEAEB2
            Hover: Background #F9F8FC
            Tap: Go to Screen 3 (Topic selected)
        
        ├─ Fundamental Rights
            Same styling as Constitution
            Count: "(20)"
        
        ├─ Directive Principles
            Count: "(18)"
        
        [... more topics ...]
```

#### Main Content Area
```
Search Bar (Changed):
    Placeholder: "Search topics in Polity..."
    Icon: 🔍 (magnifying glass)
    Everything else same as Screen 1

[NEW TOPIC BUTTON]:
    Text: "+ New Topic"
    Background: #7F77DD
    Color: #FFFFFF
    Font: 14px, weight 600
    Height: 40px
    Padding: 8px 16px
    Border radius: 8px
    Position: Right side, same row as search
    Tap: Open dialog to create new topic under Polity

EMPTY STATE (No topic selected):
    Icon: 📚 (book icon)
        Size: 80px
        Color: #AEAEB2
        Centered vertically
    
    Title Text:
        "Select a topic to view notes"
        Font: 16px, weight 500, color #8C8C8E
        Top margin: 20px from icon
    
    Subtitle Text:
        "Choose a topic from the left to see your notes here."
        Font: 12px, color #AEAEB2
        Top margin: 8px
    
    All centered in main area
```

---

## SCREEN 3: TOPIC SELECTED (Notes List)

Triggered when: User taps a topic (e.g., "Fundamental Rights") from Screen 2

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 9:41 AM         Tue 14 May                             100%      🔋     │  ← Status Bar
├─────────────────────────────────────────────────────────────────────────┤
│ ≡  Notes                                    🔔        👤         ⋯       │  ← Top Bar
├─────────────────────────────────────────────────────────────────────────┤
│ 🔍 Search notes in Fundamental Rights...   ⊞    [+ New Note]          │  ← Search + Actions
├─────────────────────────────────────────────────────────────────────────┤
│ < Polity > Fundamental Rights                                           │  ← Breadcrumb
├─────────────────────────────────────────────────────────────────────────┤
│ LEFT SIDEBAR (280px)    │  MAIN CONTENT (Remaining)                      │
│                         │                                                │
│ Notes                   │  Right to Equality              [+ New Note]   │  ← Header
│                         │                                                │
│ ⊙ Home                  │  ┌────────────────────────────────────────┐   │
│                         │  │ 📄  General Overview - Right to Equal. │ ⭐ │
│ Polity ⟩                │  │     Today, 9:41 AM               ⋯    │   │
│   ├─ Constitution       │  └────────────────────────────────────────┘   │
│   ├─ Fundamental Right. │  ┌────────────────────────────────────────┐   │
│   │  ├─ Preamble        │  │ 📋  Article 14 - Equality Before Law  │ ⭐ │
│   │  ├─ Right to Equ.   │  │     Yesterday                    ⋯    │   │
│   │  │ (ACTIVE/HIGH)    │  └────────────────────────────────────────┘   │
│   │  ├─ Right to Free.  │  ┌────────────────────────────────────────┐   │
│   │  ├─ Right against E.│  │ 📋  Article 15 - Prohibition of Disc. │    │
│   │  ├─ Right to Free.  │  │     2 days ago                   ⋯    │   │
│   │  │   of Religion    │  └────────────────────────────────────────┘   │
│   │  ├─ Cultural Rights │  ┌────────────────────────────────────────┐   │
│   │  └─ Right to Const. │  │ 📋  Article 16 - Equality of Opport.  │    │
│   │                     │  │     3 days ago                   ⋯    │   │
│   │  (6 subtopics)      │  └────────────────────────────────────────┘   │
│   │                     │  ┌────────────────────────────────────────┐   │
│   ├─ Directive Princ.   │  │ 📋  Article 17 - Abolition of Untough.│    │
│   ├─ ...                │  │     5 days ago                   ⋯    │   │
│                         │  └────────────────────────────────────────┘   │
│                         │  ┌────────────────────────────────────────┐   │
│                         │  │ 📋  Special Provisions - Women, Child. │    │
│                         │  │     5 days ago                   ⋯    │   │
│                         │  └────────────────────────────────────────┘   │
│                         │                                                │
│                         │  [Infinite Scroll - Load more on scroll]       │
│                         │                                                │
└─────────────────────────────────────────────────────────────────────────┘
```

### SCREEN 3: BUTTON PLACEMENT DETAILS

#### Left Sidebar (Updated)
```
[TOPIC TREE] - Updated from Screen 2

Polity ⟩
  ├─ Constitution
  ├─ Fundamental Rights ⟩ (highlighted/active)
  │  bg: #F0EBFF
  │  border-left: 3px solid #7F77DD
  │  text-weight: 500
  │  text-color: #7F77DD
  │  
  │  └─ Subtopics (When arrow is tapped, these expand):
  │     ├─ Preamble
  │     ├─ Right to Equality (SELECTED - user is here)
  │     ├─ Right to Freedom
  │     ├─ Right against Exploitation
  │     ├─ Right to Freedom of Religion
  │     ├─ Cultural & Educational Rights
  │     └─ Right to Constitutional Remedies
  │
  ├─ Directive Principles
  ├─ ...
```

#### Breadcrumb Navigation
```
Position: Below search bar, height 32px
Padding: 0px 24px
Background: Transparent or #F9F8FC (faint)

Components (Gap 0px between text):
    [1] "Polity" (text, clickable)
        Font: 13px, weight 400, color #7F77DD
        Tap: Go back to Screen 2
    
    [2] ">" (separator)
        Font: 12px, color #AEAEB2
        Margin: 0px 8px
    
    [3] "Fundamental Rights" (text, clickable)
        Font: 13px, weight 400, color #7F77DD
        Tap: Optional - might do nothing or refresh
    
    [4] ">" (separator)
        Font: 12px, color #AEAEB2
        Margin: 0px 8px
    
    [5] "Right to Equality" (text, current page - NOT clickable)
        Font: 13px, weight 500, color #3A3A3C
        Grayed out / not clickable
```

#### Main Content Area Header
```
Position: Below breadcrumb, height 48px
Padding: 12px 24px
Display: Flex, space-between, align-center

Left Side:
    Title: "Right to Equality"
        Font: 16px, weight 600, color #3A3A3C
        Left padding: 0px

Right Side (Gap: 12px):
    [1] Search Input (Optional/Advanced)
        Placeholder: "Search notes in Right to Equality..."
        Icon: 🔍 (magnifying glass), 16px
        Width: 200px (or hidden on mobile)
    
    [2] Grid Icon (⊞)
        Icon: 24px, color #8C8C8E
        Tap: Toggle grid/list view
    
    [3] New Note Button (PRIMARY BUTTON)
        Text: "+ New Note"
        Background: #7F77DD (purple)
        Color: #FFFFFF
        Font: 14px, weight 600
        Height: 40px
        Padding: 8px 16px
        Border radius: 8px
        Icon: + (plus), 16px, white
        Hover: Background #6B65C7, shadow
        Active: Background #5F56B8, scale 0.98
        Tap: Open new note creation dialog
```

#### Notes List (Infinite Scroll)
```
Container:
    Padding: 0px 24px
    Gap: 0px (continuous list)
    Scroll: Vertical, infinite scroll enabled

[NOTE ITEM - Card Style]:
    Height: 72px
    Padding: 12px 24px
    Border bottom: 1px solid #E8E6F0
    Display: Flex, space-between, align-center
    
    LEFT SECTION (Main content):
        Display: Flex, align-items center, gap 12px
        
        Icon (Document):
            Size: 32px square
            Background: Subject color (#7F77DD for Polity)
            Border radius: 8px
            Icon inside: 📄 or 📋 (document), 18px, #FFFFFF
        
        Content (Flex, flex-direction column, justify-content center):
            Title:
                Text: "Article 14 - Equality Before Law"
                Font: 15px, weight 600, color #3A3A3C
                Max lines: 1 (ellipsis if overflow)
                Line height: 1.2
            
            Metadata:
                Text: "Yesterday"
                Font: 12px, color #8C8C8E
                Top margin: 4px
    
    RIGHT SECTION (Gap: 12px between elements):
        [1] Star Icon (⭐)
            Icon: 16px
            Color: #FFB800 (if pinned) or #AEAEB2 (if not pinned)
            Tap: Toggle pin/unpin
            Shows only if pinned (or always visible)
        
        [2] More Menu (⋯)
            Icon: 20px, color #8C8C8E
            Tap: Open context menu
                Options:
                    - Pin/Unpin
                    - Duplicate
                    - Move to folder
                    - Delete
                    - Export

    Hover State:
        Background: #F9F8FC
        Shadow: 0px 2px 8px rgba(0,0,0,0.05)
        Cursor: pointer
    
    Active/Selected State:
        Background: #F0EBFF
        Left border: 3px solid #7F77DD (blue accent)
    
    Tap: Navigate to Screen 4 (Glance View)

[INFINITE SCROLL LOADING]:
    Trigger: When user scrolls to 80% of list
    Load: Next 15-20 notes
    Animation: Fade in, 0.3s ease
    
    Loading Indicator (at bottom of list):
        Spinner: Rotating circle, 20px, #7F77DD
        Text: "Loading more notes..."
            Font: 12px, color #AEAEB2
            Top margin: 8px
        Padding: 16px
```

---

## SCREEN 4: GLANCE VIEW (Read-Only Note Preview)

Triggered when: User taps a note from Screen 3

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 9:41 AM         Tue 14 May                             100%      🔋     │  ← Status Bar
├─────────────────────────────────────────────────────────────────────────┤
│ <  Article 14        ● Saved              [Share]  [Export]   ⋯        │  ← Header
├─────────────────────────────────────────────────────────────────────────┤
│ < Polity > Fundamental Rights > Right to Equality > Article 14          │  ← Breadcrumb
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ [INFINITE SCROLL CONTENT AREA]                                           │
│                                                                           │
│ Article 14 - Equality Before Law                                         │
│ ═══════════════════════════════════                                      │
│                                                                           │
│ Key Points                                              [Key Point]     │
│ ───────────                                                              │
│ • Article 14 of the Indian Constitution guarantees the Right to          │
│   Equality.                                                              │
│                                                                           │
│ • It embodies two fundamental concepts - Equality before Law and        │
│   Equal Protection of Laws [highlighted in yellow]                      │
│                                                                           │
│ Important Case                                      [Important Case]    │
│ ─────────────────                                                        │
│ • Borrowed from the British Constitution.                                │
│ • Means that all persons are equal before ordinary law of the land.     │
│ • There can be no special privileges in favor of any person.            │
│ • Applies to all persons – citizens and non-citizens.                   │
│ • Example: Traffic rules apply equally to everyone.                     │
│                                                                           │
│ Notes                                                                    │
│ ─────                                                                    │
│ • Article 14 is not an absolute right.                                  │
│ • Deprivation of life or personal liberty must be just, fair and        │
│   reasonable [highlighted in yellow/orange with underline]              │
│ • Any law violating Article 14 is struck down as unconstitutional       │
│   [highlighted in orange/red with strikethrough]                        │
│                                                                           │
│ ──── End of Glance ────                                                  │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘

[LEFT SIDEBAR HIDDEN or MINIMIZED - Optional]
```

### SCREEN 4: BUTTON PLACEMENT DETAILS

#### Sidebar
```
Position: Hidden or Collapsed to 40px (icon-only mode)
Toggle: Hamburger button (≡) in top bar or dedicated collapse button

When collapsed to 40px:
    Shows only vertical icons
    Tap icon to toggle back to full sidebar
    Or full sidebar visible and user can tap collapse (⟨) button
```

#### Top Bar (Header - GLANCE VIEW)
```
Height: 60px
Padding: 12px 24px
Display: Flex, space-between, align-center
Background: #FFFFFF
Border bottom: 1px solid #E8E6F0

LEFT SIDE (Gap: 12px):
    [1] Back Arrow (<)
        Icon: 24px, color #8C8C8E
        Tap: Go back to Screen 3 (notes list)
    
    [2] Title
        Text: "Article 14"
        Font: 18px, weight 600, color #3A3A3C
        Left margin: 12px
        Max width: 60% (ellipsis if overflow)

    [3] Saved Status Badge
        Icon: ● (dot), 8px, color #34C759 (green)
        Text: "Saved"
        Font: 12px, weight 500, color #34C759
        Left margin: 8px
        Updates:
            "● Saved" (green) - when saved
            "● Saving..." (yellow #FFB800) - when saving
            "● Unsaved" (red #FF3B30) - if unsaved changes

RIGHT SIDE (Gap: 8px):
    [1] Pin/Star Icon (⭐)
        Icon: 16px
        Color: #FFB800 (if pinned) or #AEAEB2 (if not)
        Tap: Toggle pin/unpin
        Optional: Hide if not pinned
    
    [2] Share Button
        Icon: 📤 (upload/share), 20px, color #8C8C8E
        Text: "Share"
        Font: 13px, color #8C8C8E
        Display: Icon + text or icon only
        Tap: Open share menu (email, WhatsApp, etc.)
    
    [3] Export Button
        Icon: 📥 (download), 20px, color #8C8C8E
        Text: "Export"
        Font: 13px, color #8C8C8E
        Display: Icon + text or icon only
        Tap: Open export dialog (PDF, Word, HTML, etc.)
    
    [4] More Menu (⋯)
        Icon: 20px, color #8C8C8E
        Tap: Open dropdown menu
            Options:
                - Edit
                - Duplicate
                - Move to folder
                - Delete
                - Print
                - View history (if available)
```

#### Breadcrumb Navigation
```
Same as Screen 3, but extends with note title:
    "< Polity > Fundamental Rights > Right to Equality > Article 14"
    
    All clickable to go back to previous level, except last item
```

#### Content Area (Infinite Scroll - KEY FEATURE)
```
Container:
    Padding: 24px
    Max width: 800px (desktop centered), 100% (mobile)
    Background: #FFFFFF
    Scroll: Vertical, infinite scroll to bottom shows "End of Glance"

[CONTENT FORMATTING]:

    Headings (H1):
        Font: 20px, weight 600, color #3A3A3C
        Line height: 1.2
        Top margin: 24px
        Bottom margin: 12px
    
    Headings (H2):
        Font: 16px, weight 600, color #3A3A3C
        Top margin: 16px
        Bottom margin: 8px
    
    Paragraph Text:
        Font: 14px, weight 400, color #3A3A3C
        Line height: 1.6
        Bottom margin: 12px
    
    Bullet List:
        Font: 14px, color #3A3A3C
        Left padding: 24px
        Bullet character: "•" (dash or bullet), color #8C8C8E
        Gap between items: 8px
    
    Bold Text:
        Font weight: 600, color #3A3A3C (same as normal)
    
    Italic Text:
        Font style: italic, color #8C8C8E (slightly muted)

[HIGHLIGHTS & ANNOTATIONS]:

    Yellow Highlight:
        Background: #FFE066
        Color: #000000 (black text)
        Padding: 2px 4px
        Border radius: 2px
    
    Pink Highlight:
        Background: #FF6A88
        Color: #FFFFFF (white text)
        Padding: 2px 4px
        Border radius: 2px
    
    Blue Highlight:
        Background: #85B7EB
        Color: #FFFFFF
        Padding: 2px 4px
        Border radius: 2px
    
    Green Highlight:
        Background: #81C784
        Color: #FFFFFF
        Padding: 2px 4px
        Border radius: 2px
    
    Underline:
        Text decoration: underline, color #AEAEB2

[BADGES/LABELS]:

    "Key Point" Badge:
        Position: Right of highlighted text
        Background: #FFE066 (yellow)
        Color: #000000
        Font: 10px, weight 600
        Padding: 4px 8px
        Border radius: 4px
        Right margin: 8px
    
    "Important Case" Badge:
        Position: Right of text/section
        Background: #E8F5E9 (light green)
        Color: #52A884 (dark green)
        Font: 10px, weight 600
        Padding: 4px 8px
        Border radius: 4px

[CHECKLISTS]:

    Checkbox Item:
        Height: 32px
        Display: Flex, align-items center, gap 8px
        
        Checkbox:
            Size: 18px square
            Border: 1px solid #AEAEB2
            Border radius: 4px
            Background: #FFFFFF
            
            Checked State:
                Background: #34C759 (green)
                Checkmark: ✓ white, 12px, centered
        
        Text:
            Font: 14px, color #3A3A3C
            Strikethrough: If checked
            Left padding: 12px (after checkbox)
        
        Tap: Marks done (temporary in glance, doesn't save)

[END OF GLANCE MARKER]:

    Text: "──── End of Glance ────"
    Font: 12px, color #AEAEB2
    Text align: Center
    Top margin: 24px
    Bottom padding: 24px
    
    Below this: User can scroll but no more content (or load more if paginated)
```

#### INFINITE SCROLL BEHAVIOR
```
Trigger: User scrolls to bottom of content
Behavior: 
    - If content fits on one page: Show "End of Glance" message
    - If content is paginated: Load next 50% of content automatically
    - Smooth fade-in animation: 0.3s ease
    - No loading indicator needed (seamless)

Auto-Scroll Features:
    - Remembers scroll position when user navigates back
    - Tap on breadcrumb sections to jump to that section
    - Smooth scrolling animations
```

---

## SCREEN 5: EDITOR MODE (Edit/Create Note)

Triggered when: User taps "Edit" from Screen 4 OR taps "+ New Note" from Screen 3

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 9:41 AM         Tue 14 May                             100%      🔋     │  ← Status Bar
├─────────────────────────────────────────────────────────────────────────┤
│ <  Article 21            ● Saved              [Share]  [Export]  ⋯     │  ← Header
├─────────────────────────────────────────────────────────────────────────┤
│ H1 H2 B I U • ◦ 🔦 🎨 🔗 🖼️ ⊞ ⟨⟩ + [...more]                        │  ← Toolbar
│                     [Yellow] [Pink] [Blue] [Green] [Purple] [Light Blue]│  ← Color Picker
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ [MAIN EDITOR AREA]    │  RIGHT SIDEBAR (200px)                          │
│                       │  ─────────────────────                          │
│                       │  Blocks | Outline (tabs)                        │
│ Protection of Life... │                                                  │
│ ═══════════════════   │  H1 Protection of Life and...                   │
│                       │     H2 Key Points                               │
│ Key Points            │     H2 Important Cases                          │
│ ────────────────      │     H2 Notes (Checklist)                        │
│ • No person shall...  │                                                  │
│   [Text highlighted]  │                                                  │
│ • Interpreted widely  │                                                  │
│ • Includes ☑ right... │                                                  │
│   [Green highlight]   │                                                  │
│                       │                                                  │
│ Important Cases       │                                                  │
│ ────────────────      │                                                  │
│ • Maneka Gandhi v.    │                                                  │
│   Union of India      │                                                  │
│                       │                                                  │
│ [Cursor blinks here]  │                                                  │
│                       │                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│ Aa    100%    ──●──    +              Words: 1234   ⚙️  🕐               │  ← Bottom Bar
└─────────────────────────────────────────────────────────────────────────┘

[LEFT SIDEBAR HIDDEN or MINIMIZED to 40px]
```

### SCREEN 5: BUTTON PLACEMENT DETAILS

#### Sidebar
```
Same as Screen 4: Hidden or collapsed
Toggle: Hamburger button (≡) in top bar
```

#### Top Bar (Header - EDITOR MODE)
```
Height: 60px
Padding: 12px 24px
Display: Flex, space-between, align-center

LEFT SIDE (Same as Screen 4):
    [1] Back Arrow (<) - Returns to Screen 4 (glance view)
    [2] Title: "Article 21" (editable, shows cursor)
    [3] Saved Status: "● Saved" or "● Saving..." or "● Unsaved"
        Auto-save: Triggered 2 seconds after user stops typing
        Color: Green (#34C759) when saved
        Color: Yellow (#FFB800) when saving
        Color: Red (#FF3B30) if unsaved

RIGHT SIDE (Same as Screen 4):
    [1] Share Button
    [2] Export Button
    [3] More Menu ⋯
```

#### Rich Text Toolbar (FIXED - Does not scroll)
```
Position: Below header, height 48px
Padding: 8px 24px
Background: #FFFFFF
Border bottom: 1px solid #E8E6F0
Display: Flex, gap 8px, align-center, flex-wrap

[GROUP 1 - TEXT FORMATTING]:
    
    [1] H1 Button
        Text: "H1"
        Size: 36x36px
        Background: #F9F8FC
        Border: 1px solid #E8E6F0
        Font: 12px, weight 600, color #3A3A3C
        Border radius: 6px
        Hover: Background #F0EBFF, border #7F77DD
        Active (when H1 selected): Background #7F77DD, color white, border #7F77DD
        Tap: Apply H1 formatting to selected text or new line
    
    [2] H2 Button (Same styling as H1)
        Text: "H2"
    
    [3] H3 Button (Same styling as H1)
        Text: "H3"

[GROUP 2 - TEXT STYLE]:
    
    [4] Bold Button (B)
        Icon: 16px "B"
        Size: 36x36px
        Active when text is bold
        Hover/Active: Same as H1
        Tap: Toggle bold on selected text
    
    [5] Italic Button (I)
        Icon: 16px "I" (slanted)
        Same styling as Bold
    
    [6] Underline Button (U)
        Icon: 16px "U" with underline
        Same styling as Bold

[DIVIDER]:
    1px solid #E8E6F0, height 24px

[GROUP 3 - LISTS]:
    
    [7] Bullet List Button (•)
        Icon: Bullet point
        Size: 36x36px
        Tap: Create bulleted list
    
    [8] Numbered List Button (1.)
        Icon: "1."
        Tap: Create numbered list

[DIVIDER]:
    1px solid #E8E6F0, height 24px

[GROUP 4 - HIGHLIGHTER]:
    
    [9] Highlighter Button (🔦)
        Icon: Highlighter pen, 16px
        Size: 36x36px
        Tap: Highlight selected text or show color picker below
    
    [COLOR PICKER - Shows when highlighter is tapped]:
        Display: Flex, gap 8px, margin-top 8px
        
        Color Swatches (Each 24x24px):
            Yellow:  #FFE066
            Orange:  #FF9500
            Pink:    #FF6A88
            Green:   #81C784
            Blue:    #85B7EB
            Purple:  #7F77DD
            Light Blue: #B3E5FC
        
        Border radius: 4px each
        Hover: Scale 1.1, subtle shadow
        Tap: Apply color to selected text

[GROUP 5 - INSERT]:
    
    [10] Emoji Picker (😊)
        Icon: Smiley face, 16px
        Size: 36x36px
        Tap: Open emoji picker
    
    [11] Link Button (🔗)
        Icon: Link/chain, 16px
        Tap: Insert link dialog
    
    [12] Image Button (🖼️)
        Icon: Picture/image, 16px
        Tap: Insert image dialog
    
    [13] Attachment Button (📎)
        Icon: Paperclip, 16px
        Tap: Attach file
    
    [14] Table Button (⊞)
        Icon: Table grid, 16px
        Tap: Insert table dialog
    
    [15] Code Block Button (⟨⟩)
        Icon: Angle brackets, 16px
        Tap: Insert code block

[GROUP 6 - MORE]:
    
    [16] More Menu (...)
        Icon: Three dots, 16px
        Size: 36x36px
        Tap: Opens dropdown with more options
            - Strikethrough
            - Superscript
            - Subscript
            - Quote block
            - Divider
            - Clear formatting
            - HTML view (advanced)
```

#### Main Editor Content Area
```
Position: Left side (or center), flex 1
Padding: 24px
Background: #FFFFFF
Min height: 100vh

[EDITABLE TEXT]:
    Font: Anthropic Sans, 14px
    Color: #3A3A3C
    Line height: 1.6
    
    All text is editable
    Double-tap or triple-tap to select words/lines
    Click/tap to place cursor
    
    Text Cursor:
        Color: #7F77DD (purple)
        Width: 2px
        Blinking animation
    
    Text Selection:
        Background: rgba(127, 119, 221, 0.2) (light purple)
        Color: #3A3A3C (text visible)

[SPECIAL ELEMENTS]:

    Headings:
        Styled according to H1/H2/H3 buttons
        Each heading is a separate block
    
    Bullets:
        Each bullet is interactive
        Can edit, delete, move, indent
    
    Highlights:
        Display with color background
        Can click to remove highlight
    
    Checkboxes:
        Clickable in editor
        Shows ☑ (checked) or ☐ (unchecked)
        Tap to toggle

[BLOCKS]:
    
    Each paragraph/heading/list is a "block"
    Blocks can be:
        - Deleted (long-press, select delete)
        - Moved (drag handle, if available)
        - Copied (long-press, select copy)
        - Duplicated (long-press, select duplicate)

[INSERT POINT]:
    
    Between blocks: "+  Add block" button appears on hover
    Tap: Opens quick insert menu
        - Text
        - Heading
        - List
        - Checkbox
        - Quote
        - Divider
        - Image
        - Code
```

#### Right Sidebar (Outline/Structure)
```
Position: Fixed right, width 200px
Background: #F9F8FC
Border left: 1px solid #E8E6F0
Height: 100vh - header - toolbar
Padding: 16px

[TAB 1: BLOCKS] (Currently selected)
    Font: 13px, weight 500, color #7F77DD
    Padding bottom: 8px
    Border bottom: 2px solid #7F77DD
    Underline: Indicates active tab

[TAB 2: OUTLINE] (Not selected)
    Font: 13px, weight 400, color #8C8C8E
    Padding bottom: 8px
    Border bottom: None
    Hover: Color #3A3A3C
    Tap: Switch to outline view

[BLOCKS LIST UNDER "BLOCKS" TAB]:
    
    H1 Block:
        Text: "Protection of Life and..."
        Font: 13px, weight 600, color #3A3A3C
        Top margin: 8px
        Left padding: 0px
        Clickable: Tap to jump to that block in editor
        Hover: Background #F0EBFF
    
    H2 Block:
        Text: "Key Points"
        Font: 12px, weight 500, color #8C8C8E
        Left padding: 12px (indent)
        Top margin: 4px
        Clickable: Tap to jump
    
    Body/Text Block:
        Text: "No person shall be deprived..." (first few words)
        Font: 12px, color #AEAEB2
        Left padding: 12px
        Opacity: 0.7
    
    All blocks:
        Drag handle (optional): Handle icon ≡ on left (if draggable)
        Click icon: Shows quick action menu
            - Edit name
            - Delete
            - Duplicate
            - Move up/down
```

#### Bottom Status Bar
```
Position: Fixed bottom, height 44px
Padding: 8px 24px
Background: #F9F8FC
Border top: 1px solid #E8E6F0
Display: Flex, space-between, align-center

LEFT SIDE:
    [1] Font Size Control
        Icon: "Aa" (text), 16px, color #8C8C8E
        Left margin: 0px
        Tap: Opens font size menu
            - Small (12px)
            - Normal (14px)
            - Large (16px)
            - Extra Large (18px)

[CENTER]:
    [2] Zoom Control
        Text: "100%"
        Font: 12px, color #8C8C8E
        Left margin: 8px
        Tap: Opens zoom options (75%, 100%, 125%)
    
    [3] Zoom Slider (Optional)
        Display: Slider control
        Min: 75%, Max: 150%
        Default: 100%
        Width: 120px
        Left margin: 8px

RIGHT SIDE (Gap: 12px between items):
    [4] Add Block Button (+)
        Icon: Plus, 16px, color #7F77DD
        Tap: Insert new block below current
    
    [5] Word Count
        Text: "Words: 1234"
        Font: 12px, color #AEAEB2
        Updates real-time as user types
    
    [6] Settings Button (⚙️)
        Icon: Gear, 16px, color #8C8C8E
        Tap: Open editor settings
            - Font family
            - Line spacing
            - Text alignment
            - Dark mode (if available)
    
    [7] History/Revisions Button (🕐)
        Icon: Clock, 16px, color #8C8C8E
        Tap: Open revision history (if available)
            - See previous versions
            - Restore from backup
```

---

# PART 2: SCREEN NAVIGATION FLOW

## Flow Diagram

```
┌─────────────────┐
│  SCREEN 1       │
│  NOTES HOME     │
│  (Subject Hub)  │
└────────┬────────┘
         │ Tap Subject (Polity)
         ↓
┌─────────────────┐
│  SCREEN 2       │
│  SUBJECT        │
│  (Topics List)  │
└────────┬────────┘
         │ Tap Topic (Fundamental Rights)
         ↓
┌─────────────────┐
│  SCREEN 3       │
│  TOPIC          │
│  (Notes List)   │
└────────┬────────┘
         │ Tap Note (Article 14)
         ↓
┌─────────────────┐
│  SCREEN 4       │
│  GLANCE VIEW    │
│  (Read-Only)    │
└────┬──────┬─────┘
     │      │
     │      └─── Tap "Edit" Button
     │            ↓
     │      ┌─────────────────┐
     │      │  SCREEN 5       │
     │      │  EDITOR MODE    │
     │      │  (Read/Write)   │
     │      │                 │
     │      │ Auto-save every │
     │      │ keystroke       │
     │      └────────┬────────┘
     │               │
     │      Tap Back Arrow
     │               │
     └───────────────┘
             │
        Returns to Screen 4

[BACK BUTTONS]:
    Screen 2 → Screen 1: Tap Subject again OR Hamburger
    Screen 3 → Screen 2: Tap back arrow in breadcrumb
    Screen 4 → Screen 3: Tap back arrow (<) in header
    Screen 5 → Screen 4: Tap back arrow (<) in header
    Any screen → Home: Tap "Home" in sidebar
```

## Navigation Actions

```
SCREEN 1 (Home):
    - Tap Subject Card: Go to Screen 2
    - Tap Continue Studying Card: Go to Screen 4
    - Tap Pinned Card: Go to Screen 4
    - Tap Recent Card: Go to Screen 4
    - Tap "See All": Go to full list view
    - Tap Sidebar Navigation: Go to respective view (Recent, Pinned, Trash)

SCREEN 2 (Subject - Topics):
    - Tap Topic: Go to Screen 3
    - Tap Subject name (collapse): Go back to Screen 1
    - Tap Back arrow (if visible): Go back to Screen 1
    - Tap Home in sidebar: Go to Screen 1
    - Tap + New Topic: Open dialog to create topic

SCREEN 3 (Topic - Notes):
    - Tap Note: Go to Screen 4
    - Tap Breadcrumb > Subject: Go back to Screen 2
    - Tap Breadcrumb > Topic: Stay (or refresh)
    - Tap Back arrow (if visible): Go back to Screen 2
    - Tap Home in sidebar: Go to Screen 1
    - Tap + New Note: Go to Screen 5 (create new note)
    - Tap Star icon: Pin/unpin note
    - Tap More ⋯: Open context menu

SCREEN 4 (Glance View - Read):
    - Tap Back arrow (<): Go back to Screen 3
    - Tap Breadcrumb items: Navigate back
    - Tap "Edit" (in more menu): Go to Screen 5
    - Tap Share: Open share sheet
    - Tap Export: Open export dialog
    - Scroll infinitely: Load more content seamlessly
    - Tap Star: Pin/unpin note

SCREEN 5 (Editor - Write):
    - Tap Back arrow (<): Go back to Screen 4
    - Type/Edit: Auto-save triggered
    - Tap Toolbar buttons: Format text
    - Tap Blocks sidebar: Jump to block
    - Tap + Add block: Insert new block
    - Tap Share/Export: Same as Screen 4
```

---

# PART 3: AUTO-SAVE LOGIC (Bullet Points to Notebook)

## Auto-Save Mechanism

```
[TRIGGER POINTS]:

1. User stops typing for 2 seconds
   └─ Debounce timer starts
   └─ After 2 seconds: Save to database
   └─ Show "● Saving..." badge
   └─ After save completes: Show "● Saved" badge

2. User leaves editor (taps back)
   └─ Immediate save (no 2-second delay)
   └─ Show "● Saving..." briefly
   └─ Return to Screen 4 (glance view)

3. User creates new note
   └─ Auto-save enabled from first keystroke
   └─ Each keystroke: Timer resets
   └─ 2 seconds after last keystroke: Save

4. User adds bullet point
   └─ When user taps "+ Add block" or presses Enter after bullet
   └─ New bullet item created
   └─ Typing starts in new bullet
   └─ Auto-save on keystroke (2-second debounce)

5. Highlight added
   └─ When user selects text and picks color
   └─ Highlight applied immediately
   └─ Auto-save triggered

6. Checkbox toggled
   └─ When user taps checkbox
   └─ State changes immediately
   └─ Auto-save triggered
```

## Data Structure (What Gets Saved)

```
[NOTE OBJECT]:
{
  id: "note_12345",
  title: "Article 14 - Equality Before Law",
  content: [
    {
      type: "heading",
      level: 1,
      text: "Article 14 - Equality Before Law",
      id: "block_1"
    },
    {
      type: "heading",
      level: 2,
      text: "Key Points",
      id: "block_2"
    },
    {
      type: "bullet_list",
      items: [
        {
          id: "item_1",
          text: "Article 14 of the Indian Constitution...",
          highlights: [
            {
              start: 10,
              end: 15,
              color: "yellow"  // #FFE066
            }
          ]
        },
        {
          id: "item_2",
          text: "It embodies two fundamental concepts...",
          highlights: [
            {
              start: 25,
              end: 35,
              color: "yellow"
            }
          ]
        }
      ],
      id: "block_3"
    },
    {
      type: "heading",
      level: 2,
      text: "Important Case",
      id: "block_4"
    },
    {
      type: "bullet_list",
      items: [
        {
          id: "item_5",
          text: "Borrowed from the British Constitution.",
          highlights: []
        }
      ],
      id: "block_5"
    },
    {
      type: "heading",
      level: 2,
      text: "Notes",
      id: "block_6"
    },
    {
      type: "checklist",
      items: [
        {
          id: "check_1",
          text: "Article 14 is not an absolute right.",
          checked: false,
          highlights: []
        },
        {
          id: "check_2",
          text: "Deprivation of life or personal liberty...",
          checked: false,
          highlights: [
            {
              start: 0,
              end: 20,
              color: "yellow"
            }
          ]
        }
      ],
      id: "block_7"
    }
  ],
  created_at: "2026-05-14T09:41:00Z",
  updated_at: "2026-05-14T09:41:30Z" (updates on each save),
  is_pinned: true,
  folder_id: "folder_123",
  subject: "Polity",
  tags: ["Constitutional Law", "Fundamental Rights"]
}
```

## Save Request (To Database)

```
[SAVE ENDPOINT]:
    POST /api/notes/{noteId}/save
    OR
    POST /api/notes (for new notes)

[REQUEST BODY]:
{
  title: "Article 14 - Equality Before Law",
  content: [... content array as above ...],
  updated_at: current timestamp,
  is_pinned: boolean,
  subject: "Polity",
  tags: [...]
}

[RESPONSE]:
{
  success: true,
  note_id: "note_12345",
  updated_at: "2026-05-14T09:41:30Z",
  message: "Note saved successfully"
}

[ERROR RESPONSE]:
{
  success: false,
  error: "Failed to save note",
  reason: "Database connection error" (or other reason)
}

[IF ERROR]:
    - Show error toast: "Failed to save. Retrying..."
    - Retry after 5 seconds
    - Show "● Unsaved" badge in red
    - Enable manual "Save" button (if retries fail)
```

## Auto-Save Status Flow

```
User Typing
    ↓
[2-second debounce timer starts]
    ↓
[If user keeps typing: timer resets]
    ↓
[If user stops: timer reaches 2 seconds]
    ↓
"● Saving..." badge appears (yellow)
    ↓
POST request sent to /api/notes/save
    ↓
    ├─ [SUCCESS] ✓
    │   ↓
    │   Badge changes to "● Saved" (green)
    │   ↓
    │   [Stays green for 3 seconds]
    │   ↓
    │   [Can fade out or stay visible]
    │
    └─ [FAILURE] ✗
        ↓
        Badge changes to "● Unsaved" (red)
        ↓
        Show error toast: "Failed to save. Click to retry"
        ↓
        [User can manually click Save, or wait for auto-retry]
```

## Bullet Point Auto-Save Example

```
[SCENARIO 1: User adds new bullet]

User taps "+ Add block" button
    ↓
New empty bullet item appears with cursor
    ↓
User types: "No person shall be deprived of..."
    ↓
[After 2 seconds of no more typing]
    ↓
Auto-save triggered
    ↓
Database saves:
{
  type: "bullet_list",
  items: [
    { id: "item_new", text: "No person shall be deprived of...", highlights: [] }
  ]
}
    ↓
Badge shows "● Saved"

[SCENARIO 2: User adds highlight to existing bullet]

User selects text: "No person shall"
    ↓
User taps Highlighter button
    ↓
Color picker appears
    ↓
User taps Yellow: #FFE066
    ↓
Text gets yellow highlight immediately (visual feedback)
    ↓
Auto-save triggered immediately
    ↓
Database saves:
{
  type: "bullet_list",
  items: [
    {
      id: "item_1",
      text: "No person shall be deprived of...",
      highlights: [
        { start: 0, end: 14, color: "yellow" }
      ]
    }
  ]
}
    ↓
Badge shows "● Saved"

[SCENARIO 3: User deletes bullet point]

User long-presses bullet item
    ↓
Context menu appears
    ↓
User taps "Delete"
    ↓
Bullet item removed from list immediately
    ↓
Auto-save triggered
    ↓
Database saves:
{
  type: "bullet_list",
  items: [
    // bullet_1 removed
  ]
}
    ↓
Badge shows "● Saved"
```

---

# PART 4: COMPONENT STRUCTURE

## File Organization

```
src/
├── app/
│   └── (tabs)/
│       └── notes/
│           ├── index.tsx          [SCREEN 1 - Home Hub]
│           ├── [subject]/
│           │   ├── index.tsx       [SCREEN 2 - Topics List]
│           │   ├── [topic]/
│           │   │   ├── index.tsx   [SCREEN 3 - Notes List]
│           │   │   ├── [noteId]/
│           │   │   │   ├── glance.tsx [SCREEN 4 - Glance View]
│           │   │   │   ├── edit.tsx   [SCREEN 5 - Editor]
│           │   │   │   └── page.tsx   [Router page]
│           │   │   └── page.tsx
│           │   └── page.tsx
│           └── page.tsx
│
├── components/
│   └── notes/
│       ├── NotesHome.tsx           [Screen 1 - Home layout]
│       ├── SubjectSelector.tsx      [Sidebar subject selection]
│       ├── TopicsList.tsx           [Screen 2 - Topics layout]
│       ├── NotesList.tsx            [Screen 3 - Notes list]
│       ├── GlanceView.tsx           [Screen 4 - Read-only]
│       ├── NoteEditor.tsx           [Screen 5 - Editor layout]
│       ├── RichTextToolbar.tsx      [Formatting toolbar]
│       ├── OutlineSidebar.tsx       [Right sidebar - outline]
│       ├── BreadcrumbNav.tsx        [Navigation breadcrumb]
│       ├── NoteCard.tsx             [Card component for cards]
│       ├── NoteItem.tsx             [List item for notes]
│       ├── SidebarNavigation.tsx    [Left sidebar nav]
│       └── AutoSaveIndicator.tsx    [Status badge]
│
├── hooks/
│   ├── useAutoSave.ts              [Auto-save logic]
│   ├── useNotes.ts                 [Fetch/manage notes]
│   ├── useSubjects.ts              [Fetch subjects]
│   ├── useTopics.ts                [Fetch topics]
│   └── useNavigation.ts            [Navigation logic]
│
├── lib/
│   ├── supabase.ts                 [Database connection]
│   ├── noteService.ts              [API calls]
│   └── highlightUtils.ts           [Highlight parsing]
│
└── types/
    └── notes.ts                    [TypeScript types]
```

## Component Hierarchy

```
App
├── NotesIndex (Screen 1)
│   ├── SidebarNavigation (Left sidebar)
│   │   ├── NavigationItem (Home, Pinned, Recent, etc.)
│   │   └── SubjectItem (Polity, Economy, etc.)
│   ├── SearchBar
│   └── MainContent
│       ├── ContinueStudyingSection
│       │   └── NoteCard (Grid of cards)
│       ├── PinnedNotesSection
│       │   └── NoteCard
│       └── RecentNotesSection
│           └── NoteCard

SubjectView (Screen 2)
├── SidebarNavigation (Same, with topics expanded)
├── SearchBar (Search topics)
└── MainContent
    └── EmptyState (No topic selected)

TopicsView (Screen 3)
├── SidebarNavigation (Topics highlighted)
├── BreadcrumbNav (< Polity > Fundamental Rights)
├── SearchBar (Search notes)
├── NotesHeader (Topic name + New button)
└── NotesList (Infinite scroll)
    └── NoteItem (Each note in list)

GlanceView (Screen 4)
├── Header (Back, Title, Saved badge, Share, Export)
├── BreadcrumbNav
├── InfiniteScrollContent (Full note content)
└── ContentRenderer (Renders all highlights, checklists, etc.)

EditorView (Screen 5)
├── Header
├── RichTextToolbar
├── MainEditorArea
│   ├── EditableContent
│   └── BlockInsertPoints
└── OutlineSidebar
    ├── BlocksList
    └── OutlineView
```

---

# PART 5: DATA FLOW DIAGRAM

```
┌──────────────────────────────────────────────────────────────┐
│                      DATABASE (Supabase)                     │
│                                                              │
│  user_notes table:                                           │
│    - id, title, content (JSON), is_pinned                  │
│    - folder_id, subject_id, created_at, updated_at         │
│                                                              │
│  user_note_nodes table:                                     │
│    - id, title, type (topic/subtopic), parent_id           │
│    - subject_id, user_id, created_at                       │
│                                                              │
└────────────────────────────────────────────────────────────┘
         ↑                              ↓
         │                              │
    [SAVE]                          [FETCH]
         │                              │
         ↑                              ↓
┌──────────────────────────────────────────────────────────────┐
│                   AutoSave Hook (useAutoSave)               │
│                                                              │
│  - Listens to editor changes                                │
│  - Debounces for 2 seconds                                  │
│  - Calls noteService.saveNote()                             │
│  - Updates status badge                                     │
│  - Retries on failure                                       │
└──────────────────────────────────────────────────────────────┘
         ↑                              ↓
         │                              │
    [CHANGE]                       [DISPLAY]
         │                              │
         ↑                              ↓
┌──────────────────────────────────────────────────────────────┐
│                    Component State                           │
│                                                              │
│  EditorView.tsx:                                             │
│    - useState(content)    ← Entire note content            │
│    - useState(saveStatus) ← "saved" | "saving" | "unsaved" │
│    - useAutoSave()        ← Triggers save                  │
│                                                              │
│  Screen 3 (NotesList):                                       │
│    - useState(notes)      ← Array of notes                 │
│    - useState(selectedId) ← Currently selected note        │
│    - useNotes()           ← Fetches from DB                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

# PART 6: IMPLEMENTATION CHECKLIST

## Phase 1: Setup 

- [ ] Create screen components (NotesHome, TopicsView, NotesList, GlanceView, EditorView)
- [ ] Set up routing (expo-router config)
- [ ] Create TypeScript types for Note, Topic, Subject
- [ ] Set up Supabase schema (if not done)
- [ ] Create navigation hooks (useNavigation, useNotes, etc.)

## Phase 2: Layout & Navigation 

- [ ] Build Screen 1 (Home hub with sidebar + cards)
- [ ] Build Screen 2 (Topics list)
- [ ] Build Screen 3 (Notes list with infinite scroll)
- [ ] Implement screen transitions & back buttons
- [ ] Build breadcrumb navigation
- [ ] Test all navigation flows

## Phase 3: Content Display 

- [ ] Build Screen 4 (Glance view - read-only)
- [ ] Implement infinite scroll in glance
- [ ] Render highlights, badges, checklists
- [ ] Build breadcrumb in glance
- [ ] Build header with buttons (Share, Export)

## Phase 4: Editor 

- [ ] Build Screen 5 (Editor view)
- [ ] Create RichTextToolbar component
- [ ] Implement text formatting (H1, H2, B, I, U, bullet, etc.)
- [ ] Build color picker for highlights
- [ ] Create OutlineSidebar (blocks list)
- [ ] Build bottom status bar (word count, font size, etc.)

## Phase 5: Auto-Save 

- [ ] Create useAutoSave hook
- [ ] Implement 2-second debounce timer
- [ ] Connect to noteService.saveNote() API
- [ ] Build AutoSaveIndicator badge ("● Saved" / "● Saving" / "● Unsaved")
- [ ] Handle save errors & retries
- [ ] Test auto-save on all changes

## Phase 6: Polish & Testing 

- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Sidebar collapse/expand on mobile
- [ ] Dark mode support
- [ ] Error handling & loading states
- [ ] Performance optimization (virtualization for long lists)
- [ ] Full QA & bug fixes

---

## END OF COMPLETE BLUEPRINT

You can now give this document directly to Claude AI (or any developer) and they will have:

1. ✅ EXACT button placements (coordinates, sizes, colors)
2. ✅ EXACT screen flows (step-by-step navigation)
3. ✅ EXACT auto-save logic (triggers, debounce, error handling)
4. ✅ Component structure (file organization)
5. ✅ Data flow (database → state → UI)
6. ✅ Implementation checklist (prioritized tasks)

Everything is specified in pixel-perfect detail!
