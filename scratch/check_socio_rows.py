import requests

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

url = f"{SUPABASE_URL}/rest/v1/mains_questions?subject=eq.Sociology&select=id,question_number,paper,is_pyq,is_upsc_cse,exam_group,stage,course,institute,exam_year&limit=10"
resp = requests.get(url, headers=HEADERS)

print("Status:", resp.status_code)
if resp.status_code == 200:
    rows = resp.json()
    print(f"Sample Sociology rows ({len(rows)}):")
    for r in rows:
        print(" ", r)

# Check count of Sociology questions with is_pyq=true vs is_pyq=false
url_true = f"{SUPABASE_URL}/rest/v1/mains_questions?subject=eq.Sociology&is_pyq=eq.true&select=id"
resp_true = requests.get(url_true, headers={**HEADERS, "Prefer": "count=exact"})
cnt_true = resp_true.headers.get("content-range", "0/0").split("/")[-1]

url_false = f"{SUPABASE_URL}/rest/v1/mains_questions?subject=eq.Sociology&is_pyq=eq.false&select=id"
resp_false = requests.get(url_false, headers={**HEADERS, "Prefer": "count=exact"})
cnt_false = resp_false.headers.get("content-range", "0/0").split("/")[-1]

print(f"\nSociology Qs with is_pyq=true: {cnt_true}")
print(f"Sociology Qs with is_pyq=false: {cnt_false}")

# Check count of Sociology questions with is_upsc_cse=true vs is_upsc_cse=false
url_cse_true = f"{SUPABASE_URL}/rest/v1/mains_questions?subject=eq.Sociology&is_upsc_cse=eq.true&select=id"
resp_cse_true = requests.get(url_cse_true, headers={**HEADERS, "Prefer": "count=exact"})
cnt_cse_true = resp_cse_true.headers.get("content-range", "0/0").split("/")[-1]

url_cse_false = f"{SUPABASE_URL}/rest/v1/mains_questions?subject=eq.Sociology&is_upsc_cse=eq.false&select=id"
resp_cse_false = requests.get(url_cse_false, headers={**HEADERS, "Prefer": "count=exact"})
cnt_cse_false = resp_cse_false.headers.get("content-range", "0/0").split("/")[-1]

print(f"\nSociology Qs with is_upsc_cse=true: {cnt_cse_true}")
print(f"Sociology Qs with is_upsc_cse=false: {cnt_cse_false}")
