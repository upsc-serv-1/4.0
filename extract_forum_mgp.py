"""
Forum MGP Test Series PDF → Markdown Extractor
Extracts questions, approaches, and answers from ForumIAS MGP PDFs into clean MD files.
Supports font style formatting (bold, italic) from PDF.

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
    
    # Phase 1: Extract formatted text from all pages
    doc = fitz.open(pdf_path)
    full_text = ""
    for page_num in range(doc.page_count):
        page = doc[page_num]
        
        # Extract all spans with coordinates
        spans = []
        blocks = page.get_text("dict")["blocks"]
        for b in blocks:
            if "lines" not in b:
                continue
            for line in b["lines"]:
                for span in line["spans"]:
                    y = (span["bbox"][1] + span["bbox"][3]) / 2
                    spans.append({
                        "text": span["text"],
                        "font": span["font"].lower(),
                        "flags": span["flags"],
                        "size": span["size"],
                        "bbox": span["bbox"],
                        "y": y
                    })
                    
        if not spans:
            continue
            
        # Sort spans by y coordinate first
        spans.sort(key=lambda s: s["y"])
        
        # Group spans into lines
        lines = []
        current_line = []
        current_y = spans[0]["y"]
        
        for s in spans:
            if abs(s["y"] - current_y) > 3:  # New line
                current_line.sort(key=lambda s: s["bbox"][0])
                lines.append(current_line)
                current_line = [s]
                current_y = s["y"]
            else:
                current_line.append(s)
                
        current_line.sort(key=lambda s: s["bbox"][0])
        lines.append(current_line)
        
        # Build text lines with formatting
        line_texts = []
        line_ys = []
        line_sizes = []
        line_xs = []
        
        for line in lines:
            line_text = ""
            line_y = sum(s["y"] for s in line) / len(line)
            max_size = max(s["size"] for s in line)
            line_x0 = min(s["bbox"][0] for s in line)
            
            for span in line:
                span_text = span["text"]
                font = span["font"]
                flags = span["flags"]
                
                is_bold = "bold" in font or (flags & 16)
                is_italic = "italic" in font or (flags & 2) or "oblique" in font
                
                stripped = span_text.strip()
                if stripped:
                    if is_bold and is_italic:
                        wrapped = span_text.replace(stripped, f"***{stripped}***")
                    elif is_bold:
                        wrapped = span_text.replace(stripped, f"**{stripped}**")
                    elif is_italic:
                        wrapped = span_text.replace(stripped, f"*{stripped}*")
                    else:
                        wrapped = span_text
                    line_text += wrapped
                else:
                    line_text += span_text
                    
            line_texts.append(line_text)
            line_ys.append(line_y)
            line_sizes.append(max_size)
            line_xs.append(line_x0)
            
        # Join lines with paragraph detection
        final_lines = []
        for i in range(len(line_texts)):
            if i > 0:
                y_diff = line_ys[i] - line_ys[i-1]
                threshold = 1.6 * line_sizes[i]
                
                # Outdent detection: if the current line starts significantly further left than the previous line
                is_outdent = (line_xs[i-1] - line_xs[i]) > 12.0
                
                if y_diff > threshold or is_outdent:
                    final_lines.append("")  # Paragraph break
            final_lines.append(line_texts[i])
            
        full_text += "\n".join(final_lines) + "\n"
        
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
    
    print(f"Extracted {len(questions)} questions to {output_md_path}")
    return output_md_path


def remove_cover_page(text):
    """Remove everything before the first question (cover page)."""
    # Look for Q.1) pattern (which might have formatting asterisks now)
    match = re.search(r'(?:(?:\*\*|\*\*\*)?Q\.\s*(?:\*\*|\*\*\*)?)?1\s*\)\s+', text)
    if match:
        return text[match.start():]
    return text


def remove_header_footer(text):
    """Remove Forum Learning Centre header block and Page X of Y footer."""
    # Remove the multi-line header block (Forum address, phone, email, URL)
    text = re.sub(
        r'(?:\*\*|\*\*\*)?Forum(?:\*\*|\*\*\*)? Learning Centre:.*?(?:helpdesk@forumias\.academy|9311740900).*?(?:\n|$)',
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
    # Prepend newline to ensure the first question matches the pattern
    prepended_text = "\n" + text
    
    # Pattern matches Q.1) or standalone 1) or 09) (with potential markdown asterisks) at start of a line
    pattern = r'\n+(?:(?:\*\*|\*\*\*)?(?:Q\.)?\s*(?:\*\*|\*\*\*)?)?(\d{1,2})\)\s+'
    splits = re.split(pattern, prepended_text)
    
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
    
    # We want to find the "Approach:" section.
    approach_match = re.search(r'(?i)^\s*(\*\*\*|\*\*|\*)?Approach:\s*', content, re.MULTILINE)
    
    if not approach_match:
        # Fallback
        lines = [l.strip() for l in content.split('\n') if l.strip()]
        question_text = lines[0] if lines else ""
        answer_body = "\n\n".join(lines[1:]) if len(lines) > 1 else ""
        approach_text = ""
    else:
        # Question text is everything before the approach match
        question_part = content[:approach_match.start()].strip()
        # Clean up question text: collapse newlines into spaces
        question_text = " ".join([l.strip() for l in question_part.split('\n') if l.strip()])
        # Clean up double asterisks that might have gotten split or wrapped on the question
        question_text = re.sub(r'\s*\*\*\s*', ' ', question_text)
        question_text = re.sub(r'^\*+|\*+$', '', question_text).strip()
        
        # Approach text starts after the "Approach:" keyword, and goes up to a blank line.
        approach_start_idx = approach_match.end()
        rest_content = content[approach_start_idx:]
        
        # Find the first blank line in rest_content
        blank_line_match = re.search(r'^\s*$', rest_content, re.MULTILINE)
        if blank_line_match:
            approach_part = rest_content[:blank_line_match.start()].strip()
            answer_part = rest_content[blank_line_match.end():].strip()
        else:
            parts = rest_content.split('\n\n')
            approach_part = parts[0].strip()
            answer_part = "\n\n".join(parts[1:]).strip()
            
        approach_text = " ".join([l.strip() for l in approach_part.split('\n') if l.strip()])
        # Remove formatting symbols from the approach block table text
        approach_text = approach_text.replace("***", "").replace("**", "").replace("*", "")
        answer_body = answer_part

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
    1. Unwrap layout-based single newlines inside paragraphs.
    2. Convert inline sub-lists into structured, indented lines.
    """
    if not answer_text:
        return ""
    
    # Split the answer text into paragraphs by double newlines
    paragraphs = re.split(r'\n\s*\n', answer_text)
    processed_paragraphs = []
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
            
        # Check if it's a markdown table
        lines = para.split('\n')
        if any(line.strip().startswith('|') for line in lines):
            processed_paragraphs.append(para)
            continue
            
        # Join lines of this paragraph while respecting list structures
        unwrapped = unwrap_paragraph_lines(para)
        
        # Process each line in the unwrapped text (some could be list items now)
        unwrapped_lines = unwrapped.split('\n')
        processed_lines = []
        for line in unwrapped_lines:
            processed_lines.append(process_paragraph(line))
            
        processed_paragraphs.append("\n".join(processed_lines))
        
    return "\n\n".join(processed_paragraphs)


