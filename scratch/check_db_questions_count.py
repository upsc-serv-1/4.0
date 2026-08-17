import requests

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

def main():
    print("Checking questions count in public.mains_questions...")
    q_url = f"{SUPABASE_URL}/rest/v1/mains_questions?select=id"
    headers = HEADERS.copy()
    headers["Prefer"] = "count=exact"
    resp = requests.get(q_url, headers=headers)
    if resp.status_code == 200:
        total = len(resp.json())
        print(f"Total questions in database: {total}")
        if total > 0:
            print(f"First question sample ID: {resp.json()[0]['id']}")
    else:
        print(f"Error: {resp.status_code} - {resp.text}")

    print("Checking answers count in public.mains_answers...")
    a_url = f"{SUPABASE_URL}/rest/v1/mains_answers?select=id"
    resp2 = requests.get(a_url, headers=headers)
    if resp2.status_code == 200:
        print(f"Total answers in database: {len(resp2.json())}")
    else:
        print(f"Error: {resp2.status_code} - {resp2.text}")

if __name__ == "__main__":
    main()
