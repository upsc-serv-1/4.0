import os
import json
import requests

json_file = r'c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\UPSC_2026 CSE GS PAPER 1 FORMATTED.json'

with open(json_file, 'r', encoding='utf-8') as f:
    paper_data = json.load(f)

SUPABASE_URL = 'https://rnelxupyiejsqekmcrcz.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ'

HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
}

test_id = paper_data.get('id', 'upsc-cse-pyq-2026-gs1')

test_payload = {
    'id': test_id,
    'title': paper_data.get('title', '2026- Prelims - GS Paper 1 - UPSC'),
    'provider': paper_data.get('institute', 'UPSC'),
    'institute': paper_data.get('institute', 'UPSC'),
    'program_id': paper_data.get('program_id', 'cse'),
    'program_name': paper_data.get('program_name', 'CSE'),
    'launch_year': paper_data.get('launch_year', 2026),
    'series': paper_data.get('series', 'Prelims (Official)'),
    'level': paper_data.get('level', 'GS Paper 1'),
    'year': paper_data.get('launch_year', 2026),
    'subject': paper_data.get('questions', [{}])[0].get('subject', 'General Studies'),
    'paper_type': paper_data.get('paperType', 'test-paper'),
    'question_count': len(paper_data.get('questions', [])),
    'default_minutes': paper_data.get('defaultMinutes', 120),
    'source_mode': paper_data.get('sourceMode', 'docx-sol'),
    'is_demo_available': False,
    'exam_year': paper_data.get('launch_year', 2026),
    'course': 'Civil Services'
}

print(f"1. Upserting test '{test_id}' into 'tests' table...")
resp_test = requests.post(f"{SUPABASE_URL}/rest/v1/tests", headers=HEADERS, json=[test_payload])
if resp_test.status_code not in [200, 201, 204]:
    print(f"[ERROR] Failed to upsert test record: {resp_test.status_code} {resp_test.text}")
    exit(1)
print(f"[OK] Successfully upserted test record: {test_id}")

question_rows = []
for q in paper_data['questions']:
    q_id = q.get('id') or f"{test_id}-q{q['questionNumber']:03d}"
    ei = q.get('exam_info') or {}
    
    stmt_lines = q.get('statementLines') or []
    if isinstance(stmt_lines, list):
        q_text = '\n\n'.join(stmt_lines)
    else:
        q_text = str(stmt_lines)
        
    q_row = {
        'id': q_id,
        'test_id': test_id,
        'question_number': q.get('questionNumber'),
        'question_text': q_text,
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
        'exam': q.get('exam') or ei.get('exam') or 'Prelims',
        'exam_group': q.get('exam_group') or ei.get('group') or 'UPSC CSE',
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
uploaded_q_count = 0

for i in range(0, len(question_rows), batch_size):
    batch = question_rows[i:i + batch_size]
    resp_q = requests.post(f"{SUPABASE_URL}/rest/v1/questions", headers=HEADERS, json=batch)
    if resp_q.status_code not in [200, 201, 204]:
        print(f"[ERROR] Failed to upsert questions batch at index {i}: {resp_q.status_code} {resp_q.text}")
        exit(1)
    uploaded_q_count += len(batch)
    print(f"  [OK] Uploaded batch {i // batch_size + 1}: {uploaded_q_count}/{len(question_rows)} questions")

print(f"\n[SUCCESS] ALL DONE! Successfully sent 2026 UPSC Paper ({test_id}) with {uploaded_q_count} questions to Supabase!")
