import os
import re
import json

# Paths
SYLLABUS_JSON = r"C:\Users\Dr. Yogesh\.gemini\antigravity\brain\60b28535-88c7-4f03-8c6a-08845b90f271\syllabus_hierarchy.json"
JSON_OUTPUT_DIR = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files"
ADMIN_JSON_DIR = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\admin-panel\mains-json"

MD_FILES = [
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 001-100.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 101-200.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1  201-300.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 301-400.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1  401-500.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 501-565.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 566-600.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 601-650.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 651-700.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 701-800.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 801-900.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 901-1000.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 1001-1100.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 1101-1157.md",
]

# Robust regex
Q_START_RE = re.compile(r'^\*\*Q(\d+)\.', re.IGNORECASE)
LAYER_RE = re.compile(r'^\*\s+\*\*Layer\s+(\d+):\*\*\s*(.*)', re.IGNORECASE)
CROSSLINK_RE = re.compile(r'^\*\s+\*\*Cross-Link\s+Layer\s+5:\*\*\s*(.*)', re.IGNORECASE)
TAGS_RE = re.compile(r'^\*\s+\*\*Tags:\*\*\s*(.*)', re.IGNORECASE)

# Load Syllabus
with open(SYLLABUS_JSON, "r", encoding="utf-8") as f:
    syllabus = json.load(f)

def normalize(text):
    if not text:
        return ""
    # Remove non-alphanumeric, lowercase
    return re.sub(r'[^a-z0-9]', '', text.lower())

# Build normalization indices
norm_units = {}
norm_subtopics = {}
norm_nanotopics = {}

for unit, subtopics in syllabus.items():
    norm_units[normalize(unit)] = unit
    for subtopic, nanotopics in subtopics.items():
        norm_subtopics[normalize(subtopic)] = (unit, subtopic)
        for nanotopic in nanotopics:
            norm_nanotopics[normalize(nanotopic)] = (unit, subtopic, nanotopic)

def find_canonical_unit(parsed_unit):
    parsed_norm = normalize(parsed_unit)
    if parsed_norm in norm_units:
        return norm_units[parsed_norm]
    # Substring matches
    for u in norm_units.values():
        if parsed_norm in normalize(u) or normalize(u) in parsed_norm:
            return u
    return parsed_unit

def find_canonical_subtopic(canonical_unit, parsed_subtopic):
    parsed_norm = normalize(parsed_subtopic)
    if canonical_unit in syllabus:
        for sub in syllabus[canonical_unit].keys():
            if normalize(sub) == parsed_norm:
                return sub
            if parsed_norm in normalize(sub) or normalize(sub) in parsed_norm:
                return sub
    # Global lookup
    if parsed_norm in norm_subtopics:
        return norm_subtopics[parsed_norm][1]
    for sub in norm_subtopics.values():
        if parsed_norm in normalize(sub[1]) or normalize(sub[1]) in parsed_norm:
            return sub[1]
    return parsed_subtopic

def find_canonical_nanotopic(canonical_unit, canonical_subtopic, parsed_nanotopic):
    parsed_norm = normalize(parsed_nanotopic)
    if canonical_unit in syllabus and canonical_subtopic in syllabus[canonical_unit]:
        for nano in syllabus[canonical_unit][canonical_subtopic]:
            if normalize(nano) == parsed_norm:
                return nano
            if parsed_norm in normalize(nano) or normalize(nano) in parsed_norm:
                return nano
    if canonical_unit in syllabus:
        for sub, nanos in syllabus[canonical_unit].items():
            for nano in nanos:
                if normalize(nano) == parsed_norm:
                    return nano
                if parsed_norm in normalize(nano) or normalize(nano) in parsed_norm:
                    return nano
    # Global lookup
    if parsed_norm in norm_nanotopics:
        return norm_nanotopics[parsed_norm][2]
    for item in norm_nanotopics.values():
        if parsed_norm in normalize(item[2]) or normalize(item[2]) in parsed_norm:
            return item[2]
    return parsed_nanotopic

def clean_q_text(line, q_num):
    text = re.sub(rf'^\*\*Q{q_num}\.\s*', '', line, flags=re.IGNORECASE)
    text = re.sub(r'\*\*\s*$', '', text)
    # Remove parenthetical wrappers containing Year/Marks/UPSC/Paper
    text = re.sub(r'\(\s*(?:UPSC|Paper\s*\d+|[\w\s\.,]*/?)*\[Year:.*?\)\s*$', '', text, flags=re.IGNORECASE)
    # Remove bracket markers
    text = re.sub(r'\[Year:\s*[^\]]+\]', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\[Marks:\s*[^\]]+\]', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\bUPSC\b', '', text, flags=re.IGNORECASE)
    text = text.strip()
    text = re.sub(r'[\s,\.\(\)\[\]\-]+$', '', text)
    return text.strip()

