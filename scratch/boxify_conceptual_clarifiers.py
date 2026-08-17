import json
import re
import os

md1_path = r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_1_PYQs_20_25_Extracted.md"
json1_path = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro1_new_consolidated.json"

with open(md1_path, "r", encoding="utf-8") as f:
    text = f.read()

# Match Conceptual Clarifiers block
pattern = re.compile(
    r'(\*\*Conceptual Clarifiers:\*\*\s*\n)(.*?)(?=\n\n---\n|\Z)',
    re.DOTALL | re.IGNORECASE
)

def boxify_clarifiers(match):
    header = "> **💡 Conceptual Clarifiers:**\n"
    body = match.group(2).strip()
    lines = body.split('\n')
    boxed_lines = [f"> {l}" if l.strip() else ">" for l in lines]
    return header + "\n".join(boxed_lines)

if pattern.search(text):
    text = pattern.sub(boxify_clarifiers, text)
    print("  [SUCCESS] Conceptual Clarifiers formatted into callout box!")
else:
    print("  [WARN] Could not find Conceptual Clarifiers block!")

with open(md1_path, "w", encoding="utf-8") as f:
    f.write(text)

# Also update the JSON file locally
with open(json1_path, "r", encoding="utf-8") as f:
    data = json.load(f)

secs = re.split(r'\n(?=##\s*Question\s*\d+|\Z)', text)
q_map = {q["id"]: q for q in data.get("questions", []) if "id" in q}

for s in secs:
    if not s.strip() or s.startswith("# Table of Contents"):
        continue

    q_id_m = re.search(r'\*\*Question ID:\*\*\s*`?(mains-[a-z0-9\-]+)`?', s)
    q_id = q_id_m.group(1).strip() if q_id_m else None

    ma_m = re.search(r'##\s*Model Answer\s*\n(.*)', s, re.DOTALL | re.IGNORECASE)
    if ma_m and q_id and q_id in q_map:
        target_q = q_map[q_id]
        ans_id = f"{q_id}-levelup_ias"

        table_m = re.search(r'(\|\s*\*?\*?✔ Aspects.*?\n\n)', s, re.DOTALL | re.IGNORECASE)
        table_text = table_m.group(1) if table_m else ""

        full_ans = table_text + "## Model Answer\n\n" + ma_m.group(1).strip()
        full_ans = re.sub(r'\n+---\s*$', '', full_ans).strip()

        cleaned_ans = [a for a in target_q.get("answers", []) if a.get("institute") not in ["Model Answer", "Levelup IAS"]]
        cleaned_ans.append({
            "id": ans_id,
            "institute": "Levelup IAS",
            "answerText": full_ans
        })
        target_q["answers"] = cleaned_ans

with open(json1_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("  Paper 1 JSON updated locally.")
print("Done! (Supabase upload skipped per directive)")
