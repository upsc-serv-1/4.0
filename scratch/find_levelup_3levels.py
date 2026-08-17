import json
import re

files = [
    r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 2 - Copy\backup\mains-upsc_anthro_paper_1_2012-2025_consolidated_with_levelpanswers.json",
    r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 2 - Copy\backup\mains-upsc_anthro_paper_2_2012-2025_consolidated_with_levelpanswers.json"
]

def main():
    found_any = False
    
    for filepath in files:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            continue
            
        for q in data.get("questions", []):
            for a in q.get("answers", []):
                if a.get("institute", "").lower() == "levelup":
                    ans_text = a.get("answerText", "")
                    
                    # Look for 8 or more spaces (or non-breaking spaces) followed by any non-whitespace
                    match = re.search(r'(^[\xa0 \t]{8,}[^\s].*$)', ans_text, flags=re.MULTILINE)
                    if match:
                        print(f"Found 3-level bullet in LevelUp answer for Question: {q.get('questionText')}")
                        idx = match.start()
                        print("\n--- Snippet ---")
                        # Show some context around it
                        print(ans_text[max(0, idx-150):idx+250])
                        print("-" * 50)
                        found_any = True
                        # Just print the first one we find
                        if found_any:
                            return

    if not found_any:
        print("Could not find any LevelUp answer with 3 levels of nested bullets.")

if __name__ == "__main__":
    main()
