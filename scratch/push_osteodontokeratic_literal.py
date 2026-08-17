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

def clean_markdown_content_literal(content):
    # Instead of making them standard nested lists, we will keep them as literal text
    # BUT we will indent the line with 3 normal spaces first!
    # This binds the line to the parent numbered list, preventing the numbering from breaking.
    
    # Example target line: `\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0• **Predator...`
    # We will replace it with: `   \xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0• **Predator...`
    
    # Match start of line, any amount of spaces/tabs/non-breaking spaces, then a bullet
    def replace_with_literal(match):
        original_spaces = match.group(1)
        # Add 3 normal spaces to bind to the parent list, then keep the original spaces and bullet
        return "   " + original_spaces + "\u2022 "
        
    content = re.sub(r'^([\xa0 \t]+)\u2022\s*', replace_with_literal, content, flags=re.MULTILINE)
    return content

def main():
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    for q in data.get("questions", []):
        if q.get("id") == "mains-anthro1-q1035":
            for a in q.get("answers", []):
                if a.get("institute") == "Compass":
                    original_text = a.get("answerText", "")
                    cleaned_text = clean_markdown_content_literal(original_text)
                    
                    ans_id = f"mains-anthro1-q1035-compass"
                    
                    payload = {
                        "id": ans_id,
                        "question_id": "mains-anthro1-q1035",
                        "institute": "Compass",
                        "answer_text": cleaned_text
                    }
                    
                    url = f"{SUPABASE_URL}/rest/v1/mains_answers"
                    resp = requests.post(url, json=[payload], headers=HEADERS, timeout=60)
                    
                    if resp.status_code in [200, 201]:
                        print("✅ Successfully pushed literal formatted answer to Supabase!")
                        idx = cleaned_text.find("Brain argued")
                        print("\n--- Snippet with 3-space binding ---")
                        print(repr(cleaned_text[idx:idx+300]))
                    else:
                        print(f"❌ Failed to push. Status: {resp.status_code}")
                    return

if __name__ == "__main__":
    main()
