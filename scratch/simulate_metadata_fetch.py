import requests

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

# The exact query executed by fetchMetadata in arena.tsx
# .from('questions')
# .select('course, subject, section_group, micro_topic, sub_topic, test_id, id, exam_category, exam_stage, tests(series, institute, program_name, title)')
# .eq('course', 'Medical Science')
# .not('subject', 'is', null)
# .limit(5000)

url = f"{SUPABASE_URL}/rest/v1/questions?course=eq.Medical%20Science&subject=not.is.null&select=course,subject,section_group,micro_topic,sub_topic,test_id,id,exam_category,exam_stage,tests(series,institute,program_name,title)&limit=5000"
resp = requests.get(url, headers=HEADERS)

print("Status:", resp.status_code)
if resp.status_code == 200:
    questions = resp.json()
    print(f"Total questions returned: {len(questions)}")
    
    institutes_found = {}
    missing_test_relation = 0
    null_test_id = 0
    
    for q in questions:
        test_id = q.get("test_id")
        if not test_id:
            null_test_id += 1
            continue
            
        test_obj = q.get("tests")
        if not test_obj:
            missing_test_relation += 1
            continue
            
        # Handle list if it's returned as a list
        if isinstance(test_obj, list):
            test_obj = test_obj[0] if test_obj else None
            
        inst = test_obj.get("institute") if test_obj else None
        institutes_found[str(inst)] = institutes_found.get(str(inst), 0) + 1
        
    print("\nBreakdown of institutes from fetched metadata:")
    for inst, count in institutes_found.items():
        print(f"  - Institute: {inst} -> {count} questions")
        
    print(f"\nNull test_id: {null_test_id}")
    print(f"Missing tests join record: {missing_test_relation}")
else:
    print("Error:", resp.text)
