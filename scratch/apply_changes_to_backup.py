import json
import re
import os
import shutil
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
        "backup_md": r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_1_PYQs_20_25_Extracted - Copy.md",
        "target_md": r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_1_PYQs_20_25_Extracted.md",
        "json":      r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro1_new_consolidated.json",
        "label":     "Paper 1"
    },
    {
        "backup_md": r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_2_PYQs_20_25_Extracted - Copy.md",
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

def process_prep_and_headers(text):
    if not text:
        return text

    # Case A: 3-column table
    table_pattern = re.compile(
        r'\|\s*(?:\*\*|__)?(?:✔|✓)?\s*Aspects?\s+to\s+Take\s+in?to\s+Account(?:\*\*|__)?\s*\|\s*(?:\*\*|__)?(?:💡)?\s*Structure\s+to\s+Follow(?:\*\*|__)?\s*\|\s*(?:\*\*|__)?(?:❌)?\s*Don\'?ts?(?:\*\*|__)?\s*\|\s*\n'
        r'\|\s*---+\s*\|\s*---+\s*\|\s*---+\s*\|\s*\n'
        r'\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(?:\n|\Z)',
        re.DOTALL | re.IGNORECASE
    )

    m_table = table_pattern.search(text)
    if m_table:
        aspects_cell = m_table.group(1).replace('<br>', ' <br> ').strip()
        structure_cell = m_table.group(2).replace('<br>', ' <br> ').strip()
        donts_cell = m_table.group(3).replace('<br>', ' <br> ').strip()

        table_md = (
            f"| **✔ Aspects to Take into Account** | **💡 Structure to Follow** | **❌ Don'ts** |\n"
            f"| --- | --- | --- |\n"
            f"| {aspects_cell} | {structure_cell} | {donts_cell} |\n\n"
        )
        rest = (text[:m_table.start()] + text[m_table.end():]).strip()
    else:
        # Case B: Stacked text prep notes
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
    rest = re.sub(r'^(?:#{1,4}\s*)?(?:\*\*|__)?\s*ANSWER\s*(?:\*\*|__)?\s*\n?', '', rest, flags=re.I).strip()
    rest = re.sub(r'^(?:#{1,4}\s*)?(?:\*\*|__)?\s*Introduction\s*(?:\*\*|__)?\s*\n?', '', rest, flags=re.I).strip()
    rest = re.sub(r'^(?:\*\*|__)?\s*Notes?\s*(?:\*\*|__)?\s*\n?', '', rest, flags=re.I).strip()

    # Add Introduction header
    rest = "### **Introduction**\n\n" + rest

    # Format Conclusion header
    rest = re.sub(r'\n(?:\s*#{1,4}\s*)?(?:\*\*|__)?\s*Conclusion\s*(?:\*\*|__)?\s*:\s*\n?', r'\n\n### **Conclusion**\n\n', rest, flags=re.I)
    rest = re.sub(r'\n(?:\s*#{1,4}\s*)?(?:\*\*|__)?\s*Conclusion\s*(?:\*\*|__)?\s*\n', r'\n\n### **Conclusion**\n\n', rest, flags=re.I)

    # Standardize Introduction
    rest = re.sub(r'^(?:#{1,4}\s*)?(?:\*\*|__)?\s*Introduction\s*(?:\*\*|__)?\s*:\s*\n?', '### **Introduction**\n\n', rest, flags=re.I)
    rest = re.sub(r'^(?:#{1,4}\s*)?(?:\*\*|__)?\s*Introduction\s*(?:\*\*|__)?\s*\n?', '### **Introduction**\n\n', rest, flags=re.I)

    if table_md:
        return table_md + "### **ANSWER**\n\n" + rest
    else:
        return "### **ANSWER**\n\n" + rest

def process_md_file(backup_path, target_path):
    with open(backup_path, "r", encoding="utf-8") as f:
        raw_md = f.read()

    sections = re.split(r'\n(?=## Question |\n## \d+\.|\Z)', raw_md)
    processed_secs = []
    extracted_entries = []

    for sec in sections:
        if not sec.strip() or sec.startswith("# Table of Contents"):
            processed_secs.append(sec)
            continue

        q_id_match = re.search(r'\*\*Question ID:\*\*\s*`?(mains-[a-z0-9\-]+)`?', sec)
        q_id = q_id_match.group(1).strip() if q_id_match else None

        q_match = re.search(r'\*\*Question:\*\*\s*(.*?)\*\*Year:\*\*', sec, re.DOTALL)
        if not q_match:
            h_match = re.match(r'## (?:Question \d+|\d+\.)\s*(.+)', sec.split('\n')[0])
            question_text = h_match.group(1).strip() if h_match else ""
        else:
            question_text = q_match.group(1).strip()

        ans_split = re.split(r'##\s*Model Answer\s*\n', sec, flags=re.I)
        if len(ans_split) > 1:
            header_part = ans_split[0] + "## Model Answer\n\n"
            ans_body = ans_split[1]
            formatted_ans = process_prep_and_headers(ans_body)
            processed_secs.append(header_part + formatted_ans + "\n\n")

            extracted_entries.append({
                "q_id": q_id,
                "question_text": question_text,
                "answer_text": formatted_ans
            })
        else:
            processed_secs.append(sec)

    final_md = "".join(processed_secs)
    # Fix double newline before ## Question
    final_md = re.sub(r'([^\n])\s*(##\s*(?:Question|\d+\.))', r'\1\n\n\2', final_md)

    with open(target_path, "w", encoding="utf-8") as f:
        f.write(final_md)

    print(f"  Processed {os.path.basename(backup_path)} -> {os.path.basename(target_path)} ({os.path.getsize(target_path)} bytes, {len(extracted_entries)} answers)")
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
        print(f"  Processing Backup MD -> Target MD & JSON for {label}")
        print(f"{'='*60}")

        extracted_entries = process_md_file(pair["backup_md"], pair["target_md"])

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
                    if md_item["question_text"] and md_item["question_text"].lower()[:40] in q.get("questionText", "").lower():
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
