import json
import os
import sys
import requests

sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = 'https://rnelxupyiejsqekmcrcz.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ'

HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
}

FILE_PATH = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_gs4_consolidated.json"

with open(FILE_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

questions = data['questions']

def upsert_batch(table, rows, batch_size=25):
    total = len(rows)
    uploaded = 0
    for i in range(0, total, batch_size):
        batch = rows[i:i + batch_size]
        r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=HEADERS, json=batch)
        if r.status_code not in (200, 201, 204):
            print(f"  [ERROR] {table} batch {i//batch_size + 1}: {r.status_code} – {r.text[:300]}")
            return False
        uploaded += len(batch)
        print(f"  [OK] {table} batch {i//batch_size + 1}: {uploaded}/{total}")
    return True

# -------------------------------------------------------------------
# 1. Build mains_questions rows
# -------------------------------------------------------------------
question_rows = []
for q in questions:
    ei = q.get('exam_info') or {}
    question_rows.append({
        'id'                     : q['id'],
        'question_number'        : str(q.get('questionNumber', '')),
        'question_text'          : q.get('questionText', ''),
        'marks'                  : q.get('marks'),
        'exam_year'              : q.get('year') or ei.get('year'),
        'paper'                  : ei.get('paper', 'mains_gs4'),
        'subject'                : q.get('subject'),
        'section_group'          : q.get('sectionGroup'),
        'microtopic'             : q.get('microTopic'),
        'subtopic'               : q.get('subTopic'),
        'nanotopic'              : None,
        'hierarchy_path'         : q.get('hierarchy_path'),
        'macrotag'               : q.get('macrotag'),
        'microtag'               : q.get('microtag'),
        'is_pyq'                 : ei.get('isPyq', True),
        'source_attribution_label': q.get('source_attribution_label'),
        'exam_info'              : ei,
        'stage'                  : ei.get('stage', 'mains'),
        'exam'                   : ei.get('exam', 'Mains'),
        'exam_group'             : ei.get('group', 'UPSC CSE'),
        'is_upsc_cse'            : ei.get('is_upsc_cse', True),
        'is_allied'              : ei.get('is_allied', False),
        'is_others'              : ei.get('is_others', False),
        'exam_category'          : ei.get('exam_category', 'cse'),
        'course'                 : data.get('course', 'Civil Services'),
        'institute'              : data.get('institute', 'UPSC'),
        'program_id'             : data.get('program_id', 'cse'),
        'program_name'           : data.get('program_name', 'CSE'),
        'status'                 : 'published',
    })

# -------------------------------------------------------------------
# 2. Build mains_answers rows  (deduplicate + auto-generate missing IDs)
# -------------------------------------------------------------------
answer_rows = []
seen_ids = set()
for q in questions:
    q_id = q['id']
    for idx, ans in enumerate(q.get('answers', [])):
        ans_id = ans.get('id', '').strip()
        # Generate an ID if missing or empty
        if not ans_id:
            institute_slug = (ans.get('institute') or 'unknown').lower().replace(' ', '_')
            ans_id = f"{q_id}-{institute_slug}-{idx}"
        # Deduplicate within the batch
        original = ans_id
        counter = 1
        while ans_id in seen_ids:
            ans_id = f"{original}-dup{counter}"
            counter += 1
        seen_ids.add(ans_id)
        answer_rows.append({
            'id'          : ans_id,
            'question_id' : q_id,
            'institute'   : ans.get('institute'),
            'answer_text' : ans.get('answerText', ''),
        })

print(f"Total questions: {len(question_rows)}")
print(f"Total answers:   {len(answer_rows)}")
print()

# -------------------------------------------------------------------
# 3. Upload questions to mains_questions
# -------------------------------------------------------------------
print("1. Upserting questions → mains_questions ...")
ok = upsert_batch('mains_questions', question_rows)
if not ok:
    print("[ABORT] Questions upload failed.")
    exit(1)
print(f"[OK] {len(question_rows)} questions uploaded.\n")

# -------------------------------------------------------------------
# 4. Upload answers to mains_answers
# -------------------------------------------------------------------
print("2. Upserting answers → mains_answers ...")
ok = upsert_batch('mains_answers', answer_rows)
if not ok:
    print("[ABORT] Answers upload failed.")
    exit(1)
print(f"[OK] {len(answer_rows)} answers uploaded.\n")

print(f"[SUCCESS] mains_gs4_consolidated → {len(question_rows)} questions + {len(answer_rows)} answers uploaded to Supabase!")
