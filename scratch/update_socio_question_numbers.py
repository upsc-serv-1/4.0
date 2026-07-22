import json
import os
import shutil

dirs = [
    r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files",
    r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\admin-panel\mains-json"
]

files = [
    "mains_socio1_new_consolidated.json",
    "mains_socio2_new_consolidated.json"
]

for d in dirs:
    for fname in files:
        fpath = os.path.join(d, fname)
        if not os.path.exists(fpath):
            continue
            
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        questions = data.get("questions", [])
        for idx, q in enumerate(questions):
            q["questionNumber"] = idx + 1
            
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        print(f"[OK] Updated question numbers (1..{len(questions)}) in {fpath}")