def unwrap_paragraph_lines(text):
    """Join layout-wrapped lines within a paragraph unless they start a new top-level list item."""
    lines = text.split('\n')
    unwrapped_lines = []
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
            
        is_new_item = (
            re.match(r'^(?:\*\*|\*)?\d+\.(?:\*\*|\*)?(?:\s+|[a-zA-Z]|$)', stripped) or
            stripped.startswith('•') or
            stripped.startswith('-')
        )
        
        if is_new_item or not unwrapped_lines:
            unwrapped_lines.append(stripped)
        else:
            # Join with the previous line
            unwrapped_lines[-1] = unwrapped_lines[-1] + " " + stripped
            
    return "\n".join(unwrapped_lines)


def balance_markdown_formatting(text):
    """Ensure bold (**) and italic (*) markers are balanced in the text segment."""
    bold_count = text.count("**")
    if bold_count % 2 == 1:
        text += "**"
            
    temp = text.replace("**", "TEMP_BOLD")
    italic_count = temp.count("*")
    if italic_count % 2 == 1:
        temp += "*"
    text = temp.replace("TEMP_BOLD", "**")
    return text


def split_by_pattern_safely(text, pattern):
    """Split text by pattern, but ignore matches that are legal citations."""
    parts = []
    last_pos = 0
    citation_re = re.compile(r'\b(?:Articles?|Sections?|Clauses?|Schedules?|Acts?|Rule|rules?)\s+\d+(?:\s*\(\d+\))*\s*$', re.IGNORECASE)
    
    for m in re.finditer(pattern, text):
        match_start = m.start(1)
        sep_start = m.start(0)
        text_before = text[last_pos:match_start]
        marker = m.group(1)
        
        # Only apply citation check to parenthesis-based markers
        is_parenthesis_marker = '(' in marker or ')' in marker
        if is_parenthesis_marker and citation_re.search(text_before):
            continue
            
        parts.append(text[last_pos:sep_start])
        parts.append(m.group(1))
        last_pos = m.end(0)
        
    parts.append(text[last_pos:])
    return parts


