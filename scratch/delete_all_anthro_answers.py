import requests

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

def main():
    print("Starting deletion of Anthropology answers (Levelup IAS and Compass Institute) from Supabase...")
    
    deleted_total = 0
    for prefix in ["mains-anthro1", "mains-anthro2"]:
        # We query with Prefer: return=representation to see how many were deleted
        url = f"{SUPABASE_URL}/rest/v1/mains_answers?question_id=like.{prefix}*&institute=in.(\"Levelup IAS\",\"Compass Institute\")"
        
        headers = HEADERS.copy()
        headers["Prefer"] = "return=representation"
        
        resp = requests.delete(url, headers=headers)
        if resp.status_code in [200, 204]:
            if resp.status_code == 200:
                deleted_rows = resp.json()
                print(f"  [SUCCESS] Deleted {len(deleted_rows)} answers for prefix {prefix}")
                deleted_total += len(deleted_rows)
            else:
                print(f"  [SUCCESS] Deleted answers for prefix {prefix} (status 204)")
        else:
            print(f"  [ERROR] Failed to delete for prefix {prefix}: {resp.status_code} - {resp.text}")
            
    print(f"\nDone! Successfully deleted a total of {deleted_total} Anthropology answers from Supabase.")

if __name__ == "__main__":
    main()
