# Forum MGP Test Series PDF → MD Extraction Plan

## Overview

This plan describes how to extract content from **Forum MGP test series PDFs** (like `Forum MGP CSM26T01SE Examstatic.com.pdf`) into clean Markdown files that mirror the format of our existing GS1 consolidated answers file. JSON conversion is done separately as a later step — this plan focuses on generating the MD file only.

---

## 1. PDF Structure Analysis (Forum MGP)

### 1.1 General Layout (10-page document)
- **Page 1**: Cover page — `MGP 2026`, `Test Code : 912201`, instructions to students
- **Pages 2–10**: Answer booklet with Q&A

### 1.2 Junk Content to Strip (Header/Footer/Watermark)

**Junk header on EVERY page (pages 2–10)** — a block of ~3 lines appearing at the top:
```
Forum Learning Centre: Delhi - 2nd Floor, IAPL House, 19 Pusa Road, Karol Bagh, New Delhi - 110005   | Patna - 2nd floor, AG Palace, E Boring Canal
Road, Patna, Bihar 800001   | Hyderabad - 1st & 2nd Floor, SM Plaza, RTC X Rd, Indira Park Road, Jawahar Nagar, Hyderabad, Telangana 500020
9311740400, 9311740900 | https://academy.forumias.com | admissions@forumias.academy | helpdesk@forumias.academy
```
**Detection**: Contains `Forum Learning Centre`, phone numbers, email, URL.

**Junk footer on EVERY page (pages 2–10)** — `Page X of 9` at bottom.
**Detection**: Matches pattern `Page \d+ of \d+`.

**Page 1 cover junk**: `MGP 2026`, `Test Code : XXXXX`, instruction paragraphs, the same header block.

**Image watermark**: ~2 images per page — one is the MGP logo (top-left) and one decorative (bottom). They appear as `IMAGE block` in PyMuPDF — skip them entirely during MD extraction.

### 1.3 Question Block Structure

Each question follows exactly this pattern:

```
Q.<number>) <question text>?

Approach: <approach text>
```

**Important**: Some questions are missing the `Q.` prefix — e.g., `09)` instead of `Q.09)` on page 8. The parser must handle both `Q.\d+\)` and `\d+\)` patterns.

### 1.4 Answer Block Structure

After the **Approach:** line, the answer body begins:

- Regular paragraph text (plain text)
- Numbered lists: `1.`, `2.`, `3.` (each on its own line with proper newlines)
- **Alphabetical sub-lists inside numbered items** — the critical formatting point:
  - PDF has: `1. a) text; b) text; c) text` (all on ONE line in the PDF)
  - **REQUIRED OUTPUT**: Each alphabetical sub-item on a SEPARATE line, **indented/offset to the RIGHT** so it visually appears as a sub-bullet beneath the numbered item:
    ```
    1.
       a) text
       b) text
       c) text
    2.
       a) text
       b) text
    ```
  - Use **3 spaces** of indentation before `a)`, `b)`, `c)` to create clear sub-bullet positioning
  - Some use `(a)` instead of `a)`, handle both
  - Some have nested `i)`, `ii)` etc. inside alphabetical lists — indent those another **3 spaces** (6 total):
    ```
    1.
       a) Main sub-point
          i) Sub-sub-point
          ii) Another sub-sub-point
       b) Next sub-point
    ```

- **Bold text**: Preserved as `**bold**`
- **Italic text**: Preserved as `*italic*`
- **Word count**: At end of some answers like `(306 words)` — preserve as-is
- **Paragraph breaks**: Preserve all blank lines between paragraphs
- **Tables**: Present in some answers (like comparative tables with `|` columns) — preserve as Markdown tables
- **Images**: Forum MGP PDFs typically don't contain answer diagrams (unlike Civilsdaily answers). If present, extract as `<p align="center"><img src="..." alt="..." /></p>`

### 1.5 Word Count Boundary

Each answer ends with `(XXX words)` or `(XXX words) \n\n` followed by the next question or page break. This is the **answer boundary marker**.

---

## 2. Extraction Algorithm (Step-by-Step)

### Phase 1: PDF Text Extraction

```python
import fitz  # PyMuPDF
doc = fitz.open(pdf_path)

all_text = []
for page_num in range(doc.page_count):
    page = doc[page_num]
    text = page.get_text()
    all_text.append(text)

full_text = "\n".join(all_text)
```

### Phase 2: Clean Junk Content

Apply these filters in order on the full extracted text:

