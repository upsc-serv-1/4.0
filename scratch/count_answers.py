import json

f1 = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro1_new_consolidated.json"
f2 = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro2_new_consolidated.json"

with open(f1, "r", encoding="utf-8") as f:
    d1 = json.load(f)
with open(f2, "r", encoding="utf-8") as f:
    d2 = json.load(f)

p1_questions = d1.get("questions", [])
p2_questions = d2.get("questions", [])

p1_answers = [ans for q in p1_questions for ans in q.get("answers", [])]
p2_answers = [ans for q in p2_questions for ans in q.get("answers", [])]

p1_institutes = {}
for ans in p1_answers:
    inst = ans.get("institute", "Unknown")
    p1_institutes[inst] = p1_institutes.get(inst, 0) + 1

p2_institutes = {}
for ans in p2_answers:
    inst = ans.get("institute", "Unknown")
    p2_institutes[inst] = p2_institutes.get(inst, 0) + 1

print(f"Paper 1 ({len(p1_questions)} questions): {len(p1_answers)} total answers breakdown: {p1_institutes}")
print(f"Paper 2 ({len(p2_questions)} questions): {len(p2_answers)} total answers breakdown: {p2_institutes}")
