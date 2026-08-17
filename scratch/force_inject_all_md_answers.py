import json
import re
import requests
import time
from difflib import SequenceMatcher

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

TARGET_INSTITUTE = "Levelup IAS"

PAIRS = [
    {
        "md":   r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_1_PYQs_20_25_Extracted.md",
        "json": r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro1_new_consolidated.json",
        "label": "Paper 1"
    },
    {
        "md":   r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_2_PYQs_20_25_Extracted.md",
        "json": r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro2_new_consolidated.json",
        "label": "Paper 2"
    },
]

def format_cell_lines(text_block):
    lines = text_block.strip().split('\n')
    formatted = []
    for line in lines:
        l = line.strip()
        if not l:
            continue
        l = re.sub(r'^(?:[-*•✔✓]|\s)+', '', l)
        l = l.replace('|', '\\|')
        formatted.append(f"• {l}")
    return ' <br> '.join(formatted)

def convert_to_approach_box(text):
    if text.startswith('| **Approach:'):
        return text

    # Case A: 3-column table
    table_pattern = re.compile(
        r'\|\s*(?:\*\*|__)?(?:✔|✓)?\s*Aspects?\s+to\s+Take\s+in?to\s+Account(?:\*\*|__)?\s*\|\s*(?:\*\*|__)?Structure\s+to\s+Follow(?:\*\*|__)?\s*\|\s*(?:\*\*|__)?Don\'?ts?(?:\*\*|__)?\s*\|\s*\n'
        r'\|\s*---+\s*\|\s*---+\s*\|\s*---+\s*\|\s*\n'
        r'\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*\n\n?',
        re.DOTALL | re.IGNORECASE
    )
    m_table = table_pattern.search(text)
    if m_table:
        aspects_cell = m_table.group(1).replace('<br>', ' <br> ').strip()
        structure_cell = m_table.group(2).replace('<br>', ' <br> ').strip()
        donts_cell = m_table.group(3).replace('<br>', ' <br> ').strip()

        box_parts = [f"• **Aspects to Take into Account:** <br> {aspects_cell}"]
        if structure_cell:
            box_parts.append(f"• **Structure to Follow:** <br> {structure_cell}")
        if donts_cell:
            box_parts.append(f"• **Don'ts:** <br> {donts_cell}")

        body_str = " <br> <br> ".join(box_parts)
        box_md = f"| **Approach:** <br> {body_str} |\n| --- |\n\n"

        rest = text[m_table.end():].strip()
        if rest and not rest.startswith("### **ANSWER**") and not rest.startswith("**ANSWER**") and not rest.startswith("#"):
            rest = "### **ANSWER**\n\n" + rest
        return box_md + (rest if rest else "")

    # Case B: Stacked text (handles ✔, bullets, bold, etc.)
    aspects_match = re.search(
        r'(?:[-*•✔✓]|\s)*(?:\*\*|__)?(?:[✔✓]|\s)*Aspects?\s+to\s+Take\s+in?to\s+Account(?:\*\*|__)?\s*\n(.*?)(?=\n\s*(?:[-*•✔✓]|\s)*(?:\*\*|__)?\s*Structure\s+to\s+Follow|\n\s*(?:[-*•✔✓]|\s)*(?:\*\*|__)?\s*Don\'?ts?|\n\s*#{1,4}\s+|\Z)',
        text, re.DOTALL | re.I
    )

    structure_match = re.search(
        r'(?:[-*•✔✓]|\s)*(?:\*\*|__)?\s*Structure\s+to\s+Follow(?:\*\*|__)?\s*\n(.*?)(?=\n\s*(?:[-*•✔✓]|\s)*(?:\*\*|__)?\s*Don\'?ts?|\n\s*#{1,4}\s+|\/\/|\Z)',
        text, re.DOTALL | re.I
    )

    donts_match = re.search(
        r'(?:[-*•✔✓]|\s)*(?:\*\*|__)?\s*Don\'?ts?\s*(?:\*\*|__)?\s*\n(.*?)(?=\n\s*(?:#{1,4}|\/\/|\*\*ANSWER\*\*)\s*|\Z)',
        text, re.DOTALL | re.I
    )

    if aspects_match:
        aspects_text = format_cell_lines(aspects_match.group(1))
        structure_text = format_cell_lines(structure_match.group(1)) if structure_match else ""
        donts_text = format_cell_lines(donts_match.group(1)) if donts_match else ""

        box_parts = [f"• **Aspects to Take into Account:** <br> {aspects_text}"]
        if structure_text:
            box_parts.append(f"• **Structure to Follow:** <br> {structure_text}")
        if donts_text:
            box_parts.append(f"• **Don'ts:** <br> {donts_text}")

        body_str = " <br> <br> ".join(box_parts)
        box_md = f"| **Approach:** <br> {body_str} |\n| --- |\n\n"

        # Find where answer text begins
        ans_idx = -1
        for kw in ["### **ANSWER**", "**ANSWER**", "// ANSWER", "### ANSWER"]:
            pos = text.find(kw)
            if pos != -1:
                ans_idx = pos
                break

        if ans_idx != -1:
            rest = text[ans_idx:].strip()
            if rest.startswith("// ANSWER"):
                rest = rest[len("// ANSWER"):].strip()
        else:
            if donts_match:
                end_pos = donts_match.end()
            elif structure_match:
                end_pos = structure_match.end()
            else:
                end_pos = aspects_match.end()
            rest = text[end_pos:].strip()

        if rest and not rest.startswith("### **ANSWER**") and not rest.startswith("**ANSWER**") and not rest.startswith("#"):
            rest = "### **ANSWER**\n\n" + rest

        return box_md + (rest if rest else "")

    return text