1. **Remove page 1 completely** (cover page) — everything before the first `Q.\d+\)` or `\d+\)` pattern, OR everything before `Q.1)` specifically.

2. **Remove header block** on every page — match and remove lines containing `Forum Learning Centre:` pattern. Use regex:
   ```
   ^Forum Learning Centre:.*helpdesk@forumias\.academy\s*$
   ```
   (This matches the 3-line header as one multi-line pattern since it wraps in extraction)

3. **Remove footer** — remove lines matching `Page \d+ of \d+`.

4. **Remove trailing whitespace lines** from each page.

### Phase 3: Split into Questions

Split the cleaned text using regex pattern:

```
(Q\.\d+\)|\b\d{1,2}\)\s+(?=[A-Z]))
```

This handles both `Q.1)` and `09)` style question numbers.

Each question block contains:
- Question text (first line until `Approach:`)
- Approach text (line after `Approach:` until blank line)
- Answer body (everything after the approach line until `(XXX words)` marker or next question)

### Phase 4: Transform Each Question into MD Block

**Target format** (mirroring existing MD file):

```markdown
## Q<N> [Year: 2026]
**Question:** <question text>
*Metadata: [Year: 2026] [Institute: Forum] [Programme: MGP] [is_pyq: false] [Group: UPSC CSE] [Exam: Mains] [Stage: Mains] [Paper: Mains - GS 1]*
#### Answer from ForumIAS

<answer body with approach block>

[Question ID: forum-mgp-2026-gs1-q<num>]

---

```

**Key transformations on the answer body:**

1. **Extract Approach**: The line(s) after `Approach:` up to the first blank line.
   - Wrap in a table like the existing MD file:
     ```markdown
     | **Approach:** <br>• Point 1 <br>• Point 2 |
     | --- |
     ```
   - Split approach sentences at periods or bullet points, prefix each with `•` and join with `<br>`.

2. **Transform numbered lists with alphabetical sub-items**:
   - Find pattern: `\d+\.\s+(a\)|\(a\)|i\)|\(i\))`
   - For each numbered item, split the content into separate lines:
     - Keep the number `N.` on its own line
     - Pull the alphabetical sub-items (a), b), c) etc.) onto their own lines with **3-space indent**
     - If sub-items contain `i)`, `ii)` — further split those as sub-sub-items with **6-space indent**
   
   **Example transformation**:
   ```
   Before: 1. a) Structure of federal polity; b) financial relations; c) inter-state cooperation.
   After:
   1.
      a) Structure of federal polity
      b) financial relations
      c) inter-state cooperation
   ```

3. **Preserve all other formatting**: Bold `**text**`, italics `*text*`, tables `| col1 | col2 |`, images `<img>`, paragraph breaks (blank lines).

4. **Add question separator**: `---` between each question-answer block.

### Phase 5: Generate Metadata

**Year**: Always `2026` (from test code / cover page `MGP 2026`).

**Marks**: Do NOT fill marks if not given in the PDF. The Forum MGP PDF does NOT specify marks per question. Omit the `[Marks: XX]` field entirely.

**Additional metadata fields**:
- `Institute: Forum`
- `Programme: MGP`
- `is_pyq: false`

**Question ID format**: `forum-mgp-2026-gs1-q<num>`

Auto-generated metadata line:
```markdown
*Metadata: [Year: 2026] [Institute: Forum] [Programme: MGP] [is_pyq: false] [Group: UPSC CSE] [Exam: Mains] [Stage: Mains] [Paper: Mains - GS 1]*
```

The `[Paper: Mains - GS 1]` is derived from test code prefix `CSM` (Civil Services Mains General Studies). If a different test code appears, adjust accordingly (e.g., `CSAT` → `Paper: CSAT`).

---

## 3. Complete Python Implementation Script

Here's the full extraction script. Save this as `extract_forum_mgp.py` and run it.