def process_paragraph(para):
    """Process a single line/paragraph, formatting sub-lists if present."""
    para = para.strip()
    if not para:
        return ""
        
    # Ensure there is a space after the dot in the list number if followed by a letter
    para = re.sub(r'^((?:\*\*|\*)?\d+\.(?:\*\*|\*)?)([a-zA-Z])', r'\1 \2', para)
        
    # Check if the paragraph starts with a list number (allowing formatting tags like **1.**)
    num_match = re.match(r'^((?:\*\*|\*)?\d+\.(?:\*\*|\*)?)(?:\s+(.*)|$)', para)
    if num_match:
        num_part = num_match.group(1)
        rest_part = num_match.group(2)
        if rest_part is None:
            rest_part = ""
        rest_part = rest_part.strip()
        
        if not rest_part:
            return num_part
            
        marker_pattern = r'(?:\s+|\*\*|\*|^)((?:\*\*|\*)?[a-z][).](?:\*\*|\*)?|\((?:\*\*|\*)?[a-z](?:\*\*|\*)?\))(?:\s+|\*\*|\*|$)'
        roman_pattern = r'(?:\s+|\*\*|\*|^)((?:\*\*|\*)?[ivx]+[).](?:\*\*|\*)?|\((?:\*\*|\*)?[ivx]+(?:\*\*|\*)?\))(?:\s+|\*\*|\*|$)'
        alpha_parts = split_by_pattern_safely(rest_part, marker_pattern)
        roman_parts = split_by_pattern_safely(rest_part, roman_pattern)
        
        # If there are no sub-list markers at all, do not format/indent/split the rest of the text
        if len(alpha_parts) == 1 and len(roman_parts) == 1:
            return f"{num_part} {balance_markdown_formatting(rest_part)}"
            
        # Format the rest_part which contains sub-items
        formatted_rest = format_sub_items(rest_part, indent_level=3)
        
        return f"{num_part} {formatted_rest.lstrip()}"
        
    # Check if the paragraph starts with a sub-list marker
    if re.match(r'^(?:\b[a-z][).](?:\s+|$)|(?:\s+|^)\([a-z]\)(?:\s+|$))', para):
        return format_sub_items(para, indent_level=3)
        
    return para


