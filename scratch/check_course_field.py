import requests

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

url = f"{SUPABASE_URL}/rest/v1/questions?select=course,is_neetpg,is_inicet,is_upsc_cms&limit=5000"
resp = requests.get(url, headers=HEADERS)

if resp.status_code == 200:
    questions = resp.json()
    breakdown = {}
    for q in questions:
        key = (q.get("course"), q.get("is_neetpg"), q.get("is_inicet"), q.get("is_upsc_cms"))
        breakdown[key] = breakdown.get(key, 0) + 1
        
    print("Questions Course Breakdown:")
    for (course, is_neet, is_ini, is_cms), count in breakdown.items():
        print(f"  - Course: {course}, NEET PG: {is_neet}, INI-CET: {is_ini}, UPSC CMS: {is_cms} -> {count} questions")
else:
    print("Error:", resp.text)
