# Forum MGP Test Series PDF → MD → JSON Extraction Plan

## Overview

This plan describes how to extract content from **Forum MGP test series PDFs** (like `Forum MGP CSM26T01SE Examstatic.com.pdf`) into clean Markdown files that mirror the format of our existing GS1 consolidated answers file, and then into JSON for the app.

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
  - **REQUIRED OUTPUT**: Each alphabetical sub-item on a SEPARATE line:
    ```
    1. 
    a) text
    b) text
    c) text
    2. 
    a) text
    ```
  - Some use `(a)` instead of `a)`, handle both
  - Some have nested `i)`, `ii)` etc. inside alphabetical lists

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
## Q<N> [Year: YYYY] [Marks: XX]
**Question:** <question text>
*Metadata: [Year: YYYY] [Marks: XX] [Group: UPSC CSE] [Exam: Mains] [Stage: Mains] [Paper: Mains - GS 1] [Subject: ...]*
#### Answer from ForumIAS

<answer body with approach block>

[Question ID: <test_code>-q<num>-forumias]

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
     - Pull the alphabetical sub-items (a), b), c) etc.) onto their own indented lines
     - If sub-items contain `i)`, `ii)` — further split those as sub-sub-items
   
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

Forum MGP PDF has subject info in the test code. Convention:
- `CSM` = GS Mains (General Studies)
- Code numbers indicate paper (26 = year/paper code, T01 = test 01, SE = sectional/solution)

Auto-generate metadata:
```markdown
*Metadata: [Year: 2026] [Marks: 10/15] [Group: UPSC CSE] [Exam: Mains] [Stage: Mains] [Paper: Mains - GS 1]*
```
(Year/marks need manual filling since PDF doesn't specify marks for each question.)

### Phase 6: JSON Conversion (Later Step)

The MD can be parsed into JSON with this structure:

```json
{
  "questions": [
    {
      "id": "2026-gs1-q1-forumias",
      "year": 2026,
      "marks": 10,
      "question": "Question text...",
      "metadata": {
        "subject": "...",
        "section_group": "...",
        "microtopic": "..."
      },
      "answers": [
        {
          "source": "ForumIAS",
          "approach": "Approach text...",
          "body": "Full answer body in markdown...",
          "word_count": 306
        }
      ]
    }
  ]
}
```

---

## 3. Python Implementation Script

Here's the extraction script skeleton:

```python
import fitz  # pymupdf
import re
import os

def extract_forum_mgp(pdf_path, output_md_path):
    """Extract Forum MGP PDF to MD file."""
    
    # Phase 1: Extract raw text
    doc = fitz.open(pdf_path)
    full_text = ""
    for page_num in range(doc.page_count):
        page = doc[page_num]
        text = page.get_text()
        full_text += text + "\n"
    doc.close()
    
    # Phase 2: Clean junk
    text = remove_cover_page(full_text)
    text = remove_header_footer(text)
    text = clean_whitespace(text)
    
    # Phase 3: Split into questions
    questions = split_into_questions(text)
    
    # Phase 4: Build MD content
    md_content = generate_md_header()
    for i, q_data in enumerate(questions):
        md_content += format_question(q_data, i+1)
    
    # Phase 5: Write output
    with open(output_md_path, 'w', encoding='utf-8') as f:
        f.write(md_content)
    
    print(f"Extracted {len(questions)} questions to {output_md_path}")


def remove_cover_page(text):
    """Remove everything before the first Q.1) or 1) pattern."""
    match = re.search(r'(?:Q\.\s*)?1\s*\).*', text)
    if match:
        return text[match.start():]
    return text


def remove_header_footer(text):
    """Remove Forum Learning Centre header and Page X of Y footer."""
    # Remove header block
    text = re.sub(
        r'Forum Learning Centre:.*?(?:helpdesk@forumias\.academy|9311740900).*?(?:\n|$)',
        '',
        text,
        flags=re.DOTALL
    )
    # Remove page numbers
    text = re.sub(r'Page \d+ of \d+\s*\n?', '', text)
    return text


def split_into_questions(text):
    """Split cleaned text into individual question blocks."""
    # Pattern matches Q.\d+) or standalone \d+) at start of line
    pattern = r'(?:Q\.\s*)?(\d{1,2})\)\s+'
    splits = re.split(pattern, text)
    
    questions = []
    for i in range(1, len(splits)-1, 2):
        q_num = splits[i]
        q_content = splits[i+1]
        
        # Extract question text, approach, and answer body
        # ... (detailed parsing logic)
        
        questions.append({
            'number': q_num,
            'content': q_content
        })
    
    return questions


def format_question(q_data, seq_num):
    """Format a single question into MD block."""
    
    lines = q_data['content'].strip().split('\n')
    
    # First line is the question text
    question_text = lines[0].strip()
    
    # Find Approach: line
    approach_text = ""
    answer_lines = []
    in_approach = False
    in_answer = False
    
    for line in lines[1:]:
        stripped = line.strip()
        if stripped.startswith('Approach:'):
            approach_text = stripped.replace('Approach:', '').strip()
            in_approach = True
            continue
        if in_approach and stripped == '':
            in_approach = False
            in_answer = True
            continue
        if in_answer:
            answer_lines.append(line)
    
    # Transform answer: handle alphabetical sub-items
    answer_body = transform_answer('\n'.join(answer_lines))
    
    # Build MD block
    md = f"## Q{q_data['number']} [Year: 2026] [Marks: 10]\n"
    md += f"**Question:** {question_text}\n"
    md += f"*Metadata: [Year: 2026] [Marks: 10] [Group: UPSC CSE] [Exam: Mains] [Stage: Mains] [Paper: Mains - GS 1]*\n"
    md += "#### Answer from ForumIAS\n\n"
    
    # Approach as table
    approach_bullets = ' <br>'.join([f'• {p.strip()}' for p in approach_text.split('.') if p.strip()])
    md += f"| **Approach:** {approach_bullets} |\n| --- |\n\n"
    
    # Answer body
    md += answer_body + "\n\n"
    
    md += f"[Question ID: 2026-gs1-q{q_data['number']}-forumias]\n\n"
    md += "---\n\n"
    
    return md


def transform_answer(answer_text):
    """
    Transform answer formatting:
    - Break `1. a) ... b) ... c) ...` into separate lines per sub-item
    - Handle nested i), ii), iii)
    - Preserve all other formatting
    """
    # Pattern 1: "N. a) ... b) ... c) ..."
    # Break at each alphabetical marker
    text = re.sub(
        r'(\d+\.)\s+([a-z]\)|\([a-z]\))',
        r'\1\n\2',
        answer_text
    )
    
    # Pattern 2: Within a line, break at remaining a) b) c) that are on same line
    text = re.sub(
        r'([;.])\s*([a-z]\)|\([a-z]\))\s+',
        r'\1\n\2 ',
        text
    )
    
    # Pattern 3: Handle nested i) ii) iii)
    text = re.sub(
        r'([;.])\s*(i\)|ii\)|iii\)|iv\))\s+',
        r'\1\n  \2 ',
        text
    )
    
    return text.strip()


if __name__ == '__main__':
    extract_forum_mgp(
        r'C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Forum MGP CSM26T01SE Examstatic.com.pdf',
        r'forum_mgp_extracted.md'
    )
```

