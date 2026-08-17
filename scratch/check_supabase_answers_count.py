import requests

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

def main():
    print("Fetching Anthropology answer counts from Supabase...")
    # Fetch all answers for mains-anthro questions
    url = f"{SUPABASE_URL}/rest/v1/mains_answers?question_id=like.mains-anthro*&select=institute"
    resp = requests.get(url, headers=HEADERS)
    if resp.status_code == 200:
        answers = resp.json()
        counts = {}
        for a in answers:
            inst = a.get("institute")
            counts[inst] = counts.get(inst, 0) + 1
        print("\nSupabase Database Answer Counts:")
        for inst, count in counts.items():
            print(f"  - {inst}: {count} answers")
        print(f"  - Total answers: {len(answers)}")
    else:
        print(f"Error fetching counts: {resp.status_code} - {resp.text}")

if __name__ == "__main__":
    main()