def parse_md_robust(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        raw = f.read()

    sections = re.split(r'\n(?=## Question |\n## \d+\.|\Z)', raw)
    results = []

    for sec in sections:
        if not sec.strip() or sec.startswith("# Table of Contents"):
            continue

        q_id_match = re.search(r'\*\*Question ID:\*\*\s*`?(mains-[a-z0-9\-]+)`?', sec)
        q_id = q_id_match.group(1).strip() if q_id_match else None

        q_match = re.search(r'\*\*Question:\*\*\s*(.*?)\*\*Year:\*\*', sec, re.DOTALL)
        if not q_match:
            h_match = re.match(r'## (?:Question \d+|\d+\.)\s*(.+)', sec.split('\n')[0])
            question_text = h_match.group(1).strip() if h_match else ""
        else:
            question_text = q_match.group(1).strip()

        if not question_text:
            continue

        # Extract answer body starting after ## Model Answer
        ans_split = re.split(r'##\s*Model Answer\s*\n', sec, flags=re.IGNORECASE)
        if len(ans_split) > 1:
            answer_raw = ans_split[1].strip()
        else:
            # Fallback
            a_m = re.search(r'(?:#{1,4}\s*)?(?:\*\*|__)?ANSWER(?:\*\*|__)?\s*\n(.*)', sec, re.DOTALL | re.IGNORECASE)
            answer_raw = a_m.group(1).strip() if a_m else ""

        if not answer_raw:
            continue

        formatted_answer = convert_to_approach_box(answer_raw)

        results.append({
            "q_id": q_id,
            "question_text": question_text,
            "answer_text": formatted_answer
        })

    return results

def upload_batch(rows):
    url = f"{SUPABASE_URL}/rest/v1/mains_answers"
    batch_size = 20
    success_count = 0

    seen = set()
    clean = []
    for r in rows:
        if r["id"] not in seen:
            seen.add(r["id"])
            clean.append(r)

    total_batches = (len(clean) + batch_size - 1) // batch_size
    for i in range(0, len(clean), batch_size):
        batch = clean[i:i+batch_size]
        all_keys = set(k for r in batch for k in r)
        padded = [{k: r.get(k) for k in all_keys} for r in batch]
        for attempt in range(5):
            try:
                resp = requests.post(url, json=padded, headers=HEADERS, timeout=60)
                if resp.status_code in [200, 201]:
                    success_count += len(batch)
                    print(f"  Batch {i//batch_size + 1}/{total_batches} -> mains_answers: OK ({len(batch)} rows)")
                    break
                else:
                    print(f"  [WARN] batch {i//batch_size+1}: {resp.status_code} {resp.text[:200]}")
                    time.sleep(4)
            except Exception as e:
                print(f"  [RETRY] {e}")
                time.sleep(4)

    print(f"  [SUCCESS] Uploaded {success_count}/{len(clean)} total answers to mains_answers")
    return success_count

def main():
    all_answers_to_upload = []

    for pair in PAIRS:
        label = pair["label"]
        print(f"\n{'='*60}")
        print(f"  Parsing & Force-Injecting ALL MD answers into {label}")
        print(f"{'='*60}")

        md_entries = parse_md_robust(pair["md"])
        print(f"  Robustly extracted {len(md_entries)} entries from {os.path.basename(pair['md'])}")

        with open(pair["json"], "r", encoding="utf-8") as f:
            data = json.load(f)

        questions = data.get("questions", [])

        # Create quick lookup by q_id
        q_map = {q["id"]: q for q in questions if "id" in q}

        updated_count = 0
        for md_item in md_entries:
            target_q = None
            if md_item["q_id"] and md_item["q_id"] in q_map:
                target_q = q_map[md_item["q_id"]]
            else:
                # Similarity match
                for q in questions:
                    if SequenceMatcher(None, md_item["question_text"].lower(), q.get("questionText", "").lower()).ratio() >= 0.85:
                        target_q = q
                        break

            if target_q:
                q_id = target_q["id"]
                ans_id = f"{q_id}-levelup_ias"

                # Update or add Levelup IAS answer
                cleaned_ans = [a for a in target_q.get("answers", []) if a.get("institute") not in ["Model Answer", TARGET_INSTITUTE]]
                cleaned_ans.append({
                    "id": ans_id,
                    "institute": TARGET_INSTITUTE,
                    "answerText": md_item["answer_text"]
                })
                target_q["answers"] = cleaned_ans
                updated_count += 1

        print(f"  Updated {updated_count}/{len(md_entries)} questions in {label} JSON.")

        # Ensure all existing answers in JSON also pass through convert_to_approach_box
        for q in questions:
            q_id = q["id"]
            for a in q.get("answers", []):
                txt = a.get("answerText", "")
                converted = convert_to_approach_box(txt)
                a["answerText"] = converted
                ans_id = a.get("id") or f"{q_id}-levelup_ias"
                a["id"] = ans_id

                all_answers_to_upload.append({
                    "id": ans_id,
                    "question_id": q_id,
                    "institute": a.get("institute", TARGET_INSTITUTE),
                    "answer_text": converted
                })

        with open(pair["json"], "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  {label} JSON saved cleanly.")

    print(f"\n{'='*60}")
    print(f"  Uploading ALL {len(all_answers_to_upload)} answers to Supabase...")
    upload_batch(all_answers_to_upload)
    print("\nDone!")

if __name__ == "__main__":
    import os
    main()
