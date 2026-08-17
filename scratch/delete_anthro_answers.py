import os
import json
import requests
import time

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

target_files = [
    r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro1_new_consolidated.json",
    r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro2_new_consolidated.json"
]

def main():
    # Collect all question IDs from both files
    all_q_ids = []
    for filepath in target_files:
        filename = os.path.basename(filepath)
        print(f"Reading {filename}...")
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        for q in data.get("questions", []):
            q_id = q.get("id")
            if q_id:
                all_q_ids.append(q_id)

    print(f"Collected {len(all_q_ids)} question IDs.")
    
    # Delete in batches of 100 using the `in` filter on question_id
    batch_size = 100
    total_batches = (len(all_q_ids) + batch_size - 1) // batch_size
    
    for i in range(0, len(all_q_ids), batch_size):
        batch_ids = all_q_ids[i:i+batch_size]
        ids_str = ",".join(batch_ids)
        url = f"{SUPABASE_URL}/rest/v1/mains_answers?question_id=in.({ids_str})"
        batch_num = i // batch_size + 1
        
        try:
            resp = requests.delete(url, headers=HEADERS, timeout=60)
            if resp.status_code in [200, 204]:
                print(f"  Batch {batch_num}/{total_batches}: OK Deleted")
            else:
                print(f"  Batch {batch_num}/{total_batches}: WARNING {resp.status_code} - {resp.text}")
        except Exception as e:
            print(f"  Batch {batch_num}/{total_batches}: ERROR: {e}")

    print(f"\nDone! Answers for all {len(all_q_ids)} question IDs deleted from mains_answers.")

if __name__ == "__main__":
    main()
