import requests

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

# Fetch one row from questions
resp_q = requests.get(f"{SUPABASE_URL}/rest/v1/questions?limit=1", headers=HEADERS)
if resp_q.status_code == 200:
    print("Questions Columns:")
    for k in sorted(resp_q.json()[0].keys()):
        print(f"  - {k}")
else:
    print("Questions Error:", resp_q.text)

# Fetch one row from tests
resp_t = requests.get(f"{SUPABASE_URL}/rest/v1/tests?limit=1", headers=HEADERS)
if resp_t.status_code == 200:
    print("\nTests Columns:")
    for k in sorted(resp_t.json()[0].keys()):
        print(f"  - {k}")
else:
    print("Tests Error:", resp_t.text)
