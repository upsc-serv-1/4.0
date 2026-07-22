import re
import json
import os
import shutil

file_path = r"C:\Users\Dr. Yogesh\Downloads\Qwen__20260722_byxmvixnv.txt"

with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

pattern = r'\[(\d{4})/([I|V|X]+)/([^/]+)/(\d+)\]\s*(.*?)\n+Hierarchy:\s*(.*?)(?=\n+\[|\Z)'
matches = re.findall(pattern, text, re.DOTALL)

parsed_questions = []

for idx, m in enumerate(matches):
    year_str, paper_roman, q_num, marks_str, q_text, hierarchy_str = m
    
    # Clean up question text
    q_text_clean = q_text.strip().replace("\n", " ")
    q_text_clean = re.sub(r'\s+', ' ', q_text_clean)
    
    # Parse hierarchy
    h_parts = [p.strip() for p in hierarchy_str.strip().split("→")]
    
    section_group = h_parts[0] if len(h_parts) > 0 else "Paper I"
    micro_topic = h_parts[1] if len(h_parts) > 1 else None
    sub_topic = h_parts[2] if len(h_parts) > 2 else None
    nano_topic = h_parts[3] if len(h_parts) > 3 else None
    
    # Clean up known truncated nanoTopic at the end
    if nano_topic == "Family (Nuclear, Neo-local, Fil":
        nano_topic = "Family (Nuclear, Neo-local, Filiocentric)"
        
    q_id = f"mains-socio1-q{idx+1:03d}"
    year = int(year_str)
    marks = int(marks_str)
    
    # Derive microtag/macrotag
    microtag = None
    q_lower = q_text_clean.lower()
    if "critically examine" in q_lower:
        microtag = "Critically examine"
    elif "critically analyse" in q_lower or "critically analyze" in q_lower:
        microtag = "Critically analyze"
    elif "discuss" in q_lower:
        microtag = "Discuss"
    elif "explain" in q_lower:
        microtag = "Explain"
    elif "comment" in q_lower:
        microtag = "Comment"
    elif "elaborate" in q_lower:
        microtag = "Elaborate"
    elif "evaluate" in q_lower:
        microtag = "Evaluate"
    elif "short notes" in q_lower or "short note" in q_lower:
        microtag = "Short Note"

    macrotag = "Descriptive"
    if marks <= 10:
        macrotag = "Descriptive, Short Note"
    elif "critically" in q_lower or "evaluate" in q_lower:
        macrotag = "Descriptive, Analytical"

    question_obj = {
        "id": q_id,
        "questionNumber": q_num,
        "questionText": q_text_clean,
        "marks": marks,
        "year": year,
        "paper": "Optional",
        "subject": "Sociology",
        "sectionGroup": section_group,
        "microTopic": micro_topic,
        "subTopic": sub_topic,
        "nanoTopic": nano_topic,
        "macrotag": macrotag,
        "microtag": microtag,
        "answers": [],
        "cross_link": None,
        "source_attribution_label": f"CSE Mains {year}",
        "exam_info": {
            "isPyq": True,
            "is_ncert": False,
            "exam": "Mains",
            "group": "UPSC CSE",
            "year": year,
            "is_upsc_cse": True,
            "is_allied": False,
            "is_others": False,
            "exam_category": "cse",
            "specific_exam": None,
            "stage": "mains",
            "paper": "mains_socio_1"
        },
        "course": "Civil Services",
        "institute": "UPSC",
        "is_pyq": True,
        "program_id": "cse",
        "program_name": "CSE"
    }
    
    parsed_questions.append(question_obj)

json_output = {
    "course": "Civil Services",
    "id": "mains-socio1-consolidated",
    "title": "Mains Sociology Paper 1 Consolidated Questions",
    "launch_year": None,
    "institute": "UPSC",
    "program_id": "cse",
    "program_name": "CSE",
    "series": "Mains (Official)",
    "level": "Socio - 1",
    "paperType": "mains-paper",
    "defaultMinutes": 180,
    "sourceMode": "md-sol",
    "paper": "Optional",
    "questions": parsed_questions
}

target_dir1 = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files"
target_dir2 = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\admin-panel\mains-json"

out_path1 = os.path.join(target_dir1, "mains_socio1_new_consolidated.json")
out_path2 = os.path.join(target_dir2, "mains_socio1_new_consolidated.json")

with open(out_path1, "w", encoding="utf-8") as f:
    json.dump(json_output, f, indent=2, ensure_ascii=False)

shutil.copy2(out_path1, out_path2)

print(f"[OK] Created {out_path1} with {len(parsed_questions)} questions.")
print(f"[OK] Synced to {out_path2}")