def parse_tags_line(tags_str):
    macrotags = []
    microtags = []
    
    # 1. Check for bracket formats like [Macrotag: Descriptive, Applied] [Microtag: Write a note]
    bracket_matches = re.findall(r'\[(Macrotag|Microtag):\s*(.*?)\]', tags_str, re.IGNORECASE)
    if bracket_matches:
        for t_type, t_content in bracket_matches:
            tags_list = [t.strip() for t in t_content.split(',') if t.strip()]
            if t_type.lower() == 'macrotag':
                macrotags.extend(tags_list)
            else:
                microtags.extend(tags_list)
    else:
        # 2. Backticks format like `Descriptive`, `Applied`
        backtick_matches = re.findall(r'`(.*?)`', tags_str)
        if backtick_matches:
            all_tags = [t.strip() for t in backtick_matches if t.strip()]
        else:
            # Comma separated
            all_tags = [t.strip() for t in tags_str.split(',') if t.strip()]
            
        allowed_macrotags = {"descriptive", "analytical", "comparative", "applied"}
        for t in all_tags:
            t_clean = t.lower()
            if t_clean in allowed_macrotags:
                # Map to correct casing
                casing_map = {
                    "descriptive": "Descriptive",
                    "analytical": "Analytical",
                    "comparative": "Comparative",
                    "applied": "Applied"
                }
                macrotags.append(casing_map[t_clean])
            elif "short note" in t_clean or "write a note" in t_clean or "define" in t_clean or "explain" in t_clean or "describe" in t_clean or "what is" in t_clean:
                macrotags.append("Descriptive")
                microtags.append(t)
            elif "discuss" in t_clean or "evaluate" in t_clean or "examine" in t_clean or "assess" in t_clean:
                macrotags.append("Analytical")
                microtags.append(t)
            elif "compare" in t_clean or "distinguish" in t_clean or "diff" in t_clean:
                macrotags.append("Comparative")
                microtags.append(t)
            else:
                microtags.append(t)
                
    # If still no macrotags, infer from microtags
    if not macrotags:
        for t in microtags:
            t_clean = t.lower()
            if "short note" in t_clean or "write a note" in t_clean or "define" in t_clean or "explain" in t_clean or "describe" in t_clean or "what is" in t_clean:
                macrotags.append("Descriptive")
            elif "discuss" in t_clean or "evaluate" in t_clean or "examine" in t_clean or "assess" in t_clean:
                macrotags.append("Analytical")
            elif "compare" in t_clean or "distinguish" in t_clean or "diff" in t_clean:
                macrotags.append("Comparative")
                
    # Deduplicate while preserving order
    macro_clean = []
    for t in macrotags:
        if t not in macro_clean:
            macro_clean.append(t)
            
    micro_clean = []
    for t in microtags:
        if t not in micro_clean:
            micro_clean.append(t)
            
    return ", ".join(macro_clean), ", ".join(micro_clean)

