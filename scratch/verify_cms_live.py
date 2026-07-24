import requests

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Prefer": "count=exact"
}

# 1. Verify Tests count
url_tests = f"{SUPABASE_URL}/rest/v1/tests?program_id=eq.cms&select=id"
resp_tests = requests.get(url_tests, headers=HEADERS)
tests_count = resp_tests.headers.get("content-range", "0/0").split("/")[-1]

# 2. Verify Questions count
url_qs = f"{SUPABASE_URL}/rest/v1/questions?is_upsc_cms=eq.true&select=id"
resp_qs = requests.get(url_qs, headers=HEADERS)
qs_count = resp_qs.headers.get("content-range", "0/0").split("/")[-1]

print(f"Verified live in Supabase:")
print(f"  Tests with program_id = 'cms': {tests_count}")
print(f"  Questions with is_upsc_cms = true: {qs_count}")
