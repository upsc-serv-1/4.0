import json
import os

files = [
    r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 2 - Copy\backup\mains-upsc_anthro_paper_1_2012-2025_compass_updated_v3.json",
    r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 2 - Copy\backup\mains-upsc_anthro_paper_2_2012-2025_compass_updated_v3.json"
]

for filepath in files:
    print(f"\nInspecting: {os.path.basename(filepath)}")
    if not os.path.exists(filepath):
        print("  File not found!")
        continue
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    questions = data.get("questions", [])
    total_answers = 0
    institutes = {}
    
    for q in questions:
        answers = q.get("answers", [])
        total_answers += len(answers)
        for a in answers:
            inst = a.get("institute")
            institutes[inst] = institutes.get(inst, 0) + 1
            
    print(f"  Total questions: {len(questions)}")
    print(f"  Total answers: {total_answers}")
    print(f"  Answer counts by Institute: {institutes}")
    if questions:
        print(f"  First question ID: {questions[0].get('id')}")
