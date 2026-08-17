import json
import re
import os
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

TARGET_INSTITUTE = "Levelup IAS"

BACKUP_PAIRS = [
    {
        "backup_md": r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\LEVELUP BOOK\New folder\Anthropology_PAPER_1_PYQs_20_25_Extracted - Copy.md",
        "target_md": r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_1_PYQs_20_25_Extracted.md",
        "json":      r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro1_new_consolidated.json",
        "label":     "Paper 1"
    },
    {
        "backup_md": r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\LEVELUP BOOK\New folder\Anthropology_PAPER_2_PYQs_20_25_Extracted - Copy.md",
        "target_md": r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_2_PYQs_20_25_Extracted.md",
        "json":      r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro2_new_consolidated.json",
        "label":     "Paper 2"
    }
]

def format_cell_lines(text_block):
    lines = text_block.strip().split('\n')
    formatted = []
    for line in lines:
        l = line.strip()
        if not l:
            continue
        l = re.sub(r'^(?:[-*•✔✓💡❌]|\s)+', '', l)
        l = l.replace('|', '\\|')
        formatted.append(f"• {l}")
    return ' <br> '.join(formatted)

def process_section_content(ma_body):
    if not ma_body:
        return "", ""

    # Clean any internal lone '---' lines from ma_body
    lines = ma_body.split('\n')
    clean_lines = [l for l in lines if l.strip() != '---']
    text = '\n'.join(clean_lines).strip()

    # Extract prep sections: Aspects, Structure, Don'ts
    aspects_match = re.search(
        r'(?:[-*•✔✓]|\s)*(?:\*\*|__)?(?:[✔✓]|\s)*Aspects?\s+to\s+Take\s+in?to\s+Account(?:\*\*|__)?\s*\n(.*?)(?=\n\s*(?:[-*•✔✓]|\s)*(?:\*\*|__)?\s*Structure\s+to\s+Follow|\n\s*(?:[-*•✔✓]|\s)*(?:\*\*|__)?\s*Don\'?ts?|\n\s*#{1,4}\s+|\Z)',
        text, re.DOTALL | re.I
    )
    structure_match = re.search(
        r'(?:[-*•✔✓]|\s)*(?:\*\*|__)?\s*Structure\s+to\s+Follow(?:\*\*|__)?\s*\n(.*?)(?=\n\s*(?:[-*•✔✓]|\s)*(?:\*\*|__)?\s*Don\'?ts?|\n\s*#{1,4}\s+|\/\/|\Z)',
        text, re.DOTALL | re.I
    )
    donts_match = re.search(
        r'(?:[-*•✔✓]|\s)*(?:\*\*|__)?\s*Don\'?ts?\s*(?:\*\*|__)?\s*\n(.*?)(?=\n\s*(?:#{1,4}|\/\/|\*\*ANSWER\*\*|\*\*Model Answer\*\*)\s*|\Z)',
        text, re.DOTALL | re.I
    )

    if aspects_match:
        aspects_text = format_cell_lines(aspects_match.group(1))
        structure_text = format_cell_lines(structure_match.group(1)) if structure_match else "-"
        donts_text = format_cell_lines(donts_match.group(1)) if donts_match else "-"

        table_md = (
            f"| **✔ Aspects to Take into Account** | **💡 Structure to Follow** | **❌ Don'ts** |\n"
            f"| --- | --- | --- |\n"
            f"| {aspects_text} | {structure_text} | {donts_text} |\n\n"
        )

        if donts_match: end_pos = donts_match.end()
        elif structure_match: end_pos = structure_match.end()
        else: end_pos = aspects_match.end()

        rest = text[end_pos:].strip()
    else:
        table_md = ""
        rest = text.strip()

    # Clean body headers
    rest = re.sub(r'^(?:#{1,4}\s*)?(?:\*\*|__)?\s*(?:ANSWER|Model Answer)\s*(?:\*\*|__)?\s*\n?', '', rest, flags=re.I).strip()
    rest = re.sub(r'^(?:#{1,4}\s*)?(?:\*\*|__)?\s*Introduction\s*(?:\*\*|__)?\s*\n?', '', rest, flags=re.I).strip()
    rest = re.sub(r'^(?:\*\*|__)?\s*Notes?\s*(?:\*\*|__)?\s*\n?', '', rest, flags=re.I).strip()

    # Format Introduction
    rest = "### **Introduction**\n\n" + rest

    # Format Conclusion header
    rest = re.sub(r'\n(?:\s*#{1,4}\s*)?(?:\*\*|__)?\s*Conclusion\s*(?:\*\*|__)?\s*:\s*\n?', r'\n\n### **Conclusion**\n\n', rest, flags=re.I)
    rest = re.sub(r'\n(?:\s*#{1,4}\s*)?(?:\*\*|__)?\s*Conclusion\s*(?:\*\*|__)?\s*\n', r'\n\n### **Conclusion**\n\n', rest, flags=re.I)

    # Standardize Introduction
    rest = re.sub(r'^(?:#{1,4}\s*)?(?:\*\*|__)?\s*Introduction\s*(?:\*\*|__)?\s*:\s*\n?', '### **Introduction**\n\n', rest, flags=re.I)
    rest = re.sub(r'^(?:#{1,4}\s*)?(?:\*\*|__)?\s*Introduction\s*(?:\*\*|__)?\s*\n?', '### **Introduction**\n\n', rest, flags=re.I)

    full_formatted_body = "## Model Answer\n\n" + rest

    # Return table + body
    if table_md:
        formatted_section_text = "## ANSWER\n\n" + table_md + full_formatted_body
        json_answer_text = table_md + full_formatted_body
    else:
        formatted_section_text = "## ANSWER\n\n" + full_formatted_body
        json_answer_text = full_formatted_body

    return formatted_section_text, json_answer_text

