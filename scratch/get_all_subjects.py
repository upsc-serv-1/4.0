import requests

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

all_rows = []
from_idx = 0
page_size = 1000

while True:
    url_page = f"{SUPABASE_URL}/rest/v1/mains_questions?select=id,subject,paper,exam_year&limit={page_size}&offset={from_idx}"
    resp_page = requests.get(url_page, headers=HEADERS)
    if resp_page.status_code != 200:
        print("Error status:", resp_page.status_code)
        break
    data = resp_page.json()
    if not data:
        break
    all_rows.extend(data)
    if len(data) < page_size:
        break
    from_idx += page_size

print(f"Total questions in mains_questions table: {len(all_rows)}")

subject_counts = {}
for r in all_rows:
    s = r.get("subject") or "NULL"
    subject_counts[s] = subject_counts.get(s, 0) + 1

print("\nAll Subject Counts:")
for s, count in sorted(subject_counts.items(), key=lambda x: x[1], reverse=True):
    print(f"  {s}: {count}")