```python
"""
Forum MGP Test Series PDF → Markdown Extractor
Extracts questions, approaches, and answers from ForumIAS MGP PDFs into clean MD files.
Output mirrors the format of GS1 question with multiple answers.md

Usage: python extract_forum_mgp.py <pdf_path> [output_md_path]
"""

import fitz  # pymupdf
import re
import sys
import os


def extract_forum_mgp(pdf_path, output_md_path=None):
    """Extract Forum MGP PDF to MD file."""
    
    if output_md_path is None:
        base = os.path.splitext(os.path.basename(pdf_path))[0]
        output_md_path = base + ".md"
    
    # Phase 1: Extract raw text from all pages
    doc = fitz.open(pdf_path)
    full_text = ""
    for page_num in range(doc.page_count):
        page = doc[page_num]
        text = page.get_text()
        full_text += text + "\n"
    doc.close()
    
    # Phase 2: Clean junk content
    text = remove_cover_page(full_text)
    text = remove_header_footer(text)
    text = clean_whitespace(text)
    
    # Phase 3: Split into individual questions
    questions = split_into_questions(text)
    
    # Phase 4: Build MD content
    md_content = generate_md_header()
    for q_data in questions:
        md_content += format_question(q_data)
    
    # Phase 5: Write output file
    with open(output_md_path, 'w', encoding='utf-8') as f:
        f.write(md_content)
    
    print(f"✅ Extracted {len(questions)} questions to {output_md_path}")
    return output_md_path


def remove_cover_page(text):
    """Remove everything before the first question (cover page)."""
    # Try Q.1) pattern first, then standalone 1)
    match = re.search(r'(?:Q\.\s*)?1\s*\)\s+', text)
    if match:
        return text[match.start():]
    return text


def remove_header_footer(text):
    """Remove Forum Learning Centre header block and Page X of Y footer."""
    # Remove the multi-line header block (Forum address, phone, email, URL)
    text = re.sub(
        r'Forum Learning Centre:.*?(?:helpdesk@forumias\.academy|9311740900).*?(?:\n|$)',
        '',
        text,
        flags=re.DOTALL
    )
    # Remove page number footers
    text = re.sub(r'Page \d+ of \d+\s*\n?', '', text)
    return text


def clean_whitespace(text):
    """Collapse multiple blank lines into one, strip leading/trailing whitespace per line."""
    lines = text.split('\n')
    result = []
    prev_blank = False
    for line in lines:
        stripped = line.strip()
        if stripped == '':
            if not prev_blank:
                result.append('')
            prev_blank = True
        else:
            result.append(line)
            prev_blank = False
    return '\n'.join(result).strip()


def split_into_questions(text):
    """Split cleaned text into individual question blocks."""
    # Pattern matches Q.1) or Q.1) or standalone 1) or 09) at start of a line
    pattern = r'(?:(?:Q\.)\s*)?(\d{1,2})\)\s+'
    splits = re.split(pattern, text)
    
    questions = []
    # splits format: [before, num1, content1, num2, content2, ...]
    for i in range(1, len(splits) - 1, 2):
        q_num = splits[i]
        q_content = splits[i + 1].strip()
        if q_content:
            questions.append({
                'number': q_num,
                'content': q_content
            })
    
    return questions


def format_question(q_data):
    """Format a single question into an MD block."""
    
    content = q_data['content']
    lines = content.split('\n')
    
    # First non-empty line is the question text
    question_text = ""
    for line in lines:
        stripped = line.strip()
        if stripped:
            question_text = stripped
            break
    
    # Parse approach and answer body
    approach_text = ""
    answer_lines = []
    mode = 'question'  # 'question' → 'approach' → 'answer'
    
    for line in lines:
        stripped = line.strip()
        
        # Detect approach line
        if stripped.lower().startswith('approach:'):
            approach_text = stripped[len('approach:'):].strip()
            mode = 'approach'
            continue
        
        # Detect end of approach (blank line after approach text)
        if mode == 'approach' and stripped == '':
            mode = 'answer'
            continue
        
        # Handle multi-line approach (some approaches span multiple lines before blank line)
        if mode == 'approach' and stripped:
            if approach_text:
                approach_text += ' ' + stripped
            else:
                approach_text = stripped
            continue
        
        # In answer mode, collect all lines
        if mode == 'answer':
            answer_lines.append(line)
    
    answer_body = '\n'.join(answer_lines).strip()
    
    # Transform the answer formatting
    answer_body = transform_answer(answer_body)
    
    # Format approach as a table with bullet points
    approach_md = format_approach(approach_text)
    
    # Build the complete MD block
    md = f"## Q{q_data['number']} [Year: 2026]\n"
    md += f"**Question:** {question_text}\n"
    md += "*Metadata: [Year: 2026] [Institute: Forum] [Programme: MGP] [is_pyq: false] [Group: UPSC CSE] [Exam: Mains] [Stage: Mains] [Paper: Mains - GS 1]*\n"
    md += "#### Answer from ForumIAS\n\n"
    md += approach_md + "\n\n"
    md += answer_body + "\n\n"
    md += f"[Question ID: forum-mgp-2026-gs1-q{q_data['number']}]\n\n"
    md += "---\n\n"
    
    return md


def format_approach(approach_text):
    """Format approach text as a markdown table with bullet points joined by <br>."""
    if not approach_text:
        return "| **Approach:** |\n| --- |"
    
    # Split approach into logical points (split at periods or bullet-like separators)
    # First try splitting by numbered/lettered points, else by sentences
    points = []
    
    # Try splitting at "1. ", "2. " or "•" patterns
    parts = re.split(r'(?:\d+\.\s*|•\s*)', approach_text)
    parts = [p.strip() for p in parts if p.strip()]
    
    if len(parts) <= 1:
        # Fallback: split by sentences
        parts = [p.strip() + '.' for p in approach_text.split('.') if p.strip()]
    
    for p in parts:
        p = p.strip()
        if p and not p.endswith('.'):
            p += '.'
        if p:
            points.append(p)
    
    if not points:
        points = [approach_text]
    
    bullets = ' <br>'.join([f'• {p}' for p in points])
    return f"| **Approach:** {bullets} |\n| --- |"


def transform_answer(answer_text):
    """
    Transform answer formatting to match our MD convention:
    
    1. Break `1. a) ... b) ... c) ...` into separate lines
       - Number `N.` on its own line
       - Each alphabetical sub-item on its own line with 3-space indent
    2. Handle nested i) ii) iii) with 6-space indent
    3. Preserve all other formatting (bold, italics, tables, images)
    """
    if not answer_text:
        return ""
    
    text = answer_text
    
    # Step 1: Separate the number from the first alphabetical sub-item
    # Pattern: "N. a)" or "N. (a)" or "N. i)" at start
    text = re.sub(
        r'^(\d+\.)\s+([a-z]\)|\([a-z]\)|[ivx]+\))',
        r'\1\n   \2',
        text,
        flags=re.MULTILINE
    )
    
    # Step 2: Break remaining alphabetical sub-items on the same line
    # Pattern: "; b)" or ". b)" or "; c)" etc. (semicolon or period followed by letter)
    text = re.sub(
        r'([;.])\s+([a-z]\)|\([a-z]\))\s+',
        r'\1\n   \2 ',
        text
    )
    
    # Step 3: Handle trailing alphabetical sub-items at end of line
    text = re.sub(
        r'([;.])\s+([a-z]\)|\([a-z]\))([^a-z)]*)$',
        r'\1\n   \2\3',
        text,
        flags=re.MULTILINE
    )
    
    # Step 4: Handle nested i) ii) iii) iv) inside alphabetical items
    text = re.sub(
        r'([;.])\s+(i\)|ii\)|iii\)|iv\)|v\))\s+',
        r'\1\n      \2 ',
        text
    )
    
    # Step 5: Handle cases where a) has no preceding semicolon (after a space after number)
    text = re.sub(
        r'(\d+\.)\s+',
        r'\1\n',
        text
    )
    
    # Clean up: remove empty numbered lines (where number had no content after it)
    # and fix double newlines
    text = re.sub(r'(\d+\.)\s*\n\s*\n', r'\1\n', text)
    
    return text.strip()


def generate_md_header():
    """Generate the markdown file header."""
    return (
        "# Forum MGP Test Series - Model Answers\n"
        "*Questions and answers extracted from ForumIAS MGP test solution booklet. "
        "Formatted for app consumption.*\n"
        "---\n\n"
    )


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python extract_forum_mgp.py <path_to_pdf> [output_md_path]")
        print("Example: python extract_forum_mgp.py \"Forum MGP CSM26T01SE Examstatic.com.pdf\"")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None
    extract_forum_mgp(pdf_path, output_path)
```

