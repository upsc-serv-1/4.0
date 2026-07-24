import requests

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

url = f"{SUPABASE_URL}/rest/v1/tests?select=id,title,program_id,institute,course&limit=1000"
resp = requests.get(url, headers=HEADERS)

print("Status:", resp.status_code)
if resp.status_code == 200:
    tests = resp.json()
    print(f"Total tests: {len(tests)}")
    
    breakdown = {}
    for t in tests:
        key = (t.get("course"), t.get("program_id"), t.get("institute"))
        breakdown[key] = breakdown.get(key, 0) + 1
        
    print("\nTests Table Breakdown:")
    for (course, program_id, institute), count in breakdown.items():
        print(f"  - Course: {course}, Program ID: {program_id}, Institute: {institute} -> {count} tests")
else:
    print("Error:", resp.text)
