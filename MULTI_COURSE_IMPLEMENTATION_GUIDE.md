# 🎯 Multi-Course System Implementation Guide

## **What's Being Added:**

Your app will now support multiple courses:
- **UPSC CSE** (current)
- **Medical Science** (new)

Users can switch between them in Settings, and the entire app (Arena, PYQ Analysis, Search) will switch to that course's data.

---

## **Step 1: Run Database Migration** ✅

### **In Supabase Console:**

1. Go to **SQL Editor** in Supabase
2. Copy-paste contents of: `supabase/migrations/20260530_add_course_system.sql`
3. Click **Run**
4. Verify no errors

### **What it does:**
- ✅ Adds `course` column to `questions` table
- ✅ Adds `course` column to `tests` table
- ✅ Creates `courses` reference table with UPSC CSE and Medical Science
- ✅ All existing data defaults to 'UPSC CSE' (backward compatible!)
- ✅ Creates indexes for fast filtering

---

## **Step 2: Frontend Context** ✅ DONE

**Already created:**
- `src/context/CourseContext.tsx` - Manages selected course
- Wrapped in `app/_layout.tsx` - Available globally via `useCourse()` hook

**Can use anywhere:**
```typescript
import { useCourse } from '../src/context/CourseContext';

const MyComponent = () => {
  const { selectedCourse, setSelectedCourse } = useCourse();
  // selectedCourse = 'UPSC CSE' or 'Medical Science'
};
```

---

## **Step 3: Update PYQ Analysis (pyq.tsx)** 🔄 NEXT

Need to:
1. ✅ Import `useCourse()` hook
2. ✅ Get `selectedCourse` from context
3. ✅ Create dynamic EXAM_STAGES based on course:
   - **UPSC CSE:** Prelims, Mains
   - **Medical Science:** INICET, NEET PG, UPSC CMS

4. ✅ Create dynamic PAPERS structure:
   - **UPSC CSE Prelims:** [GS Paper 1, GS Paper 2 (CSAT)]
   - **UPSC CSE Mains:** [GS Paper 1-4, Optional]
   - **Medical INICET:** None (no papers)
   - **Medical NEET PG:** None (no papers)
   - **Medical UPSC CMS:** [Paper 1, Paper 2]

5. ✅ Hide paper selector for stages without papers
6. ✅ Add `.eq('course', selectedCourse)` to Supabase queries

---

## **Step 4: Database Data Seeding**

### **Current State (UPSC CSE):**
All existing questions already have `course = 'UPSC CSE'`

### **When Adding Medical Science:**

**Via Admin Panel, add questions with:**
```json
{
  "question_text": "...",
  "subject": "Anatomy",
  "section_group": "Upper Limb",
  "exam": "UPSC CMS",
  "exam_paper": "Paper 1",
  "exam_year": 2024,
  "course": "Medical Science"
}
```

**Or bulk insert via SQL:**
```sql
UPDATE public.questions 
SET course = 'Medical Science' 
WHERE exam IN ('UPSC CMS', 'NEET PG', 'INICET');
```

---

## **Step 5: Medical Science Stages & Papers Configuration**

### **In pyq.tsx, will add:**

```typescript
const STAGES_BY_COURSE = {
  'UPSC CSE': ['Prelims', 'Mains'],
  'Medical Science': ['INICET', 'NEET PG', 'UPSC CMS']
};

const PAPERS_BY_COURSE_STAGE = {
  'UPSC CSE': {
    Prelims: ['GS Paper 1', 'GS Paper 2 (CSAT)'],
    Mains: ['GS Paper 1', 'GS Paper 2', 'GS Paper 3', 'GS Paper 4', 'Optional']
  },
  'Medical Science': {
    INICET: null,      // No papers
    'NEET PG': null,   // No papers
    'UPSC CMS': ['Paper 1', 'Paper 2']
  }
};
```

---

## **Step 6: Course Selector UI in Settings**

### **Add to Settings:**
```
Settings
├── Theme
├── Offline Storage
└── Course Preference (NEW)
    ├── UPSC CSE ✓ (selected)
    └── Medical Science
```

**When user selects Medical Science:**
- All Arena questions change to Medical
- All PYQ Analysis questions change to Medical
- All Search results change to Medical
- Flashcards STAY THE SAME (shared)

---

## **Summary: What Needs to be Done**

### **Done ✅**
- CourseContext created
- Wrapped in root layout
- Migration SQL file ready

### **TODO 🔄**
1. **Run SQL migration in Supabase** (5 min)
2. **Update pyq.tsx** (1-2 hours)
   - Import useCourse hook
   - Make stages/papers dynamic
   - Hide paper selector when needed
   - Add course filter to queries

3. **Add Course Selector UI** (30 min)
   - In profile/settings
   - Save to context + AsyncStorage

4. **Update other tabs** (2-3 hours)
   - Arena: filter by course
   - Search: filter by course
   - Analyze: filter by course

5. **Update Admin Panel** (1 hour)
   - Course dropdown when uploading questions

---

## **Data Structure Summary**

```
┌─────────────────────────────────────────────────────────┐
│                      User Settings                      │
│  selected_course: "UPSC CSE" or "Medical Science"       │
└──────────────────────┬──────────────────────────────────┘
                       │ useCourse() hook
                       ▼
┌─────────────────────────────────────────────────────────┐
│              PYQ Analysis (pyq.tsx)                      │
│  Stages, Papers, Questions all filtered by course       │
└──────────────────────┬──────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
    ┌────────┐  ┌────────┐  ┌──────────────┐
    │Questions│  │Tests   │  │Flashcards    │
    │course   │  │course  │  │(no filter)   │
    │=UPSC... │  │=UPSC...│  │shared        │
    └────────┘  └────────┘  └──────────────┘
```

---

## **IMPORTANT NOTES:**

⚠️ **Backward Compatibility:**
- All existing UPSC CSE data remains unchanged
- All existing questions default to 'UPSC CSE'
- Existing queries work without modification (can add course filter)

⚠️ **Flashcards:**
- NO course column (intentional)
- Flashcards created in UPSC CSE visible in Medical Science too

⚠️ **User Progress:**
- Question states, test attempts, cards progress are NOT course-specific
- Same question can be tracked across courses

---

## **Next Steps:**

1. **Run the SQL migration** ✅ Get this done first
2. **Tell me:** Ready to update pyq.tsx?
