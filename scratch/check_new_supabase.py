import requests

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

# 1. Total counts by subject in mains_questions
url = f"{SUPABASE_URL}/rest/v1/mains_questions?select=subject,paper,is_pyq,is_upsc_cse&limit=2000"
resp = requests.get(url, headers=HEADERS)

print("Status:", resp.status_code)
if resp.status_code == 200:
    data = resp.json()
    print(f"Fetched {len(data)} rows from mains_questions:")
    
    subject_counts = {}
    paper_counts = {}
    for r in data:
        subj = r.get("subject", "None")
        p = r.get("paper", "None")
        subject_counts[subj] = subject_counts.get(subj, 0) + 1
        paper_counts[p] = paper_counts.get(p, 0) + 1
        
    print("\nSubject Counts:")
    for k, v in subject_counts.items():
        print(f"  {k}: {v}")
        
    print("\nPaper Counts:")
    for k, v in paper_counts.items():
        print(f"  {k}: {v}")
else:
    print("Error:", resp.text)
