import os
import re
import json

# Paths
MD_DIR = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains tab md files\mains question answers"
JSON_OUTPUT_DIR = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files"

# Regexes
Q_HEADER_RE = re.compile(r'^##\s+Q(\d+)\s+\[Year:\s*(\d+)\]\s+\[Marks:\s*(\d+)\]', re.IGNORECASE)
Q_TEXT_RE = re.compile(r'^\*\*Question:\*\*\s*(.*)', re.IGNORECASE)
TAXONOMY_RE = re.compile(r'^\*\*Subject:\*\*\s*(.*?)\s*\|\s*\*\*Section Group:\*\*\s*(.*?)\s*\|\s*\*\*Microtopic:\*\*\s*(.*?)\s*\|\s*\*\*Subtopic:\*\*\s*(.*)', re.IGNORECASE)
METADATA_LINE_RE = re.compile(r'^\*Metadata:\s*(.*)\*', re.IGNORECASE)
INSTITUTE_HEADER_RE = re.compile(r'^####\s+Answer\s+from\s+(.*)', re.IGNORECASE)
QUESTION_ID_RE = re.compile(r'\[Question\s+ID:\s*(.*?)\]', re.IGNORECASE)

def parse_metadata_brackets(meta_str):
    # Find all [Key: Value] elements
    matches = re.findall(r'\[(.*?):\s*(.*?)\]', meta_str)
    return {k.strip().lower(): v.strip() for k, v in matches}

def clean_paper_name(paper_raw):
    # Normalize "Mains - GS 1" to "GS1"
    paper_raw = paper_raw.lower()
    if 'gs 1' in paper_raw or 'gs-1' in paper_raw or 'gs1' in paper_raw:
        return 'GS1'
    if 'gs 2' in paper_raw or 'gs-2' in paper_raw or 'gs2' in paper_raw:
        return 'GS2'
    if 'gs 3' in paper_raw or 'gs-3' in paper_raw or 'gs3' in paper_raw:
        return 'GS3'
    if 'gs 4' in paper_raw or 'gs-4' in paper_raw or 'gs4' in paper_raw:
        return 'GS4'
    return paper_raw.upper()

def parse_md_file(file_path):
    print(f"Parsing: {file_path}")
    
    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    questions = []
    current_q = None
    current_ans = None
    ans_lines = []
    
    # State tracking
    # 0 = Looking for Q, 1 = Reading Q Metadata, 2 = Reading Answers
    state = 0 
    
    for idx, line in enumerate(lines):
        line_stripped = line.strip()
        
        # Check for new question header
        q_match = Q_HEADER_RE.match(line_stripped)
        if q_match:
            # Save previous answer if exists
            if current_ans and ans_lines:
                raw_ans_text = "".join(ans_lines).strip()
                # Clean up trailing separators and IDs
                cleaned_ans_text = clean_answer_text(raw_ans_text)
                if not is_empty_answer(cleaned_ans_text):
                    current_ans["answerText"] = cleaned_ans_text
                    current_q["answers"].append(current_ans)
                current_ans = None
                ans_lines = []
            
            # Save previous question if exists
            if current_q:
                questions.append(current_q)
                
            q_num = int(q_match.group(1))
            year = int(q_match.group(2))
            marks = int(q_match.group(3))
            
            current_q = {
                "id": "",
                "questionNumber": q_num,
                "questionText": "",
                "marks": marks,
                "year": year,
                "subject": "",
                "sectionGroup": "",
                "microTopic": "",
                "subTopic": "",
                "macrotag": "",
                "microtag": "",
                "hierarchy_path": [],
                "answers": []
            }
            state = 1
            continue
            
        if state == 1:
            # Parse Question Text
            q_text_match = Q_TEXT_RE.match(line_stripped)
            if q_text_match:
                current_q["questionText"] = q_text_match.group(1).strip()
                continue
                
            # Parse Taxonomy Line
            tax_match = TAXONOMY_RE.match(line_stripped)
            if tax_match:
                current_q["subject"] = tax_match.group(1).strip()
                current_q["sectionGroup"] = tax_match.group(2).strip()
                current_q["microTopic"] = tax_match.group(3).strip()
                current_q["subTopic"] = tax_match.group(4).strip()
                continue
                
            # Parse Metadata Bracket Line
            meta_match = METADATA_LINE_RE.match(line_stripped)
            if meta_match:
                meta_dict = parse_metadata_brackets(meta_match.group(1))
                current_q["macrotag"] = meta_dict.get("macrotag", "")
                current_q["microtag"] = meta_dict.get("microtag", "")
                
                # Dynamic Paper Name
                paper_raw = meta_dict.get("paper", "")
                paper_normalized = clean_paper_name(paper_raw)
                
                # Generate clean question id
                current_q["id"] = f"mains-{paper_normalized.lower()}-{current_q['year']}-q{current_q['questionNumber']}"
                
                # Unified skeleton fields
                current_q["source_attribution_label"] = f"CSE Mains {current_q['year']}"
                paper_num = paper_normalized[-1] if paper_normalized.startswith("GS") else "1"
                current_q["exam_info"] = {
                    "isPyq": True,
                    "is_ncert": False,
                    "exam": "Mains",
                    "group": "UPSC CSE",
                    "year": current_q["year"],
                    "is_upsc_cse": True,
                    "is_allied": False,
                    "is_others": False,
                    "exam_category": "cse",
                    "specific_exam": None,
                    "stage": "mains",
                    "paper": f"mains_gs{paper_num}" if paper_normalized.startswith("GS") else "other"
                }

                # Build hierarchy path: [Paper, Subject, Section Group, Microtopic, Subtopic]
                path = [paper_normalized]
                if current_q["subject"]: path.append(current_q["subject"])
                if current_q["sectionGroup"]: path.append(current_q["sectionGroup"])
                if current_q["microTopic"]: path.append(current_q["microTopic"])
                if current_q["subTopic"]: path.append(current_q["subTopic"])
                current_q["hierarchy_path"] = path
                
                state = 2 # Metadata loaded, now listening for answers
                continue
                
        if state == 2:
            # Check for institute answer header
            inst_match = INSTITUTE_HEADER_RE.match(line_stripped)
            if inst_match:
                # Save previous answer if exists
                if current_ans and ans_lines:
                    raw_ans_text = "".join(ans_lines).strip()
                    cleaned_ans_text = clean_answer_text(raw_ans_text)
                    if not is_empty_answer(cleaned_ans_text):
                        current_ans["answerText"] = cleaned_ans_text
                        current_q["answers"].append(current_ans)
                    ans_lines = []
                
                inst_name = inst_match.group(1).strip()
                current_ans = {
                    "id": "",
                    "institute": inst_name,
                    "answerText": ""
                }
                continue
                
            # If reading an answer, append lines
            if current_ans is not None:
                # Extract Question ID if present on this line
                id_match = QUESTION_ID_RE.search(line_stripped)
                if id_match:
                    current_ans["id"] = id_match.group(1).strip()
                ans_lines.append(line)
                
    # Save the very last answer and question
    if current_ans and ans_lines:
        raw_ans_text = "".join(ans_lines).strip()
        cleaned_ans_text = clean_answer_text(raw_ans_text)
        if not is_empty_answer(cleaned_ans_text):
            current_ans["answerText"] = cleaned_ans_text
            current_q["answers"].append(current_ans)
            
    if current_q:
        questions.append(current_q)
        
    return questions