def process_pristine_backup(backup_path, target_path):
    with open(backup_path, "r", encoding="utf-8") as f:
        raw_md = f.read()

    secs = re.split(r'\n(?=##\s*Question\s*\d+|\Z)', raw_md)
    processed_secs = []
    extracted_entries = []

    for s in secs:
        if not s.strip() or s.startswith("# Table of Contents"):
            processed_secs.append(s.strip())
            continue

        q_id_m = re.search(r'\*\*Question ID:\*\*\s*`?(mains-[a-z0-9\-]+)`?', s)
        q_id = q_id_m.group(1).strip() if q_id_m else None

        q_txt_m = re.search(r'\*\*Question:\*\*\s*(.*?)(?=\*\*Year:\*\*|\*\*Marks:\*\*|\n\n|\Z)', s, re.DOTALL)
        question_text = q_txt_m.group(1).strip() if q_txt_m else ""

        # Split at ## Model Answer
        ma_split = re.split(r'\n##\s*Model Answer\s*\n', s, flags=re.I)
        if len(ma_split) > 1:
            q_header = ma_split[0].strip()
            ma_body = ma_split[1].strip()

            formatted_sec_text, json_ans_text = process_section_content(ma_body)

            full_q_sec = q_header + "\n\n" + formatted_sec_text
            processed_secs.append(full_q_sec)

            extracted_entries.append({
                "q_id": q_id,
                "question_text": question_text,
                "answer_text": json_ans_text
            })
        else:
            processed_secs.append(s.strip())

    final_md = "# Table of Contents\n[TOC]\n\n" + "\n\n---\n\n".join(processed_secs) + "\n\n---\n"

    with open(target_path, "w", encoding="utf-8") as f:
        f.write(final_md)

    print(f"  Generated {os.path.basename(target_path)} -> {os.path.getsize(target_path)} bytes ({len(extracted_entries)} answers)")
    return extracted_entries

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

    for pair in BACKUP_PAIRS:
        label = pair["label"]
        print(f"\n{'='*60}")
        print(f"  Generating Perfect Final Files for {label}")
        print(f"{'='*60}")

        extracted_entries = process_pristine_backup(pair["backup_md"], pair["target_md"])

        with open(pair["json"], "r", encoding="utf-8") as f:
            data = json.load(f)

        questions = data.get("questions", [])
        q_map = {q["id"]: q for q in questions if "id" in q}

        for md_item in extracted_entries:
            target_q = None
            if md_item["q_id"] and md_item["q_id"] in q_map:
                target_q = q_map[md_item["q_id"]]
            else:
                for q in questions:
                    if md_item["question_text"] and md_item["question_text"].lower()[:30] in q.get("questionText", "").lower():
                        target_q = q
                        break

            if target_q:
                q_id = target_q["id"]
                ans_id = f"{q_id}-levelup_ias"

                cleaned_ans = [a for a in target_q.get("answers", []) if a.get("institute") not in ["Model Answer", TARGET_INSTITUTE]]
                cleaned_ans.append({
                    "id": ans_id,
                    "institute": TARGET_INSTITUTE,
                    "answerText": md_item["answer_text"]
                })
                target_q["answers"] = cleaned_ans

        for q in questions:
            q_id = q["id"]
            for a in q.get("answers", []):
                ans_id = a.get("id") or f"{q_id}-levelup_ias"
                a["id"] = ans_id

                all_answers_to_upload.append({
                    "id": ans_id,
                    "question_id": q_id,
                    "institute": a.get("institute", TARGET_INSTITUTE),
                    "answer_text": a.get("answerText", "")
                })

        with open(pair["json"], "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  {label} JSON updated and saved.")

    print(f"\n{'='*60}")
    print(f"  Uploading ALL {len(all_answers_to_upload)} answers to Supabase...")
    upload_batch(all_answers_to_upload)
    print("\nDone!")

if __name__ == "__main__":
    main()
