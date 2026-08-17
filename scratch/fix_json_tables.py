import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

json_path = r'C:\Users\Dr. Yogesh\Downloads\Qwen_json_20260725_4bvuoipmw.json'

if not os.path.exists(json_path):
    print(f"[ERROR] File not found: {json_path}")
    exit(1)

with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

print("Modifying questions format...")
modified_count = 0
for q in data["questions"]:
    # 1. Clean statementLines
    raw_lines = q.get("statementLines", [])
    clean_lines = []
    for line in raw_lines:
        if line is not None:
            stripped = line.strip()
            if stripped:  # Filter out empty or whitespace-only lines
                clean_lines.append(stripped)
                
    q["statementLines"] = clean_lines
    
    # 2. Join clean statementLines with a single space to form questionText
    q["questionText"] = " ".join(clean_lines)
    modified_count += 1

# Save updated JSON
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"[SUCCESS] Updated {modified_count} questions. JSON saved.")