---

## 4. Summary of Formatting Rules

| Element | PDF Source | MD Output |
|---------|-----------|-----------|
| **Question** | `Q.1) text?` or `1) text?` | `## Q1 [Year: 2026]` then `**Question:** text?` |
| **Metadata** | Not in PDF (derived) | `*Metadata: [Year: 2026] [Institute: Forum] [Programme: MGP] [is_pyq: false] ...*` |
| **Approach** | `Approach: text.` | `\| **Approach:** • text \|\n\| --- \|` (bullet points with `<br>`) |
| **Numbered list** | `1. item\n2. item` | Same — preserve as `1. item\n2. item` |
| **Alphabetical sub-list** | `1. a) text; b) text` (inline) | `1.\n   a) text\n   b) text` (3-space indent, each on separate line) |
| **Nested (i)(ii)** | `a) i) ... ii) ...` | `   a) ...\n      i) ...\n      ii) ...` (6-space indent) |
| **Bold** | Bold text in PDF | `**bold text**` |
| **Italic** | Italic text in PDF | `*italic text*` |
| **Tables** | Tabular data | Markdown `\| col1 \| col2 \|` |
| **Images** | Image blocks | `<p align="center"><img src="..." alt="..." /></p>` |
| **Word count** | `(306 words)` | Preserve as-is |
| **Marks** | Not specified in PDF | **OMIT** — do not add `[Marks: XX]` |
| **Header** | `Forum Learning Centre: ...` | **REMOVE** |
| **Footer** | `Page X of Y` | **REMOVE** |
| **Cover page** | MGP, Test Code, instructions | **REMOVE** |
| **Question separator** | Page break | `---` |

