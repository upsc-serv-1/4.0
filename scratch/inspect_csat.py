import os
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

workspace_dir = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2"

found = []
for root, dirs, files in os.walk(workspace_dir):
    if "node_modules" in root:
        continue
    for file in files:
        if file.endswith(".json"):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                if "List-I" in content or "List - I" in content:
                    found.append(path)
            except Exception as e:
                pass

print("Found files:", found)
for path in found[:3]:
    print("\nFile:", path)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    # Search for List-I in questions
    if isinstance(data, dict) and "questions" in data:
        for q in data["questions"]:
            q_text = q.get("questionText", "")
            if "List-I" in q_text or "List - I" in q_text:
                print(f"Question {q['questionNumber']}:")
                print("Question text:", q_text[:200])
                print("Options:", q["options"])
                break
