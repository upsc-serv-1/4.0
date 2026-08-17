import re
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

txt_path = r"C:\Users\Dr. Yogesh\Downloads\Qwen__20260725_rjk7gw6cr.txt"
mapping_path = r"C:\Users\Dr. Yogesh\Downloads\Qwen_json_20260725_4bvuoipmw_backup_mapping.json"
output_path = r"C:\Users\Dr. Yogesh\Downloads\Qwen_json_20260725_4bvuoipmw.json"

if not os.path.exists(mapping_path):
    mapping_path = r"C:\Users\Dr. Yogesh\Downloads\Qwen_json_20260725_4bvuoipmw.json"

with open(txt_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(mapping_path, "r", encoding="utf-8") as f:
    mapping = json.load(f)

content = content.replace("\r\n", "\n")
blocks = re.split(r'\n---\n', content)

# Regex patterns
option_pattern = re.compile(r'^\s*([a-d])\)\s*(.*)')
table_option_pattern = re.compile(r'^\s*\|\s*([a-d])\)?\s*\|\s*(.*)', re.IGNORECASE)

def parse_markdown_table(lines):
    table_rows = []
    for line in lines:
        if not line.strip().startswith('|'):
            continue
        if re.match(r'^\|[\s:\-|\-]+\|$', line.strip()):
            continue
        cells = [c.strip() for c in line.strip().split('|')[1:-1]]
        table_rows.append(cells)
    return table_rows

def is_match_list_table(table_rows):
    if len(table_rows) < 3:
        return False
    col1_starts = [row[0].strip() for row in table_rows[1:] if row]
    if len(col1_starts) < 4:
        return False
    matches_abcd = all(re.match(r'^[A-D]\b', item) for item in col1_starts[:4])
    return matches_abcd

# Parse blocks
current_passage = None
first_q_in_passage = None
passage_counter = 0

questions_list = []

for idx, block in enumerate(blocks):
    stripped = block.strip()
    if not stripped:
        continue
    
    first_line = stripped.split("\n")[0]
    q_match = re.match(r'^\*\*Q\.(\d+)\)', first_line)
    
    if not q_match:
        # Directions/Passage block
        passage_marker = None
        if "**Passage:**" in stripped:
            passage_marker = "**Passage:**"
        elif "Passage:" in stripped:
            passage_marker = "Passage:"
            
        if passage_marker:
            parts = stripped.split(passage_marker)
            current_passage = parts[1].strip()
        else:
            # Check for Directions header
            dir_match = re.match(r'^\*\*Directions for the next \d+ \([^)]+\) items:\*\*', stripped)
            if dir_match:
                lines = stripped.split("\n")
                current_passage = "\n".join(lines[1:]).strip()
            else:
                current_passage = stripped
        
        first_q_in_passage = None
        num_items_match = re.search(r'next (\d+) \([^)]+\) items', stripped, re.IGNORECASE)
        if num_items_match:
            passage_counter = int(num_items_match.group(1))
        else:
            passage_counter = 999
        continue

    q_num = int(q_match.group(1))
    lines = stripped.split("\n")
    
    question_lines_raw = []
    correct_answer = None
    explanation_lines = []
    in_explanation = False
    
    for line in lines:
        line_strip = line.strip()
        
        # Check for Answer line
        ans_m = re.match(r'^\*\*Ans\)\s*([a-d])\*\*', line_strip, re.IGNORECASE)
        if ans_m:
            correct_answer = ans_m.group(1).lower()
            continue
            
        # Check for Exp line
        exp_m = re.match(r'^\*\*Exp\)\s*(.*)', line_strip, re.IGNORECASE)
        if exp_m:
            in_explanation = True
            explanation_lines.append(line_strip)
            continue
            
        if in_explanation:
            explanation_lines.append(line)
            continue
            
        # Standard question/option line
        question_lines_raw.append(line)

    first_q_line = question_lines_raw[0]
    first_q_line_clean = re.sub(r'^\*\*Q\.\d+\)\*\*?\s*', '', first_q_line).strip()
    question_lines_raw[0] = first_q_line_clean
    
    # Process question lines into elements (text lines vs markdown tables)
    elements = []
    current_table_lines = []
    for line in question_lines_raw:
        if line.strip().startswith('|'):
            current_table_lines.append(line)
        else:
            if current_table_lines:
                elements.append(('table', parse_markdown_table(current_table_lines)))
                current_table_lines = []
            elements.append(('text', line))
    if current_table_lines:
        elements.append(('table', parse_markdown_table(current_table_lines)))

    # Classify tables
    match_list_idx = -1
    code_table_idx = -1
    for el_idx, (el_type, el_val) in enumerate(elements):
        if el_type == 'table':
            if is_match_list_table(el_val):
                match_list_idx = el_idx
            elif len(el_val[0]) >= 4 and el_val[0][1] == 'A':
                code_table_idx = el_idx

    # Process options and statementLines
    options = {}
    statement_lines_out = []
    is_match_question = False
    
    if match_list_idx != -1 and code_table_idx != -1:
        is_match_question = True
        match_table = elements[match_list_idx][1]
        code_table = elements[code_table_idx][1]
        
        # Options: "a": "A-1, B-3, C-4, D-2"
        cols = code_table[0][1:] # ['A', 'B', 'C', 'D']
        for row in code_table[1:]:
            opt_name = row[0].replace(')', '').strip().lower()
            vals = row[1:]
            opt_str = ", ".join(f"{col}-{val}" for col, val in zip(cols, vals))
            options[opt_name] = opt_str
            
        # Reconstruct statementLines
        for el_idx, (el_type, el_val) in enumerate(elements):
            if el_idx == match_list_idx:
                header = el_val[0]
                header_line = f"{header[0]} - {header[1]}"
                statement_lines_out.append(header_line)
                for row in el_val[1:]:
                    statement_lines_out.append(f"{row[0]} -")
                    statement_lines_out.append(row[1])
            elif el_idx == code_table_idx:
                continue
            elif el_type == 'text':
                if el_val.strip().lower() == 'code:':
                    continue
                statement_lines_out.append(el_val)
            elif el_type == 'table':
                # Normal table within match list (should not happen, but fallback)
                for row in el_val:
                    statement_lines_out.append(" | ".join(row))
    else:
        # Standard question formatting
        for el_idx, (el_type, el_val) in enumerate(elements):
            if el_type == 'text':
                opt_m = option_pattern.match(el_val.strip())
                if opt_m:
                    options[opt_m.group(1).lower()] = opt_m.group(2).strip()
                else:
                    statement_lines_out.append(el_val)
            elif el_type == 'table':
                for row in el_val:
                    statement_lines_out.append(" | ".join(row))

    # Filter out empty strings from statementLines
    clean_stmt_lines = []
    for line in statement_lines_out:
        line_strip = line.strip()
        if line_strip:
            clean_stmt_lines.append(line_strip)
            
    # Apply passage if active
    passage_text_for_q = None
    if passage_counter > 0 and current_passage:
        if first_q_in_passage is None:
            first_q_in_passage = q_num
            passage_text_for_q = current_passage
        else:
            passage_text_for_q = f"[Same as Q{first_q_in_passage}]"
        passage_counter -= 1
        if passage_counter == 0:
            current_passage = None
            
    if passage_text_for_q:
        # Prepend passage lines to clean_stmt_lines
        passage_lines = [line.strip() for line in passage_text_for_q.split("\n") if line.strip()]
        clean_stmt_lines = ["Passage:"] + passage_lines + clean_stmt_lines

    # Construct statementLines and questionText
    statement_lines = [""] + clean_stmt_lines
    if is_match_question:
        question_text = " ".join(clean_stmt_lines)
    else:
        question_text = "\n".join(clean_stmt_lines)

    explanation_markdown = "\n".join(explanation_lines).strip()
    if explanation_markdown:
        exp_first_line_match = re.match(r'^(\*\*Exp\) Option [a-d] is the correct answer\.\*\*)(.*)', explanation_markdown, re.DOTALL | re.IGNORECASE)
        if exp_first_line_match:
            prefix = exp_first_line_match.group(1)
            rest = exp_first_line_match.group(2).strip()
            explanation_markdown = f"{prefix}\n<text>Explanation:</text> \n\n{rest}"
        else:
            explanation_markdown = f"**Exp) Option {correct_answer} is the correct answer.**\n<text>Explanation:</text> \n\n{explanation_markdown}"
            
    mapped_info = mapping.get(str(q_num), {})
    subject = mapped_info.get("subject", "CSAT")
    section_group = mapped_info.get("sectionGroup", "")
    micro_topic = mapped_info.get("microTopic", "")
    
    if not options and section_group == "Logical Reasoning" and micro_topic == "Data Sufficiency":
        options = {
            "a": "Select this option if the question can be answered using one of these statements alone, but cannot be answered using other statement",
            "b": "Select this option if the question can be answered using either statement alone",
            "c": "Select this option if the question can be answered using both the statements together, but cannot be answered using either statement alone",
            "d": "Select this option if the question cannot be answered even using any of the statements"
        }
        
    q_obj = {
        "id": f"upsc-cse-pyq-2026-gs2-q{q_num:03d}",
        "questionNumber": q_num,
        "subject": subject,
        "sectionGroup": section_group,
        "microTopic": micro_topic,
        "statementLines": statement_lines,
        "questionText": question_text,
        "options": options,
        "correctAnswer": correct_answer,
        "explanationMarkdown": explanation_markdown,
        "exam_info": {
            "isPyq": True,
            "is_ncert": False,
            "exam": "Prelims",
            "group": "UPSC CSE",
            "year": 2026,
            "is_upsc_cse": True,
            "is_allied": False,
            "is_others": False,
            "exam_category": "cse",
            "specific_exam": None,
            "stage": "prelims",
            "paper": "pre_csat"
        },
        "source_attribution_label": "CSE 2026"
    }
    
    questions_list.append(q_obj)

questions_list.sort(key=lambda x: x["questionNumber"])

final_json = {
    "course": "Civil Services",
    "id": "upsc-cse-pyq-2026-gs2",
    "title": "2026- Prelims - CSAT Paper 2 - UPSC",
    "launch_year": 2026,
    "institute": "UPSC",
    "program_id": "cse",
    "program_name": "CSE",
    "series": "Prelims (Official)",
    "level": "CSAT",
    "paperType": "test-paper",
    "defaultMinutes": 120,
    "sourceMode": "docx-sol",
    "questions": questions_list
}

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(final_json, f, indent=2, ensure_ascii=False)

print(f"\n[SUCCESS] Formatted CSAT 2026 JSON (Ref Style) written to: {output_path}")
print(f"Total questions written: {len(questions_list)}")