---

## 5. Regex Pattern Reference

```python
import re

# 1. Detect question start
Q_PATTERN = r'(?:Q\.\s*)?(\d+)\)\s+'

# 2. Detect approach line
APPROACH_PATTERN = r'^Approach:\s*(.*?)$'

# 3. Detect alphabetical sub-items inside numbered lists
ALPHA_SUB_PATTERN = r'(\d+\.)\s+((?:[a-z]\)|\([a-z]\))(?:\s*;\s*[a-z]\)[^;]*)*)'

# 4. Detect header junk
HEADER_PATTERN = r'Forum Learning Centre:.*?(?:helpdesk@forumias\.academy|9311740900).*?(?:\n|$)'

# 5. Detect footer junk
FOOTER_PATTERN = r'Page \d+ of \d+\s*'

# 6. Detect word count
WORD_COUNT_PATTERN = r'\(\d+\s*words\)'

# 7. Split alphabeticals on same line
SPLIT_ALPHA_PATTERN = r'(?<=[;.])\s*(?=[a-z]\)|\([a-z]\))'
```

---

## 6. Edge Cases & Notes

1. **Missing `Q.` prefix**: Some questions start with just `09)` instead of `Q.09)`. Handle with `\d+\)` pattern. The regex `(?:(?:Q\.)\s*)?(\d{1,2})\)\s+` handles both.

2. **Multi-line Approach**: Some approach text spans multiple lines before a blank line. Treat all lines between `Approach:` and next blank line as approach text (concatenate them with space).

3. **Answer continues across pages**: The text extraction concatenates pages — after headers/footers are removed, text flows naturally across page boundaries. No special handling needed.

4. **No marks in PDF**: Forum MGP PDFs don't specify marks per question. **DO NOT add any `[Marks: XX]` field.** Simply omit it from the metadata line.

5. **No subject taxonomy**: Unlike the existing MD file's rich metadata (Subject, Section Group, Microtopic, Subtopic), Forum PDFs lack these. Do NOT generate them. Use only the fixed metadata fields specified:
   - `Year: 2026` (from `MGP 2026` on cover)
   - `Institute: Forum`
   - `Programme: MGP`
   - `is_pyq: false`

6. **Multiple choice vs descriptive**: All Forum MGP questions are descriptive/essay-type. No MCQs.

7. **Images in answers**: Forum MGP PDFs typically don't contain answer diagrams. If present, extract as `<p align="center"><img src="..." alt="..." /></p>` with a base64 data URI or a local reference.

8. **Alphabetical formats**: The PDF uses both `a)` and `(a)` styles. Handle both. Also handle:
   - `i)`, `ii)`, `iii)`, `iv)` inside sub-items
   - Items separated by semicolons `;` as well as periods `.`
   - Items that are NOT separated by any delimiter but just spaces

9. **Word count at answer end**: Always appears as `(XXX words)` or `(XXX words) \n` before the next question. This marks the answer boundary. Keep it in the output.

10. **Test code identification**: Extract the test code from the cover page (e.g., `912201`) for filename organization but not for the MD content metadata.

11. **JSON conversion is separate**: This plan only covers PDF → MD extraction. JSON conversion will be handled as a separate step later.
6. **Preserve indentation**: For nested lists, use 2-space indentation for sub-sub-items.
7. **Tables in answers**: If the PDF has actual table structures (not just multi-column text), PyMuPDF's `get_text("table")` or `get_text("html")` may be needed for proper extraction.
