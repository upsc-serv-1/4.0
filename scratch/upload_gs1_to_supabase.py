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

file_path = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\UPSC_2026 CSE GS PAPER 1 FORMATTED.json"

with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

test_id = data["id"]
questions = data["questions"]

# 1. Upsert test record (using exact same schema as working CSAT upload)
test_payload = {
    'id': test_id,
    'title': data.get('title'),
    'provider': data.get('institute', 'UPSC'),
    'institute': data.get('institute', 'UPSC'),
    'program_id': data.get('program_id', 'cse'),
    'program_name': data.get('program_name', 'CSE'),
    'launch_year': data.get('launch_year', 2026),
    'series': data.get('series'),
    'level': data.get('level'),
    'year': data.get('launch_year', 2026),
    'subject': 'GS Paper 1',
    'paper_type': data.get('paperType', 'test-paper'),
    'question_count': len(questions),
    'default_minutes': data.get('defaultMinutes', 120),
    'source_mode': data.get('sourceMode', 'docx-sol'),
    'is_demo_available': False,
    'exam_year': data.get('launch_year', 2026),
    'course': 'Civil Services'
}

print(f"1. Upserting test '{test_id}' into 'tests' table...")
resp = requests.post(f"{SUPABASE_URL}/rest/v1/tests", headers=HEADERS, json=[test_payload])
if resp.status_code not in [200, 201, 204]:
    print(f"[ERROR] Failed to upsert test record: {resp.status_code} {resp.text}")
    exit(1)
print(f"[OK] Successfully upserted test record: {test_id}")

# 2. Upsert questions in batches
question_rows = []
for q in questions:
    q_id = q.get('id') or f"{test_id}-q{q['questionNumber']:03d}"
    ei = q.get('exam_info') or {}
    
    stmt_lines = q.get('statementLines') or []

    q_row = {
        'id': q_id,
        'test_id': test_id,
        'question_number': q.get('questionNumber'),
        'question_text': q.get('questionText', ''),
        'statement_lines': stmt_lines,
        'options': q.get('options'),
        'correct_answer': q.get('correctAnswer'),
        'explanation_markdown': q.get('explanationMarkdown'),
        'source_attribution_label': q.get('source_attribution_label', 'CSE 2026'),
        'source': ei,
        'subject': q.get('subject'),
        'section_group': q.get('sectionGroup'),
        'micro_topic': q.get('microTopic'),
        'sub_topic': q.get('subtopic'),
        'is_pyq': True,
        'is_ncert': False,
        'is_upsc_cse': True,
        'is_upsc_cms': False,
        'is_neetpg': False,
        'is_inicet': False,
        'is_allied': False,
        'is_others': False,
        'is_cancelled': False,
        'exam': ei.get('exam', 'Prelims'),
        'exam_group': ei.get('group', 'UPSC CSE'),
        'exam_year': 2026,
        'exam_category': 'cse',
        'specific_exam': None,
        'exam_stage': 'prelims',
        'exam_paper': 'pre_gs1',
        'course': 'Civil Services'
    }
    question_rows.append(q_row)

print(f"2. Upserting {len(question_rows)} questions into 'questions' table in batches...")
batch_size = 25
uploaded = 0

for i in range(0, len(question_rows), batch_size):
    batch = question_rows[i:i + batch_size]
    resp = requests.post(f"{SUPABASE_URL}/rest/v1/questions", headers=HEADERS, json=batch)
    if resp.status_code not in [200, 201, 204]:
        print(f"[ERROR] Batch {i//batch_size + 1}: {resp.status_code} {resp.text[:300]}")
        exit(1)
    uploaded += len(batch)
    print(f"  [OK] Uploaded batch {i//batch_size + 1}: {uploaded}/{len(question_rows)} questions")

print(f"\n[SUCCESS] ALL DONE! GS 2026 Paper 1 ({test_id}) uploaded to Supabase with {uploaded} questions!")