def format_sub_items(text, indent_level=3):
    """Format inline sub-items (alphabetical or roman numerals) into indented newlines."""
    text = text.strip()
    if not text:
        return ""
        
    marker_pattern = r'(?:\s+|\*\*|\*|^)((?:\*\*|\*)?[a-z][).](?:\*\*|\*)?|\((?:\*\*|\*)?[a-z](?:\*\*|\*)?\))(?:\s+|\*\*|\*|$)'
    parts = split_by_pattern_safely(text, marker_pattern)
    
    indent = " " * indent_level
    roman_pattern = r'(?:\s+|\*\*|\*|^)((?:\*\*|\*)?[ivx]+[).](?:\*\*|\*)?|\((?:\*\*|\*)?[ivx]+(?:\*\*|\*)?\))(?:\s+|\*\*|\*|$)'
    
    if len(parts) == 1:
        # Maybe there are roman numeral sub-items like i) or (i) or i., ii.?
        roman_parts = split_by_pattern_safely(text, roman_pattern)
        if len(roman_parts) == 1:
            return f"{indent}{balance_markdown_formatting(text)}"
        else:
            result = []
            current_item = ""
            for part in roman_parts:
                # Check if this part matches our roman marker structure
                is_marker = re.match(r'^(?:\*\*|\*)?[ivx]+[).](?:\*\*|\*)?$', part.strip()) or \
                            re.match(r'^\((?:\*\*|\*)?[ivx]+(?:\*\*|\*)?\)$', part.strip()) or \
                            part.strip() in ['i)', 'ii)', 'iii)', 'iv)', 'v)', 'vi)', '(i)', '(ii)', '(iii)', '(iv)']
                if is_marker:
                    if current_item:
                        result.append(f"{indent}{balance_markdown_formatting(current_item)}")
                    current_item = part.strip()
                else:
                    if current_item:
                        current_item += " " + part.strip()
                    else:
                        if part.strip():
                            result.append(f"{indent}{balance_markdown_formatting(part.strip())}")
            if current_item:
                result.append(f"{indent}{balance_markdown_formatting(current_item)}")
            return "\n".join(result)
            
    # Alphabetical sub-items found
    result = []
    text_before = parts[0].strip()
    if text_before:
        result.append(f"{indent}{balance_markdown_formatting(text_before)}")
        
    for i in range(1, len(parts), 2):
        marker = parts[i].strip()
        # Clean formatting tags like ** or * from the marker itself
        marker = re.sub(r'\*\*|\*', '', marker).strip()
        
        sub_text = parts[i+1].strip()
        
        # Within this alphabetical item, check for nested roman numerals
        roman_parts = split_by_pattern_safely(sub_text, roman_pattern)
        
        if len(roman_parts) > 1:
            first_text = roman_parts[0].strip()
            if first_text:
                result.append(f"{indent}{marker} {balance_markdown_formatting(first_text)}")
                nested_indent = " " * (indent_level + 3)
                for j in range(1, len(roman_parts), 2):
                    rom_marker = roman_parts[j].strip()
                    rom_marker = re.sub(r'\*\*|\*', '', rom_marker).strip()
                    rom_text = roman_parts[j+1].strip()
                    result.append(f"{nested_indent}{rom_marker} {balance_markdown_formatting(rom_text)}")
            else:
                # No statement after alphabetical marker before roman numeral!
                rom_marker = roman_parts[1].strip()
                rom_marker = re.sub(r'\*\*|\*', '', rom_marker).strip()
                rom_text = roman_parts[2].strip()
                result.append(f"{indent}{marker} {rom_marker} {balance_markdown_formatting(rom_text)}")
                nested_indent = " " * (indent_level + len(marker) + 2)
                for j in range(3, len(roman_parts), 2):
                    rom_marker = roman_parts[j].strip()
                    rom_marker = re.sub(r'\*\*|\*', '', rom_marker).strip()
                    rom_text = roman_parts[j+1].strip()
                    result.append(f"{nested_indent}{rom_marker} {balance_markdown_formatting(rom_text)}")
        else:
            result.append(f"{indent}{marker} {balance_markdown_formatting(sub_text)}")
            
    return "\n".join(result)


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
