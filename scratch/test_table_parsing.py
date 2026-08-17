import re
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

txt_path = r"C:\Users\Dr. Yogesh\Downloads\Qwen__20260725_rjk7gw6cr.txt"

with open(txt_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("\r\n", "\n")
blocks = re.split(r'\n---\n', content)

def parse_markdown_table(lines):
    table_rows = []
    for line in lines:
        if not line.strip().startswith('|'):
            continue
        # Check if separator row
        if re.match(r'^\|[\s:\-|\-]+\|$', line.strip()):
            continue
        cells = [c.strip() for c in line.strip().split('|')[1:-1]]
        table_rows.append(cells)
    return table_rows

def is_match_list_table(table_rows):
    if len(table_rows) < 3:
        return False
    # Check if first column has A, B, C, D (either exactly or starting with them)
    col1_starts = [row[0].strip() for row in table_rows[1:] if row]
    if len(col1_starts) < 4:
        return False
    # Check if they match A, B, C, D
    matches_abcd = all(re.match(r'^[A-D]\b', item) for item in col1_starts[:4])
    return matches_abcd

for idx, block in enumerate(blocks):
    stripped = block.strip()
    if not stripped:
        continue
    first_line = stripped.split("\n")[0]
    q_match = re.match(r'^\*\*Q\.(\d+)\)', first_line)
    if q_match:
        q_num = int(q_match.group(1))
        if q_num in [50, 52, 53, 55]:
            print(f"\n================ Question {q_num} ================")
            lines = stripped.split("\n")
            # Let's extract tables
            tables = []
            current_table_lines = []
            for line in lines:
                if line.strip().startswith('|'):
                    current_table_lines.append(line)
                else:
                    if current_table_lines:
                        tables.append(parse_markdown_table(current_table_lines))
                        current_table_lines = []
            if current_table_lines:
                tables.append(parse_markdown_table(current_table_lines))
            
            print(f"Found {len(tables)} tables.")
            for t_idx, t in enumerate(tables):
                print(f"Table {t_idx+1}: {len(t)} rows, {len(t[0]) if t else 0} columns")
                print("Row 1:", t[0] if t else None)
                if len(t) > 1:
                    print("Row 2:", t[1])
                print("Is Match List Table:", is_match_list_table(t))
