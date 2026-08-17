import json
import re

j1_path = r'C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro1_new_consolidated.json'
with open(j1_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

for q in data.get('questions', []):
    for a in q.get('answers', []):
        txt = a.get('answerText', '')
        if not txt.startswith('| **Approach:') and 'Aspects to Take' in txt:
            print("FOUND UNCONVERTED ANSWER:")
            print("----------------------------------------")
            print(repr(txt[:400]))
            print("----------------------------------------")

            # Let's write a simple section splitter
            # Split by known headers or find sections
            parts = re.split(r'\n(?=(?:[-*•]|\s)*(?:\*\*|__)?\s*(?:Aspects?\s+to\s+Take|Structure\s+to\s+Follow|Don\'?ts?|ANSWER))', txt, flags=re.I)
            print("SPLIT PARTS:", len(parts))
            for p in parts:
                print("  PART:", repr(p[:60]))
            break
