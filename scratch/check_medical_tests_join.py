import requests

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

# Query a few medical questions with their test joins
url = f"{SUPABASE_URL}/rest/v1/questions?course=eq.Medical_Science&select=id,test_id,subject,is_neetpg,is_inicet,tests(id,series,institute,program_name,title)&limit=10"
# Note: course is stored as 'Medical Science' (with space)
url_space = f"{SUPABASE_URL}/rest/v1/questions?course=eq.Medical%20Science&select=id,test_id,subject,is_neetpg,is_inicet,tests(id,series,institute,program_name,title)&limit=10"

resp = requests.get(url_space, headers=HEADERS)
print("Status:", resp.status_code)
if resp.status_code == 200:
    rows = resp.json()
    print(f"Sample medical questions ({len(rows)}):")
    for idx, r in enumerate(rows):
        print(f"\n[{idx+1}] Question ID: {r.get('id')}, test_id: {r.get('test_id')}, is_neetpg: {r.get('is_neetpg')}, is_inicet: {r.get('is_inicet')}")
        print(f"    Tests join: {r.get('tests')}")
else:
    print("Error:", resp.text)
