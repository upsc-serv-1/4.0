import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

filepath = r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 2 - Copy\backup\mains-upsc_anthro_paper_1_2012-2025_compass_updated_v3.json"

def main():
    if not os.path.exists(filepath):
        print("File not found")
        return
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    for q in data.get("questions", []):
        if q.get("id") == "mains-anthro1-q1035":
            for a in q.get("answers", []):
                if a.get("institute") == "Compass":
                    text = a.get("answerText", "")
                    print("--- Raw Answer text with escaped characters ---")
                    print(repr(text))
                    print("\n--- Raw Lines ---")
                    lines = text.split("\n")
                    for i, l in enumerate(lines):
                        print(f"Line {i+1:02d}: {repr(l)}")
                    return

if __name__ == "__main__":
    main()
