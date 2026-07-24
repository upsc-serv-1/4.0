import requests

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Prefer": "count=exact"
}

# Check counts with is_pyq filter
url_neet_pyq = f"{SUPABASE_URL}/rest/v1/questions?is_neetpg=eq.true&is_pyq=eq.true&select=id"
resp_neet = requests.get(url_neet_pyq, headers=HEADERS)
neet_pyq_count = resp_neet.headers.get("content-range", "0/0").split("/")[-1]

url_ini_pyq = f"{SUPABASE_URL}/rest/v1/questions?is_inicet=eq.true&is_pyq=eq.true&select=id"
resp_ini = requests.get(url_ini_pyq, headers=HEADERS)
ini_pyq_count = resp_ini.headers.get("content-range", "0/0").split("/")[-1]

print(f"NEET PG questions with is_pyq=true: {neet_pyq_count}")
print(f"INI-CET questions with is_pyq=true: {ini_pyq_count}")
