import json
import re

files = [
    r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 2 - Copy\backup\mains-upsc_anthro_paper_1_2012-2025_consolidated_with_levelpanswers.json",
    r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 2 - Copy\backup\mains-upsc_anthro_paper_2_2012-2025_consolidated_with_levelpanswers.json"
]

def main():
    count = 0
    
    for filepath in files:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            continue
            
        for q in data.get("questions", []):
            for a in q.get("answers", []):
                if a.get("institute", "").lower() == "levelup ias":
                    ans_text = a.get("answerText", "")
                    
                    print(f"Question: {q.get('questionText')}")
                    print("\n--- Raw Answer Text ---")
                    print(ans_text[:1000])
                    return
        print("Could not find ANY LevelUp answer with indented bullets!")

if __name__ == "__main__":
    main()
