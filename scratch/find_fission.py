import json
import re

filepath = r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 2 - Copy\backup\mains-upsc_anthro_paper_1_2012-2025_compass_updated_v3.json"

def main():
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    for q in data.get("questions", []):
        if "fission" in q.get("questionText", "").lower():
            print(f"Found: {q.get('questionText')}")
            for a in q.get("answers", []):
                if a.get("institute") == "Compass":
                    print("Found Compass answer!")
                    # Check original formatting
                    ans = a.get("answerText", "")
                    idx = ans.lower().find("spontaneous fission")
                    print(repr(ans[max(0, idx-50):idx+250]))

if __name__ == "__main__":
    main()
