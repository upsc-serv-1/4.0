import requests

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

url = f"{SUPABASE_URL}/rest/v1/questions?course=eq.Medical Science&select=id,exam_category,is_neetpg,is_inicet,is_upsc_cms,test_id,tests(id,institute,program_name,series)&limit=5000"
r = requests.get(url, headers=HEADERS)
qs = r.json()
print("Total loaded:", len(qs))
counts = {}
for q in qs:
    t = q.get("tests") or {}
    if isinstance(t, list):
        t = t[0] if len(t) > 0 else {}
    inst = t.get("institute")
    cat = q.get("exam_category")
    key = (inst, cat)
    counts[key] = counts.get(key, 0) + 1

print("Institutes & Exam Category breakdown:")
for k, v in counts.items():
    print(f"  - Institute: {k[0]}, Category: {k[1]} -> {v} questions")
