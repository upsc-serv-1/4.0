import re
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

txt_path = r"C:\Users\Dr. Yogesh\Downloads\Qwen__20260725_rjk7gw6cr.txt"
mapping_path = r"C:\Users\Dr. Yogesh\Downloads\Qwen_json_20260725_4bvuoipmw.json"
backup_mapping_path = r"C:\Users\Dr. Yogesh\Downloads\Qwen_json_20260725_4bvuoipmw_backup_mapping.json"
output_path = r"C:\Users\Dr. Yogesh\Downloads\Qwen_json_20260725_4bvuoipmw.json"

# Read inputs
with open(txt_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(mapping_path, "r", encoding="utf-8") as f:
    mapping = json.load(f)

# Save a backup of the original mapping JSON
with open(backup_mapping_path, "w", encoding="utf-8") as f:
    json.dump(mapping, f, indent=2, ensure_ascii=False)
print("Backup mapping saved to:", backup_mapping_path)

content = content.replace("\r\n", "\n")
blocks = re.split(r'\n---\n', content)

# Regex patterns
option_pattern = re.compile(r'^\s*([a-d])\)\s*(.*)')
table_option_pattern = re.compile(r'^\s*\|\s*([a-d])\)?\s*\|\s*(.*)', re.IGNORECASE)

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
    options = {}
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
            
        # Check for Table Option line (e.g. | a) | 1 | 3 | 4 | 2 |)
        table_opt_m = table_option_pattern.match(line_strip)
        if table_opt_m:
            opt_char = table_opt_m.group(1).lower()
            cell_content = table_opt_m.group(2)
            parts = [p.strip() for p in cell_content.split("|") if p.strip()]
            opt_val = " ".join(parts)
            options[opt_char] = opt_val
            continue
            
        # Check for standard Option line (e.g. a) 1 Only)
        opt_m = option_pattern.match(line_strip)
        if opt_m:
            opt_char = opt_m.group(1).lower()
            opt_val = opt_m.group(2).strip()
            options[opt_char] = opt_val
            continue
            
        # Standard question text line
        question_lines_raw.append(line)

    first_q_line = question_lines_raw[0]
    first_q_line_clean = re.sub(r'^\*\*Q\.\d+\)\*\*?\s*', '', first_q_line).strip()
    question_lines_raw[0] = first_q_line_clean
    
    question_body = "\n".join(question_lines_raw).strip()
    
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
        full_question_text = f"Passage:\n {passage_text_for_q}\n \n {question_body}"
    else:
        full_question_text = question_body
        
    statement_lines = [""] + [line for line in full_question_text.split("\n")]
    
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
        
    # Construct question object matching 2015 structure
    q_obj = {
        "id": f"upsc-cse-pyq-2026-gs2-q{q_num:03d}",
        "questionNumber": q_num,
        "subject": subject,
        "sectionGroup": section_group,
        "microTopic": micro_topic,
        "statementLines": statement_lines,
        "questionText": full_question_text,
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

# Sort questions list by questionNumber to ensure they are in order
questions_list.sort(key=lambda x: x["questionNumber"])

# Construct final JSON structure matching 2015 root
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

# Write output file
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(final_json, f, indent=2, ensure_ascii=False)

print(f"\nSuccess! Formatted JSON written to: {output_path}")
print(f"Total questions written: {len(questions_list)}")