---

## 4. Summary of Formatting Rules

| Element | PDF Source | MD Output |
|---------|-----------|-----------|
| **Question** | `Q.1) text?` or `1) text?` | `## Q1 [Year: 2026] [Marks: 10]` then `**Question:** text?` |
| **Approach** | `Approach: text.` | `| **Approach:** • text |\n| --- |` (bullet points with `<br>`) |
| **Numbered list** | `1. item\n2. item` | Same — preserve as `1. item\n2. item` |
| **Alphabetical sub-list** | `1. a) text; b) text` (inline) | `1.\na) text\nb) text` (each on separate line) |
| **Nested (i)(ii)** | `a) i) ... ii) ...` | `a) ...\n  i) ...\n  ii) ...` |
| **Bold** | Bold text in PDF | `**bold text**` |
| **Italic** | Italic text in PDF | `*italic text*` |
| **Tables** | Tabular data | Markdown `\| col1 \| col2 \|` |
| **Images** | Image blocks | `<p align="center"><img src="..." alt="..." /></p>` |
| **Word count** | `(306 words)` | Preserve as-is |
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

1. **Missing `Q.` prefix**: Some questions start with just `09)` instead of `Q.09)`. Handle with `\d+\)` pattern.
2. **Multi-line Approach**: Some approach text spans multiple lines before a blank line. Treat all lines between `Approach:` and next blank line as approach text.
3. **Answer continues across pages**: The text extraction concatenates pages — headers/footers removed, text flows naturally.
4. **No marks in PDF**: Forum MGP PDFs don't specify marks per question. Use default `[Marks: 10]` or allow manual entry.
5. **No subject taxonomy**: Unlike the existing MD file's rich metadata, Forum PDFs lack subject/section/microtopic. You can either:
   a) Leave metadata sparse
   b) Use a lookup table based on test code (`CSM26` = GS1 Polity/Governance)
6. **Preserve indentation**: For nested lists, use 2-space indentation for sub-sub-items.
7. **Tables in answers**: If the PDF has actual table structures (not just multi-column text), PyMuPDF's `get_text("table")` or `get_text("html")` may be needed for proper extraction.
