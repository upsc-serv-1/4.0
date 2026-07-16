import json
import os

files = [
    r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro1_new_consolidated.json",
    r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro2_new_consolidated.json",
    r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro1_pre2012.json",
    r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro2_pre2012.json"
]

for f_path in files:
    if os.path.exists(f_path):
        with open(f_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            questions = data.get("questions", [])
            print(f"{os.path.basename(f_path)}: {len(questions)} questions")
    else:
        print(f"{os.path.basename(f_path)} does not exist")
