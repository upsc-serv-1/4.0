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
    print("1. Cleaning JSON files (removing answers with institute == 'Model Answer')...")
    total_removed = 0
    remaining_answers_count = 0

    for filepath in target_files:
        filename = os.path.basename(filepath)
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        removed_in_file = 0
        file_remaining = 0

        for q in data.get("questions", []):
            answers = q.get("answers", [])
            new_answers = [ans for ans in answers if ans.get("institute") != "Model Answer"]
            removed_in_file += (len(answers) - len(new_answers))
            file_remaining += len(new_answers)
            q["answers"] = new_answers

        total_removed += removed_in_file
        remaining_answers_count += file_remaining

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"  {filename}: Removed {removed_in_file} 'Model Answer' entries. Remaining answers: {file_remaining}")

    print(f"Total 'Model Answer' entries removed from JSON files: {total_removed}")

    print("\n2. Deleting 'Model Answer' rows from Supabase (public.mains_answers)...")
    delete_url = f"{SUPABASE_URL}/rest/v1/mains_answers?institute=eq.Model%20Answer"
    
    for attempt in range(5):
        try:
            resp = requests.delete(delete_url, headers=HEADERS, timeout=60)
            if resp.status_code in [200, 204]:
                print("  Successfully deleted all 'Model Answer' rows from Supabase.")
                break
            else:
                print(f"  [WARNING] Delete returned {resp.status_code}: {resp.text}. Retrying in 5s...")
                time.sleep(5)
        except Exception as e:
            print(f"  [RETRY] Attempt {attempt+1}/5 failed: {e}. Retrying in 5s...")
            time.sleep(5)

    print("\nDone! All 'Model Answer' entries have been removed.")

if __name__ == "__main__":
    main()
