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

SIMILARITY_THRESHOLD = 0.85
INSTITUTE_LABEL = "Model Answer"

SHORT_NOTE_PREFIXES = [
    r"write short notes? on the following in about \d+ words? each\s*[:\.\s]*",
    r"write notes? on the following in about \d+ words? each\s*[:\.\s]*",
    r"write short notes? on the following\s*[:\.\s]*",
    r"write notes? on the following\s*[:\.\s]*",
    r"write short notes? on\s*[:\.\s]*",
    r"write a short note on\s*[:\.\s]*",
    r"write notes? on\s*[:\.\s]*",
    r"comment briefly on\s*[:\.\s]*",
    r"comment on\s*[:\.\s]*",
    r"briefly explain\s*[:\.\s]*",
    r"briefly describe\s*[:\.\s]*",
    r"explain briefly\s*[:\.\s]*",
    r"discuss briefly\s*[:\.\s]*",
    r"write a note on\s*[:\.\s]*",
    r"write an essay on\s*[:\.\s]*",
    r"discuss in about \d+ words?\s*[:\.\s]*",
    r"describe in about \d+ words?\s*[:\.\s]*",
]

def strip_prefixes(text):
    t = text.strip()
    t = re.sub(r'Q\*\*\s*\*\*', '', t).strip()
    t = re.sub(r'\*\*\s*\*\*', ' ', t).strip()
    t = re.sub(r'\*+', '', t).strip()
    for pat in SHORT_NOTE_PREFIXES:
        t = re.sub(pat, "", t, flags=re.IGNORECASE).strip()
    t = re.sub(r'^Q[:\.\s]\s*', '', t, flags=re.IGNORECASE).strip()
    t = re.sub(r'^[\(\[]?[0-9a-zA-Z]+[\)\]\.] ', '', t).strip()
    return t

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

def parse_md(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        raw = f.read()

    sections = re.split(r'\n(?=## Question |\n## \d+\.|\Z)', raw)
    results = []

    for sec in sections:
        if not sec.strip() or sec.startswith("# Table of Contents"):
            continue

        q_match = re.search(r'\*\*Question:\*\*\s*(.*?)\*\*Year:\*\*', sec, re.DOTALL)
        if not q_match:
            h_match = re.match(r'## (?:Question \d+|\d+\.)\s*(.+)', sec.split('\n')[0])
            question_text = h_match.group(1).strip() if h_match else ""
        else:
            question_text = q_match.group(1).strip()

        if not question_text:
            continue

        # Capture from the start of the 3-column table or Model Answer down to the end of the question section
        ans_match = re.search(
            r'(?:##\s*Model Answer\s*\n)?(\|(?:[\s\S]*?)\*\*Aspects to Take into Account[\s\S]*?)(?=\n## |\Z)',
            sec, re.IGNORECASE
        )
        if not ans_match:
            ans_match = re.search(
                r'(?:#{1,4}\s*)?\*\*ANSWER\*\*\s*\n(.*?)(?=\n## |\Z)',
                sec, re.DOTALL | re.IGNORECASE
            )

        if not ans_match:
            continue

        answer_text = ans_match.group(1).strip()
        if not answer_text:
            continue

        results.append({
            "question_text": question_text,
            "answer_text": answer_text
        })

    return results

def similarity(a, b):
    a_clean = re.sub(r'\s+', ' ', a.strip().lower())
    b_clean = re.sub(r'\s+', ' ', b.strip().lower())
    return SequenceMatcher(None, a_clean, b_clean).ratio()

def best_match(md_text, questions):
    md_clean = strip_prefixes(md_text)
    best_ratio = 0.0
    best_q = None

    for q in questions:
        q_text = q.get("questionText", "")

        r1 = similarity(md_text, q_text)
        q_stripped = strip_prefixes(q_text)
        r2 = similarity(md_clean, q_stripped)
        r3 = 0.92 if len(md_clean) >= 8 and md_clean.lower() in q_text.lower() else 0

        ratio = max(r1, r2, r3)
        if ratio > best_ratio:
            best_ratio = ratio
            best_q = q

    return best_q, best_ratio

def upload_answers(rows):
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

    print(f"  [SUCCESS] Uploaded {success_count}/{len(clean)} answers to mains_answers")
    return success_count

def main():
    all_answers_to_upload = []

    for pair in PAIRS:
        label = pair["label"]
        print(f"\n{'='*60}")
        print(f"  Processing {label}")
        print(f"{'='*60}")

        md_entries = parse_md(pair["md"])
        print(f"  MD parsed: {len(md_entries)} question-answer pairs")

        with open(pair["json"], "r", encoding="utf-8") as f:
            data = json.load(f)
        questions = data.get("questions", [])
        print(f"  JSON loaded: {len(questions)} questions")

        matched = 0
        for md in md_entries:
            best_q, ratio = best_match(md["question_text"], questions)

            if best_q and ratio >= SIMILARITY_THRESHOLD:
                q_id = best_q["id"]
                ans_id = f"{q_id}-model-answer"

                existing = best_q.get("answers", [])
                best_q["answers"] = [a for a in existing if a.get("id") != ans_id]
                best_q["answers"].append({
                    "id": ans_id,
                    "institute": INSTITUTE_LABEL,
                    "answerText": md["answer_text"]
                })

                all_answers_to_upload.append({
                    "id": ans_id,
                    "question_id": q_id,
                    "institute": INSTITUTE_LABEL,
                    "answer_text": md["answer_text"]
                })
                matched += 1

        print(f"  Matched: {matched}/{len(md_entries)}")

        with open(pair["json"], "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  JSON saved.")

    print(f"\n{'='*60}")
    print(f"  Uploading {len(all_answers_to_upload)} total answers to Supabase...")
    upload_answers(all_answers_to_upload)
    print("\nDone!")

if __name__ == "__main__":
    main()
