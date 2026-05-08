#!/bin/bash

# Migration Script: Copy Notes App to Your Repository
# Usage: ./migrate-to-repo.sh /path/to/your/4.0/repo

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if target directory is provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: ./migrate-to-repo.sh /path/to/your/4.0/repo${NC}"
    exit 1
fi

TARGET_DIR="$1"
SOURCE_DIR="$(pwd)"

echo -e "${BLUE}=== Notes App Migration Script ===${NC}\n"

# Verify target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo -e "${YELLOW}Error: Target directory does not exist: $TARGET_DIR${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Target directory found: $TARGET_DIR"
echo -e "${GREEN}✓${NC} Source directory: $SOURCE_DIR\n"

# Create directory structure
echo -e "${BLUE}Creating directory structure...${NC}"
mkdir -p "$TARGET_DIR/src/app/notes/components"
mkdir -p "$TARGET_DIR/src/styles"
mkdir -p "$TARGET_DIR/docs"
echo -e "${GREEN}✓${NC} Directories created\n"

# Copy component files
echo -e "${BLUE}Copying component files...${NC}"

components=(
    "Sidebar.tsx"
    "Dashboard.tsx"
    "EmptyState.tsx"
    "NoteList.tsx"
    "GlanceView.tsx"
    "EditorView.tsx"
)

for component in "${components[@]}"; do
    if [ -f "$SOURCE_DIR/src/app/components/$component" ]; then
        cp "$SOURCE_DIR/src/app/components/$component" "$TARGET_DIR/src/app/notes/components/"
        echo -e "  ${GREEN}✓${NC} Copied $component"
    else
        echo -e "  ${YELLOW}⚠${NC} Not found: $component"
    fi
done

# Copy and rename main App file
if [ -f "$SOURCE_DIR/src/app/App.tsx" ]; then
    cp "$SOURCE_DIR/src/app/App.tsx" "$TARGET_DIR/src/app/notes/NotesApp.tsx"
    echo -e "  ${GREEN}✓${NC} Copied App.tsx → NotesApp.tsx"

    # Update export in NotesApp.tsx
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' 's/export default function App/export function NotesApp/g' "$TARGET_DIR/src/app/notes/NotesApp.tsx"
    else
        # Linux
        sed -i 's/export default function App/export function NotesApp/g' "$TARGET_DIR/src/app/notes/NotesApp.tsx"
    fi
    echo -e "  ${GREEN}✓${NC} Updated export to NotesApp"
else
    echo -e "  ${YELLOW}⚠${NC} Not found: App.tsx"
fi

echo ""

# Copy styles
echo -e "${BLUE}Copying styles...${NC}"
if [ -f "$SOURCE_DIR/src/styles/theme.css" ]; then
    cp "$SOURCE_DIR/src/styles/theme.css" "$TARGET_DIR/src/styles/notes-theme.css"
    echo -e "  ${GREEN}✓${NC} Copied theme.css → notes-theme.css"
else
    echo -e "  ${YELLOW}⚠${NC} Not found: theme.css"
fi
echo ""

# Copy documentation
echo -e "${BLUE}Copying documentation...${NC}"
if [ -f "$SOURCE_DIR/guidelines/complete-design-specification.md" ]; then
    cp "$SOURCE_DIR/guidelines/complete-design-specification.md" "$TARGET_DIR/docs/notes-app-specification.md"
    echo -e "  ${GREEN}✓${NC} Copied complete-design-specification.md"
fi

if [ -f "$SOURCE_DIR/guidelines/INTEGRATION_GUIDE.md" ]; then
    cp "$SOURCE_DIR/guidelines/INTEGRATION_GUIDE.md" "$TARGET_DIR/docs/notes-integration-guide.md"
    echo -e "  ${GREEN}✓${NC} Copied INTEGRATION_GUIDE.md"
fi
echo ""

# Create integration example file
echo -e "${BLUE}Creating integration example...${NC}"
cat > "$TARGET_DIR/src/app/notes/README.md" << 'EOF'
# Notes App

## Quick Start

### Import the NotesApp component

```typescript
import { NotesApp } from './notes/NotesApp';
```

### Add as a route (React Router)

```typescript
<Route path="/notes" element={<NotesApp />} />
```

### Add as a tab (Radix Tabs)

```typescript
<TabsContent value="notes">
  <NotesApp />
</TabsContent>
```

## Required Dependencies

```bash
pnpm add lucide-react @radix-ui/react-accordion
```

## Documentation

- Full Specification: `/docs/notes-app-specification.md`
- Integration Guide: `/docs/notes-integration-guide.md`

## Features

- 7-screen navigation system
- Subject-based organization
- Rich text editor with highlighting
- Document outline view
- Infinite scroll reading mode
EOF

echo -e "  ${GREEN}✓${NC} Created README.md in notes directory\n"

# Check for package.json and suggest dependencies
echo -e "${BLUE}Checking dependencies...${NC}"
if [ -f "$TARGET_DIR/package.json" ]; then
    # Check if lucide-react is installed
    if grep -q "lucide-react" "$TARGET_DIR/package.json"; then
        echo -e "  ${GREEN}✓${NC} lucide-react is installed"
    else
        echo -e "  ${YELLOW}!${NC} Need to install: lucide-react"
    fi

    # Check if @radix-ui/react-accordion is installed
    if grep -q "@radix-ui/react-accordion" "$TARGET_DIR/package.json"; then
        echo -e "  ${GREEN}✓${NC} @radix-ui/react-accordion is installed"
    else
        echo -e "  ${YELLOW}!${NC} Need to install: @radix-ui/react-accordion"
    fi
else
    echo -e "  ${YELLOW}⚠${NC} package.json not found in target directory"
fi
echo ""

# Summary
echo -e "${GREEN}=== Migration Complete! ===${NC}\n"

echo -e "${BLUE}Files copied to:${NC}"
echo -e "  Components: $TARGET_DIR/src/app/notes/components/"
echo -e "  Main App:   $TARGET_DIR/src/app/notes/NotesApp.tsx"
echo -e "  Styles:     $TARGET_DIR/src/styles/notes-theme.css"
echo -e "  Docs:       $TARGET_DIR/docs/\n"

echo -e "${BLUE}Next Steps:${NC}"
echo -e "  1. cd $TARGET_DIR"
echo -e "  2. pnpm add lucide-react @radix-ui/react-accordion"
echo -e "  3. Add NotesApp to your routes/tabs (see integration guide)"
echo -e "  4. Import notes-theme.css in your main CSS file"
echo -e "  5. Test all 7 screen states\n"

echo -e "${BLUE}Documentation:${NC}"
echo -e "  Integration Guide: $TARGET_DIR/docs/notes-integration-guide.md"
echo -e "  Full Specification: $TARGET_DIR/docs/notes-app-specification.md\n"

echo -e "${GREEN}🎉 Ready to integrate!${NC}\n"
