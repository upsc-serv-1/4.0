import requests

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

def main():
    q_id = "mains-gs4-2025-q131"
    url = f"{SUPABASE_URL}/rest/v1/mains_answers?question_id=eq.{q_id}"
    resp = requests.get(url, headers=HEADERS)
    if resp.status_code == 200:
        answers = resp.json()
        print(f"Found {len(answers)} answers for question {q_id}:")
        for idx, ans in enumerate(answers):
            print(f"\n--- Answer {idx+1} ---")
            print(f"ID: {ans.get('id')}")
            print(f"Question ID: {ans.get('question_id')}")
            print(f"Institute: {ans.get('institute')}")
            print(f"Snippet: {ans.get('answer_text')[:200]}...")
    else:
        print(f"Error fetching answers: {resp.status_code} - {resp.text}")

if __name__ == "__main__":
    main()
