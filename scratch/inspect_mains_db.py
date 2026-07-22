import requests

SUPABASE_URL = "https://ngwsuqzkndlxfoantnlf.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd3N1cXprbmRseGZvYW50bmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjA0NjAsImV4cCI6MjA5Mjc5NjQ2MH0.u9-dnMmLXr_5fF243uzx6WyE_vR6dzERDuyFuF-HeZk"
HEADERS = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}

# Sample from mains_questions
resp = requests.get(f"{SUPABASE_URL}/rest/v1/mains_questions?limit=5", headers=HEADERS)
print("Status:", resp.status_code)
if resp.status_code == 200:
    rows = resp.json()
    if rows:
        print("COLUMNS & SAMPLE VALUES in mains_questions:")
        for k, v in rows[0].items():
            print(f"  {k}: {repr(v)[:80]}")
            
# Check distinct values of is_upsc_cse, course, subject
resp_cse = requests.get(f"{SUPABASE_URL}/rest/v1/mains_questions?select=is_upsc_cse,course,subject,exam_category,stage&limit=50", headers=HEADERS)
if resp_cse.status_code == 200:
    print("\nSAMPLE ROWS (first 5):")
    for r in resp_cse.json()[:5]:
        print(" ", r)