def clean_answer_text(text):
    # Remove trailing separator lines (e.g. ---)
    lines = text.splitlines()
    while lines and (lines[-1].strip() == "---" or lines[-1].strip() == "" or QUESTION_ID_RE.search(lines[-1])):
        lines.pop()
    return "\n".join(lines).strip()

def is_empty_answer(text):
    # Check if answer text is empty or simply a "no answer matched" notice
    text_lower = text.lower()
    if not text:
        return True
    if "no answer matched for this institute" in text_lower:
        return True
    return False

def convert_all():
    if not os.path.exists(JSON_OUTPUT_DIR):
        os.makedirs(JSON_OUTPUT_DIR)
        
    files = [
        ("GS1 question with multiple answers.md", "mains_gs1_consolidated.json"),
        ("GS2 question with multiple answers.md", "mains_gs2_consolidated.json"),
        ("GS3 question with multiple answers.md", "mains_gs3_consolidated.json"),
        ("GS4 question with multiple answers.md", "mains_gs4_consolidated.json")
    ]
    
    for md_file, json_file in files:
        full_md_path = os.path.join(MD_DIR, md_file)
        if not os.path.exists(full_md_path):
            print(f"Skipping: {md_file} (Not found)")
            continue
            
        questions = parse_md_file(full_md_path)
        
        # Build document container format similar to Prelims
        paper_name = clean_paper_name(md_file.split(" ")[0])
        output_doc = {
            "course": "Civil Services",
            "id": f"mains-{paper_name.lower()}-consolidated",
            "title": f"Mains {paper_name} Consolidated Questions and Answers",
            "launch_year": None,
            "institute": "UPSC",
            "program_id": "cse",
            "program_name": "CSE",
            "series": "Mains (Official)",
            "level": paper_name,
            "paperType": "mains-paper",
            "defaultMinutes": 180,
            "sourceMode": "md-sol",
            "paper": paper_name,
            "questions": questions
        }
        
        output_json_path = os.path.join(JSON_OUTPUT_DIR, json_file)
        with open(output_json_path, "w", encoding="utf-8") as out_f:
            json.dump(output_doc, out_f, indent=2, ensure_ascii=False)
            
        print(f"Exported {len(questions)} questions to: {output_json_path}")

if __name__ == "__main__":
    convert_all()
