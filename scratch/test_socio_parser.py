import re
import json

file_path = r"C:\Users\Dr. Yogesh\Downloads\Qwen__20260722_byxmvixnv.txt"

with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

# Pattern for question headers like [2024/I/2a/20] Question text...
# followed by Hierarchy: Paper I → Unit ...
pattern = r'\[(\d{4})/([I|V|X]+)/([^/]+)/(\d+)\]\s*(.*?)\n+Hierarchy:\s*(.*?)(?=\n+\[|\Z)'

matches = re.findall(pattern, text, re.DOTALL)

print(f"Total matched questions: {len(matches)}")

parsed_questions = []

for idx, m in enumerate(matches):
    year_str, paper_roman, q_num, marks_str, q_text, hierarchy_str = m
    
    # Clean up question text
    q_text_clean = q_text.strip().replace("\n", " ")
    q_text_clean = re.sub(r'\s+', ' ', q_text_clean)
    
    # Parse hierarchy
    # e.g. Paper I → Unit 1 - Sociology The Discipline → 1.1 Modernity and social changes... → Enlightenment
    h_parts = [p.strip() for p in hierarchy_str.strip().split("→")]
    
    section_group = h_parts[0] if len(h_parts) > 0 else "Paper I"
    micro_topic = h_parts[1] if len(h_parts) > 1 else None
    sub_topic = h_parts[2] if len(h_parts) > 2 else None
    nano_topic = h_parts[3] if len(h_parts) > 3 else None
    
    # Generate ID: mains-socio1-q001 etc.
    q_id = f"mains-socio1-q{idx+1:03d}"
    year = int(year_str)
    marks = int(marks_str)
    
    # Derive microtag/macrotag
    microtag = None
    if "critically examine" in q_text_clean.lower():
        microtag = "Critically examine"
    elif "discuss" in q_text_clean.lower():
        microtag = "Discuss"
    elif "explain" in q_text_clean.lower():
        microtag = "Explain"
    elif "comment" in q_text_clean.lower():
        microtag = "Comment"
    elif "elaborate" in q_text_clean.lower():
        microtag = "Elaborate"
    elif "evaluate" in q_text_clean.lower():
        microtag = "Evaluate"
    elif "short notes" in q_text_clean.lower() or "short note" in q_text_clean.lower():
        microtag = "Short Note"

    macrotag = "Descriptive"
    if marks <= 10:
        macrotag = "Descriptive, Short Note"
    elif "critically" in q_text_clean.lower() or "evaluate" in q_text_clean.lower():
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

print("First question sample:")
print(json.dumps(parsed_questions[0], indent=2))
print("Last question sample:")
print(json.dumps(parsed_questions[-1], indent=2))
