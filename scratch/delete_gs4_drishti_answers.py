import requests

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

def main():
    # 1. Fetch all GS4 question IDs
    print("Fetching GS4 question IDs from public.mains_questions...")
    q_url = f"{SUPABASE_URL}/rest/v1/mains_questions?paper=eq.GS4&select=id"
    resp = requests.get(q_url, headers=HEADERS)
    if resp.status_code != 200:
        print(f"Error fetching questions: {resp.status_code} - {resp.text}")
        return
        
    questions = resp.json()
    gs4_ids = [q['id'] for q in questions if 'id' in q]
    print(f"Found {len(gs4_ids)} GS4 questions in database.")
    
    if not gs4_ids:
        print("No GS4 questions found. Exiting.")
        return
        
    # 2. Delete GS4 Drishti IAS answers in batches of 100
    print("Deleting Drishti IAS answers for these questions...")
    batch_size = 100
    deleted_count = 0
    
    for i in range(0, len(gs4_ids), batch_size):
        batch = gs4_ids[i:i+batch_size]
        ids_str = ",".join(batch)
        del_url = f"{SUPABASE_URL}/rest/v1/mains_answers?question_id=in.({ids_str})&institute=eq.Drishti IAS"
        
        # We prefer return=representation to see what was deleted
        headers = HEADERS.copy()
        headers["Prefer"] = "return=representation"
        
        del_resp = requests.delete(del_url, headers=headers)
        if del_resp.status_code in [200, 204]:
            if del_resp.status_code == 200:
                deleted_rows = del_resp.json()
                deleted_count += len(deleted_rows)
            else:
                deleted_count += len(batch) # fallback estimate
        else:
            print(f"Error deleting batch starting at index {i}: {del_resp.status_code} - {del_resp.text}")
            
    print(f"Done! Successfully deleted {deleted_count} Drishti IAS GS4 answers.")

if __name__ == "__main__":
    main()
