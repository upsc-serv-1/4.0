import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

# The backup statementLines are already correct (interleaved format).
# But options are empty {} — need to look at explanationMarkdown or questionText 
# to extract the original code table answer options.

backup_path = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\UPSC_2026 CSE GS PAPER 1 FORMATTED.json.bak"

with open(backup_path, "r", encoding="utf-8") as f:
    backup_data = json.load(f)

for q_num in [41, 92, 96, 97]:
    for q in backup_data["questions"]:
        if q["questionNumber"] == q_num:
            print(f"\n=== BACKUP Q.{q_num} ===")
            print("correctAnswer:", q.get("correctAnswer"))
            print("questionText:", repr(q.get("questionText", "")[:300]))
            print("explanation (first 200):", repr(q.get("explanationMarkdown", "")[:200]))
            break