def parse_md_file(file_path):
    print(f"Parsing: {os.path.basename(file_path)}")
    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    questions = []
    current_q = None
    
    for idx, line in enumerate(lines):
        line_stripped = line.strip()
        if not line_stripped:
            continue
            
        q_match = Q_START_RE.match(line_stripped)
        if q_match:
            if current_q:
                questions.append(current_q)
                
            q_num = int(q_match.group(1))
            
            # Extract year
            year_match = re.search(r'\[Year:\s*([^\]]+)\]', line_stripped, re.IGNORECASE)
            year = None
            if year_match:
                year_val = year_match.group(1).strip()
                yr_num = re.search(r'\d{4}', year_val)
                if yr_num:
                    year = int(yr_num.group(0))
                else:
                    yr_num_any = re.search(r'\d+', year_val)
                    if yr_num_any:
                        year = int(yr_num_any.group(0))
                        
            # Extract marks
            marks_match = re.search(r'\[Marks:\s*([^\]]+)\]', line_stripped, re.IGNORECASE)
            marks = None
            if marks_match:
                marks_val = marks_match.group(1).strip()
                m_num = re.search(r'\d+', marks_val)
                if m_num:
                    marks = int(m_num.group(0))
                    
            q_text = clean_q_text(line_stripped, q_num)
            
            current_q = {
                "id": f"mains-anthro1-q{q_num}",
                "questionNumber": q_num,
                "questionText": q_text,
                "marks": marks,
                "year": year,
                "subject": "Anthropology",
                "sectionGroup": "",
                "microTopic": "",
                "subTopic": "",
                "macrotag": "",
                "microtag": "",
                "hierarchy_path": [],
                "answers": []
            }
            continue
            
        if current_q is not None:
            # Check Layer
            layer_match = LAYER_RE.match(line_stripped)
            if layer_match:
                layer_num = int(layer_match.group(1))
                layer_content = layer_match.group(2).strip()
                
                if layer_num == 3:
                    current_q["sectionGroup"] = find_canonical_unit(layer_content)
                elif layer_num == 4:
                    current_q["microTopic"] = find_canonical_subtopic(current_q["sectionGroup"], layer_content)
                elif layer_num == 5:
                    current_q["subTopic"] = find_canonical_nanotopic(current_q["sectionGroup"], current_q["microTopic"], layer_content)
                continue
                
            # Check Cross-Link
            cross_match = CROSSLINK_RE.match(line_stripped)
            if cross_match:
                cross_content = cross_match.group(1).strip()
                current_q["cross_link"] = cross_content
                continue
                
            # Check Tags
            tags_match = TAGS_RE.match(line_stripped)
            if tags_match:
                tags_content = tags_match.group(1).strip()
                macrotag, microtag = parse_tags_line(tags_content)
                current_q["macrotag"] = macrotag
                current_q["microtag"] = microtag
                continue
                
    if current_q:
        questions.append(current_q)
        
    # Post-process questions to build hierarchy_path and source_attribution_label
    for q in questions:
        # Build hierarchy_path: [Paper, Subject, Section Group, Microtopic, Subtopic]
        q["hierarchy_path"] = [
            "Anthro1",
            "Anthropology",
            q["sectionGroup"],
            q["microTopic"],
            q["subTopic"]
        ]
        q["source_attribution_label"] = f"CSE Mains {q['year']}" if q["year"] else "CSE Mains Practice"
        q["exam_info"] = {
            "isPyq": q["year"] is not None,
            "is_ncert": False,
            "exam": "Mains",
            "group": "UPSC CSE",
            "year": q["year"],
            "is_upsc_cse": q["year"] is not None,
            "is_allied": False,
            "is_others": False,
            "exam_category": "cse",
            "specific_exam": None,
            "stage": "mains",
            "paper": "mains_anthro1"
        }
        
    return questions

def run_conversion():
    all_questions = []
    for fp in MD_FILES:
        if not os.path.exists(fp):
            print(f"File not found: {fp}")
            continue
        questions = parse_md_file(fp)
        all_questions.extend(questions)
        
    # Standardize output doc structure
    output_doc = {
        "course": "Civil Services",
        "id": "mains-anthro1-consolidated",
        "title": "Mains Anthropology Paper 1 Consolidated Questions",
        "launch_year": None,
        "institute": "UPSC",
        "program_id": "cse",
        "program_name": "CSE",
        "series": "Mains (Official)",
        "level": "Anthro1",
        "paperType": "mains-paper",
        "defaultMinutes": 180,
        "sourceMode": "md-sol",
        "paper": "Anthro1",
        "questions": all_questions
    }
    
    # Save to both paths
    os.makedirs(JSON_OUTPUT_DIR, exist_ok=True)
    os.makedirs(ADMIN_JSON_DIR, exist_ok=True)
    
    dest_path1 = os.path.join(JSON_OUTPUT_DIR, "mains_anthro1_consolidated.json")
    with open(dest_path1, "w", encoding="utf-8") as out_f:
        json.dump(output_doc, out_f, indent=2, ensure_ascii=False)
    print(f"Exported {len(all_questions)} questions to: {dest_path1}")
    
    dest_path2 = os.path.join(ADMIN_JSON_DIR, "mains_anthro1_consolidated.json")
    with open(dest_path2, "w", encoding="utf-8") as out_f:
        json.dump(output_doc, out_f, indent=2, ensure_ascii=False)
    print(f"Copied to admin panel: {dest_path2}")
    
    # Validate missing layers
    missing_unit = 0
    missing_sub = 0
    missing_nano = 0
    for q in all_questions:
        if not q["sectionGroup"]: missing_unit += 1
        if not q["microTopic"]: missing_sub += 1
        if not q["subTopic"]: missing_nano += 1
        
    print(f"Validation summary: Total parsed={len(all_questions)}")
    print(f"  Missing Unit (Layer 3): {missing_unit}")
    print(f"  Missing Sub Topic (Layer 4): {missing_sub}")
    print(f"  Missing Nanotopic (Layer 5): {missing_nano}")

if __name__ == "__main__":
    run_conversion()
