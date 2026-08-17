import requests

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

def main():
    ans_id = "2025-gs4-q5-drishti_ias"
    url = f"{SUPABASE_URL}/rest/v1/mains_answers?id=eq.{ans_id}"
    resp = requests.delete(url, headers=HEADERS)
    if resp.status_code in [200, 204]:
        print(f"Successfully deleted answer with ID: {ans_id}")
    else:
        print(f"Failed to delete: {resp.status_code} - {resp.text}")

if __name__ == "__main__":
    main()
