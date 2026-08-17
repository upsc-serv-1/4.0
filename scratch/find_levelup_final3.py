import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

files = [
    r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\mains-upsc_anthro_paper_1_2012-2025_compass_updated_v3.json",
    r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\mains-upsc_anthro_paper_2_2012-2025_compass_updated_v3.json"
]

def main():
    found = False
    for filepath in files:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"Failed to open {filepath}: {e}")
            continue
            
        for q in data.get("questions", []):
            for a in q.get("answers", []):
                if "levelup" in a.get("institute", "").lower():
                    ans_text = a.get("answerText", "")
                    
                    print(f"Question: {q.get('questionText')}")
                    print("\n--- Raw Answer Text ---")
                    print(ans_text[:5000])
                    return
    
    if not found:
        print("Could not find any deep nesting in LevelUp answers.")

if __name__ == "__main__":
    main()
