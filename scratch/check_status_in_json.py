import requests

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

def main():
    print("Checking for draft Anthropology questions in Supabase...")
    # Check for any draft optional questions
    url = f"{SUPABASE_URL}/rest/v1/mains_questions?paper=eq.Optional&status=eq.draft&select=id"
    resp = requests.get(url, headers=HEADERS)
    if resp.status_code == 200:
        rows = resp.json()
        print(f"  Total Optional draft questions: {len(rows)}")
    else:
        print(f"  Error: {resp.status_code} - {resp.text}")

    print("Checking for published Anthropology questions in Supabase...")
    # Check for published optional questions starting with mains-anthro
    url2 = f"{SUPABASE_URL}/rest/v1/mains_questions?paper=eq.Optional&status=eq.published&id=like.mains-anthro*&select=id"
    resp2 = requests.get(url2, headers=HEADERS)
    if resp2.status_code == 200:
        rows2 = resp2.json()
        print(f"  Total published Anthropology questions: {len(rows2)}")
    else:
        print(f"  Error: {resp2.status_code} - {resp2.text}")

if __name__ == "__main__":
    main()
