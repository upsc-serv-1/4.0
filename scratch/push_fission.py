import json
import re
import requests
import sys

sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

filepath = r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 2 - Copy\backup\mains-upsc_anthro_paper_1_2012-2025_compass_updated_v3.json"
backup_path = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\scratch\fission_track_old_backup.txt"

def clean_markdown_content_strict_indent(content):
    content = content.replace('\xa0', ' ')
    content = re.sub(r':\s*<br>\s*\n(\s*[\u2022\-\*])', r':\n\1', content)
    content = re.sub(r';\s*<br>\s*\n(\s*[\u2022\-\*])', r';\n\1', content)
    content = re.sub(r'\.\s*<br>\s*\n(\s*[\u2022\-\*])', r'.\n\1', content)
    content = re.sub(r'<br>\s*\n(\s*[\u2022\-\*])', r'\n\1', content)
    
    # Force standard 4 spaces indentation for the sub-bullet so it renders beautifully in the app
    content = re.sub(r'^[ \t]+\u2022\s*', r'    - ', content, flags=re.MULTILINE)
    
    content = re.sub(r'(^[ \t]*\- .*?)\s*<br>\s*$', r'\1', content, flags=re.MULTILINE)
    return content

def main():
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    for q in data.get("questions", []):
        if "fission track dating method" in q.get("questionText", "").lower():
            for a in q.get("answers", []):
                if a.get("institute") == "Compass":
                    original_text = a.get("answerText", "")
                    
                    # 1. Backup old text
                    with open(backup_path, "w", encoding="utf-8") as bf:
                        bf.write(original_text)
                    print(f"✅ Backed up old version to {backup_path}")
                    
                    # 2. Clean text
                    cleaned_text = clean_markdown_content_strict_indent(original_text)
                    
                    # 3. Push to Supabase
                    ans_id = f"{q.get('id')}-compass"
                    payload = {
                        "id": ans_id,
                        "question_id": q.get("id"),
                        "institute": "Compass",
                        "answer_text": cleaned_text
                    }
                    
                    url = f"{SUPABASE_URL}/rest/v1/mains_answers"
                    resp = requests.post(url, json=[payload], headers=HEADERS, timeout=60)
                    
                    if resp.status_code in [200, 201]:
                        print("✅ Successfully pushed cleaned answer to Supabase!")
                        idx = cleaned_text.find("spontaneous fission")
                        print("\n--- Snippet of the new format ---")
                        print(cleaned_text[max(0, idx-50):idx+200])
                    else:
                        print(f"❌ Failed to push. Status: {resp.status_code}")
                    return

if __name__ == "__main__":
    main()
