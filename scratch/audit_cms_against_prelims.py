import os
import json
import glob

cms_dir = r"C:\Users\Dr. Yogesh\Desktop\mains\neet and upsc cms\neet and upsc cms\final cms"
json_files = glob.glob(os.path.join(cms_dir, "*.json"))

print(f"Auditing {len(json_files)} final CMS JSON files against Prelims schema...")

# Expected fields based on standard prelims schema
expected_root_fields = {
    "id": str,
    "title": str,
    "launch_year": int,
    "institute": str,
    "program_id": str,
    "program_name": str,
    "series": str,
    "level": str,
    "paperType": str,
    "defaultMinutes": int,
    "sourceMode": str,
    "questions": list
}

expected_q_fields = {
    "id": str,
    "questionNumber": int,
    "subject": str,
    "sectionGroup": str,
    "microTopic": str,
    "statementLines": list,
    "questionText": str,
    "options": dict,
    "correctAnswer": str,
    "explanationMarkdown": str,
    "exam_info": dict,
    "source_attribution_label": str
}

expected_exam_info_fields = {
    "isPyq": bool,
    "is_ncert": bool,
    "exam": str,
    "group": str,
    "year": int,
    "is_upsc_cse": bool,
    "is_allied": bool,
    "is_others": bool,
    "exam_category": str,
    "stage": str,
    "paper": str
}

report = []

for fpath in json_files:
    fname = os.path.basename(fpath)
    file_errors = []
    
    try:
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        report.append(f"[ERR] {fname}: Failed to parse JSON - {e}")
        continue

    # 1. Audit Root Fields
    missing_root = []
    type_mismatched_root = []
    for field, expected_type in expected_root_fields.items():
        if field not in data:
            missing_root.append(field)
        elif data[field] is not None and not isinstance(data[field], expected_type):
            type_mismatched_root.append(f"{field} (expected {expected_type.__name__}, got {type(data[field]).__name__})")
            
    if missing_root:
        file_errors.append(f"Missing root fields: {', '.join(missing_root)}")
    if type_mismatched_root:
        file_errors.append(f"Type mismatched root fields: {', '.join(type_mismatched_root)}")

    # 2. Audit Questions
    questions = data.get("questions", [])
    if not isinstance(questions, list):
        file_errors.append("Root field 'questions' is not a list")
        questions = []

    missing_q = set()
    type_mismatched_q = set()
    missing_ei = set()
    type_mismatched_ei = set()
    
    for idx, q in enumerate(questions):
        for field, expected_type in expected_q_fields.items():
            if field not in q:
                missing_q.add(field)
            elif q[field] is not None and not isinstance(q[field], expected_type):
                type_mismatched_q.add(f"{field} ({type(q[field]).__name__})")
                
        # Audit exam_info
        ei = q.get("exam_info")
        if isinstance(ei, dict):
            for field, expected_type in expected_exam_info_fields.items():
                if field not in ei:
                    missing_ei.add(field)
                elif ei[field] is not None and not isinstance(ei[field], expected_type):
                    type_mismatched_ei.add(f"{field} ({type(ei[field]).__name__})")
        elif ei is not None:
            type_mismatched_q.add(f"exam_info ({type(ei).__name__})")
            
    if missing_q:
        file_errors.append(f"Missing question fields (at least one question): {', '.join(sorted(missing_q))}")
    if type_mismatched_q:
        file_errors.append(f"Type mismatched question fields: {', '.join(sorted(type_mismatched_q))}")
    if missing_ei:
        file_errors.append(f"Missing exam_info fields (at least one question): {', '.join(sorted(missing_ei))}")
    if type_mismatched_ei:
        file_errors.append(f"Type mismatched exam_info fields: {', '.join(sorted(type_mismatched_ei))}")

    if file_errors:
        report.append(f"[WARN] {fname}:\n  " + "\n  ".join(file_errors))
    else:
        report.append(f"[OK] {fname}: Fully conforms to Prelims JSON schema")

print("\n--- AUDIT REPORT ---")
for line in report:
    print(line)
