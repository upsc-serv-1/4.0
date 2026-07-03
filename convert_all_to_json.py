import os
import re
import json
import shutil

booklet_info = {
    "CSM26T01SE": {"paper": "mains_gs2", "level": "GS2", "subject": "Polity"},
    "CSM26T02SE": {"paper": "mains_gs2", "level": "GS2", "subject": "Polity"},
    "CSM26T03SE": {"paper": "mains_gs2", "level": "GS2", "subject": "Polity"},
    "CSM26T04SE": {"paper": "mains_gs3", "level": "GS3", "subject": "Economy"},
    "CSM26T05SE": {"paper": "mains_gs3", "level": "GS3", "subject": "Economy"},
    "CSM26T06SE": {"paper": "mains_gs1", "level": "GS1", "subject": "History"},
    "CSM26T07SE": {"paper": "mains_gs1", "level": "GS1", "subject": "Geography"},
    "CSM26T08SE": {"paper": "mains_gs1", "level": "GS1", "subject": "History"},
    "CSM26T09SE": {"paper": "mains_gs2", "level": "GS2", "subject": "Polity"},
    "CSM26T10SE": {"paper": "mains_gs1", "level": "GS1", "subject": "Society"},
    "CSM26T11SE": {"paper": "mains_gs2", "level": "GS2", "subject": "International Relations"},
    "CSM26T12SE": {"paper": "mains_gs3", "level": "GS3", "subject": "Science & Technology"},
    "CSM26T13SE": {"paper": "mains_gs3", "level": "GS3", "subject": "Economy"},
    "CSM26T14SE": {"paper": "mains_gs3", "level": "GS3", "subject": "Science & Technology"},
    "CSM26T15SE": {"paper": "mains_gs3", "level": "GS3", "subject": "Environment"},
}

def parse_md_file(md_path, booklet_suffix):
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    info = booklet_info.get(booklet_suffix, {"paper": "mains_gs1", "level": "GS1", "subject": "General"})
    
    # Extract booklet number, e.g. "CSM26T01SE" -> "t01"
    booklet_match = re.search(r'CSM26T(\d+)SE', booklet_suffix)
    if booklet_match:
        t_num = f"t{int(booklet_match.group(1)):02d}"
    else:
        t_num = "t01"
        
    parts = re.split(r'\n## Q', content)
    questions = []
    
    for part in parts[1:]:
        block = "## Q" + part
        lines = block.split('\n')
        
        q_num_match = re.match(r'^## Q(\d+)', lines[0])
        if not q_num_match:
            continue
        q_num = int(q_num_match.group(1))
        
        q_text = ""
        metadata_line = ""
        answer_lines = []
        
        mode = "init"
        for line in lines[1:]:
            stripped = line.strip()
            if stripped.startswith("**Question:**"):
                q_text = line.replace("**Question:**", "").strip()
                mode = "question"
            elif stripped.startswith("*Metadata:"):
                metadata_line = stripped
                mode = "metadata"
            elif stripped.startswith("#### Answer from ForumIAS"):
                mode = "answer"
            else:
                if mode == "question" and q_text:
                    q_text += "\n" + line.strip()
                elif mode == "answer":
                    if not stripped.startswith("[Question ID:"):
                        answer_lines.append(line)
                        
        answer_text = "\n".join(answer_lines).strip()
        answer_text = re.sub(r'\n---\s*$', '', answer_text).strip()
        marks = 10 if q_num <= 10 else 15
        
        year = 2026
        year_match = re.search(r'\[Year:\s*(\d+)\]', metadata_line)
        if year_match:
            year = int(year_match.group(1))
            
        q_id_val = f"forum-mgp-{year}-{info['level'].lower()}-{t_num}-q{q_num}"
        
        q_obj = {
            "id": q_id_val,
            "questionNumber": q_num,
            "questionText": q_text.strip(),
            "marks": marks,
            "year": year,
            "subject": info["subject"],
            "sectionGroup": None,
            "microTopic": None,
            "subTopic": None,
            "macrotag": None,
            "microtag": None,
            "hierarchy_path": [info["level"], info["subject"]],
            "answers": [
                {
                    "id": f"{q_id_val}-forumias",
                    "institute": "ForumIAS",
                    "answerText": answer_text
                }
            ],
            "source_attribution_label": f"Forum MGP {year} ({booklet_suffix})",
            "exam_info": {
                "isPyq": False,
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
                "paper": info["paper"]
            }
        }
        questions.append(q_obj)
        
    return questions

def main():
    workspace_dir = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2"
    json_dir = os.path.join(workspace_dir, "mains json files")
    forum_json_dir = os.path.join(json_dir, "forum mgp 2026")
    
    os.makedirs(forum_json_dir, exist_ok=True)
    
    booklets = [f"CSM26T{i:02d}SE" for i in range(1, 16)]
    questions_by_paper = {"GS1": [], "GS2": [], "GS3": []}
    
    print("Processing booklets and generating JSON files...\n")
    
    for booklet in booklets:
        md_name = f"Forum MGP {booklet} Examstatic.com.md"
        md_path = os.path.join(workspace_dir, md_name)
        
        if not os.path.exists(md_path):
            print(f"[-] MD file not found in workspace: {md_name}. Skipping.")
            continue
            
        dest_md_path = os.path.join(forum_json_dir, md_name)
        shutil.copy2(md_path, dest_md_path)
        
        questions = parse_md_file(md_path, booklet)
        
        info = booklet_info.get(booklet, {"paper": "mains_gs1", "level": "GS1", "subject": "General"})
        questions_by_paper[info["level"]].extend(questions)
        
        ind_json_name = f"Forum MGP {booklet} Examstatic.com.json"
        ind_json_path = os.path.join(forum_json_dir, ind_json_name)
        
        ind_root = {
            "course": "Civil Services",
            "id": f"forum-mgp-2026-{info['level'].lower()}-{booklet.lower()}",
            "title": f"Forum MGP 2026 {info['level']} - {booklet}",
            "launch_year": 2026,
            "institute": "Forum IAS",
            "program_id": "mgp",
            "program_name": "MGP",
            "series": "Test Series",
            "level": info["level"],
            "paperType": "Sectional",
            "defaultMinutes": 180,
            "sourceMode": "md-sol",
            "paper": info["level"],
            "questions": questions
        }
        
        with open(ind_json_path, 'w', encoding='utf-8') as f:
            json.dump(ind_root, f, ensure_ascii=False, indent=2)
        print(f"[+] Generated individual JSON: {ind_json_name}")
        
    # Generate consolidated JSON files for each GS paper
    for level, questions in questions_by_paper.items():
        if not questions:
            continue
        consolidated_json_path = os.path.join(json_dir, f"forum_mgp_2026_{level.lower()}_consolidated.json")
        
        consolidated_root = {
            "course": "Civil Services",
            "id": f"forum-mgp-2026-{level.lower()}-consolidated",
            "title": f"Forum MGP 2026 {level} Consolidated Questions and Answers",
            "launch_year": 2026,
            "institute": "Forum IAS",
            "program_id": "mgp",
            "program_name": "MGP",
            "series": "Test Series",
            "level": level,
            "paperType": "mains-paper",
            "defaultMinutes": 180,
            "sourceMode": "md-sol",
            "paper": level,
            "questions": questions
        }
        
        with open(consolidated_json_path, 'w', encoding='utf-8') as f:
            json.dump(consolidated_root, f, ensure_ascii=False, indent=2)
        print(f"[+] Generated consolidated JSON file for {level}: {os.path.basename(consolidated_json_path)}")
        
    print("\nAll tasks completed successfully!")

if __name__ == "__main__":
    main()
