import json
import re

paths = [
    r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_gs1_consolidated.json",
    r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_gs4_consolidated.json"
]

for p in paths:
    print(f"=== SAMPLES FROM {p.split('\\')[-1]} ===")
    try:
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)

        count = 0
        for q in data.get("questions", []):
            for a in q.get("answers", []):
                txt = a.get("answerText", "")
                if "pub-" in txt or ".r2.dev" in txt:
                    # Find surrounding 150 chars around the URL
                    for m in re.finditer(r'https?://pub-[^\s"\'\`\>\)]+', txt):
                        start = max(0, m.start() - 40)
                        end = min(len(txt), m.end() + 40)
                        print(f"Q ID: {q.get('id')} | Institute: {a.get('institute')}")
                        print("  SNIPPET:", repr(txt[start:end]))
                        count += 1
                        if count >= 4:
                            break
                if count >= 4:
                    break
            if count >= 4:
                break
    except Exception as e:
        print("Error:", e)
    print()
