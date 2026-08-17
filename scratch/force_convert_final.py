import json
import re
import requests
import time

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

FILES = [
    {
        "path": r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro1_new_consolidated.json",
        "label": "Paper 1"
    },
    {
        "path": r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro2_new_consolidated.json",
        "label": "Paper 2"
    }
]

def format_cell_lines(text_block):
    lines = text_block.strip().split('\n')
    formatted = []
    for line in lines:
        l = line.strip()
        if not l:
            continue
        l = re.sub(r'^(?:[-*•]|\s)+', '', l)
        l = l.replace('|', '\\|')
        formatted.append(f"• {l}")
    return ' <br> '.join(formatted)

def parse_and_build_approach_box(text):
    if text.startswith('| **Approach:'):
        return text

    if not re.search(r'Aspects?\s+to\s+Take', text, re.I):
        return text

    # Extract Aspects to Take into Account
    aspects_match = re.search(
        r'(?:[-*•]|\s)*(?:\*\*|__)?\s*Aspects?\s+to\s+Take\s+in?to\s+Account\s*(?:\*\*|__)?\s*\n(.*?)(?=\n\s*(?:[-*•]|\s)*(?:\*\*|__)?\s*Structure\s+to\s+Follow|\n\s*(?:[-*•]|\s)*(?:\*\*|__)?\s*Don\'?ts?|\n\s*#{1,4}\s+|\Z)',
        text, re.DOTALL | re.I
    )

    structure_match = re.search(
        r'(?:[-*•]|\s)*(?:\*\*|__)?\s*Structure\s+to\s+Follow\s*(?:\*\*|__)?\s*\n(.*?)(?=\n\s*(?:[-*•]|\s)*(?:\*\*|__)?\s*Don\'?ts?|\n\s*#{1,4}\s+|\/\/|\Z)',
        text, re.DOTALL | re.I
    )

    donts_match = re.search(
        r'(?:[-*•]|\s)*(?:\*\*|__)?\s*Don\'?ts?\s*(?:\*\*|__)?\s*\n(.*?)(?=\n\s*(?:#{1,4}|\/\/|\*\*ANSWER\*\*)\s*|\Z)',
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

    for f_info in FILES:
        label = f_info["label"]
        filepath = f_info["path"]
        print(f"\n{'='*60}")
        print(f"  Converting ALL remaining prep blocks in {label} ({filepath})")
        print(f"{'='*60}")

        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        questions = data.get("questions", [])
        converted_in_file = 0
        total_answers_in_file = 0

        for q in questions:
            q_id = q["id"]
            for a in q.get("answers", []):
                total_answers_in_file += 1
                txt = a.get("answerText", "")

                new_txt = parse_and_build_approach_box(txt)
                if new_txt != txt:
                    a["answerText"] = new_txt
                    converted_in_file += 1

                ans_id = a.get("id") or f"{q_id}-levelup_ias"
                a["id"] = ans_id

                all_answers_to_upload.append({
                    "id": ans_id,
                    "question_id": q_id,
                    "institute": a.get("institute", "Levelup IAS"),
                    "answer_text": a["answerText"]
                })

        print(f"  {label}: Converted {converted_in_file} additional prep blocks into Approach Boxes.")
        print(f"  {label}: Total answers ready = {total_answers_in_file}")

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  {label} JSON saved.")

    print(f"\n{'='*60}")
    print(f"  Uploading ALL {len(all_answers_to_upload)} answers to Supabase...")
    upload_batch(all_answers_to_upload)
    print("\nDone!")

if __name__ == "__main__":
    main()
