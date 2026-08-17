import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

files = [
    r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 2 - Copy\backup\mains-upsc_anthro_paper_1_2012-2025_compass_updated_v3.json",
    r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 2 - Copy\backup\mains-upsc_anthro_paper_2_2012-2025_compass_updated_v3.json"
]

def main():
    for filepath in files:
        if not os.path.exists(filepath):
            continue
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        questions = data.get("questions", [])
        for q in questions:
            q_text = q.get("questionText", "")
            answers = q.get("answers", [])
            for a in answers:
                text = a.get("answerText", "")
                if "C.K. Brain" in text:
                    print(f"\nFOUND MATCH IN: {os.path.basename(filepath)}")
                    print(f"Question ID: {q.get('id')}")
                    print(f"Question: {q_text[:120]}...")
                    print(f"Institute: {a.get('institute')}")
                    print("--- Snippet of text containing C.K. Brain ---")
                    idx = text.find("C.K. Brain")
                    start = max(0, idx - 100)
                    end = min(len(text), idx + 2000)
                    print(text[start:end])
                    print("-------------------------------------------\n")

if __name__ == "__main__":
    main()
