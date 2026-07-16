import os
import re
import json
import difflib

JSON_DIR_OFFICIAL = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\anthro official"
JSON_DIR_MAPPED = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\anthro mapped"

CONSOLIDATED_1 = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro1_consolidated.json"
CONSOLIDATED_2 = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro2_consolidated.json"

def clean_question_core(text):
    if not text:
        return ""
    # Collapsing extra whitespaces
    t = re.sub(r'\s+', ' ', text).strip()
    
    # 1. If it contains a colon, split and take the part after the colon (if colon is within the first 80 chars)
    if ":" in t:
        parts = t.split(":", 1)
        if len(parts[0]) < 80:
            t = parts[1].strip()
            
    # 2. Strip leading bracketed topics e.g. (Liminality) or (Eugenics)
    t = re.sub(r'^\s*\([^)]+\)\s*', '', t)
    
    # 3. Clean leading prefixes
    prefixes = [
        "write short notes on the following in about 150 words each on",
        "write short notes on the following in about 150 words each",
        "write short notes on the following in 150 words each",
        "write short notes (in about 150 words each) on the following",
        "write short notes (in about 150 words each) on",
        "write short notes on the following",
        "write short notes (in about 150 words each)",
        "write short notes in 150 words on",
        "write short notes in 150 words",
        "write short notes on",
        "write short note on",
        "write notes on the following in about 150 words each",
        "write notes on the following in 150 words each",
        "write a note in 150 words on",
        "write a note in 250 words on",
        "write a note on the following",
        "write a note on",
        "write notes on",
        "write note on",
        "answer the following in about 150 words each",
        "answer the following in 150 words each",
        "answer the following in about 250 words each",
        "answer the following in 250 words each",
        "answer the following",
        "describe the",
        "describe",
        "discuss the",
        "discuss",
        "examine the",
        "examine",
        "explain the",
        "explain",
        "critically examine the",
        "critically examine",
        "critically discuss the",
        "critically discuss",
        "critically comment on the",
        "critically comment on",
        "comment on the",
        "comment on",
        "comment briefly on the",
        "comment briefly on",
        "write a note in 200 words:",
        "write a note in 200 words",
        "write notes on the following in about 150 words each :",
        "write short notes on the following in about 150 words each :",
        "write short notes (in about 150 words each) on the following :",
        "write short notes (in about 150 words each) on the following",
        "write short notes on the following in 150 words each :",
        "describe the neolithic culture of"
    ]
    
    # Sort prefixes by length descending to match longest first
    prefixes.sort(key=len, reverse=True)
    
    t_lower = t.lower().strip()
    for p in prefixes:
        if t_lower.startswith(p):
            t = t[len(p):].strip()
            # Strip any leading non-word characters (colons, spaces)
            t = re.sub(r'^[^\w]+', '', t).strip()
            break
            
    # 4. Remove standard suffixes second
    t = re.sub(r'\(?\s*\d+\s*(?:words|marks)\s*\)?', '', t, flags=re.IGNORECASE)
    t = re.sub(r'in\s+\d+\s+words', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\.?\s*upsc\s*$', '', t, flags=re.IGNORECASE)
    
    # Preserve letters, numbers, and spaces
    cleaned = re.sub(r'[^a-zA-Z0-9\s]', '', t)
    cleaned = re.sub(r'\s+', ' ', cleaned)
    return cleaned.strip()

def get_words_set(text):
    cleaned = clean_question_core(text)
    words = re.findall(r'\b[a-zA-Z0-9]{3,}\b', cleaned.lower())
    return set(words)

def load_consolidated_reference():
    ref_questions = []
    
    if os.path.exists(CONSOLIDATED_1):
        with open(CONSOLIDATED_1, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for q in data.get("questions", []):
                q["paper_source"] = "Anthro - 1"
                ref_questions.append(q)
            
    if os.path.exists(CONSOLIDATED_2):
        with open(CONSOLIDATED_2, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for q in data.get("questions", []):
                q["paper_source"] = "Anthro - 2"
                ref_questions.append(q)
            
    print(f"Loaded {len(ref_questions)} reference questions from consolidated files.")
    
    processed_ref = []
    for q in ref_questions:
        q_text = q.get("questionText", "")
        processed_ref.append({
            "orig": q,
            "clean_guidelines": clean_question_core(q_text),
            "words": get_words_set(q_text)
        })
    return processed_ref

def run_mapping():
    os.makedirs(JSON_DIR_MAPPED, exist_ok=True)
    ref_list = load_consolidated_reference()
    
    files = sorted([f for f in os.listdir(JSON_DIR_OFFICIAL) if f.endswith(".json")])
    
    total_matched = 0
    total_unmatched = 0
    
    sample_outputs = []
    
    for filename in files:
        filepath_in = os.path.join(JSON_DIR_OFFICIAL, filename)
        filepath_out = os.path.join(JSON_DIR_MAPPED, filename)
        
        with open(filepath_in, 'r', encoding='utf-8') as f:
            new_questions = json.load(f)
            
        mapped_questions = []
        for q in new_questions:
            q_text = q.get("questionText", "")
            q_clean = clean_question_core(q_text)
            q_words = get_words_set(q_text)
            
            candidates = []
            for ref in ref_list:
                if not q_words or not ref["words"]:
                    score = 0.0
                else:
                    intersection = len(q_words.intersection(ref["words"]))
                    union = len(q_words.union(ref["words"]))
                    score = intersection / union if union > 0 else 0.0
                
                if score > 0.1:
                    candidates.append((score, ref))
            
            candidates.sort(key=lambda x: x[0], reverse=True)
            top_candidates = candidates[:10]
            
            best_match = None
            best_ratio = 0.0
            
            # Check exact cleaned text match
            for ref in ref_list:
                if q_clean.lower() == ref["clean_guidelines"].lower():
                    best_ratio = 1.0
                    best_match = ref["orig"]
                    break
            
            if best_ratio < 1.0:
                for score, cand in top_candidates:
                    # Match normalized strings (without spaces) for final similarity
                    cand_norm = re.sub(r'[^a-zA-Z0-9]', '', cand["clean_guidelines"].lower())
                    app_norm = re.sub(r'[^a-zA-Z0-9]', '', q_clean.lower())
                    
                    ratio = difflib.SequenceMatcher(None, app_norm, cand_norm).ratio()
                    if ratio > best_ratio:
                        best_ratio = ratio
                        best_match = cand["orig"]
            
            mapped_q = {
                "key": q.get("key"),
                "year": q.get("year"),
                "paper": q.get("paper"),
                "questionNumber": q.get("questionNumber"),
                "questionText": q.get("questionText"),
                "marks": q.get("marks")
            }
            
            # Using 75% threshold on normalized clean text to ensure maximum recall
            if best_ratio >= 0.75 and best_match:
                total_matched += 1
                mapped_q["subject"] = "Anthropology"
                mapped_q["sectionGroup"] = best_match.get("sectionGroup")
                mapped_q["microTopic"] = best_match.get("microTopic")
                mapped_q["subTopic"] = best_match.get("subTopic")
                mapped_q["nanoTopic"] = best_match.get("nanoTopic")
                
                mapped_q["hierarchy_path"] = [
                    "Anthropology",
                    best_match.get("paper_source", "Anthro - 1"),
                    best_match.get("sectionGroup", ""),
                    best_match.get("microTopic", ""),
                    best_match.get("subTopic", ""),
                    best_match.get("nanoTopic", "")
                ]
                
                mapped_q["macrotag"] = best_match.get("macrotag", "")
                mapped_q["microtag"] = best_match.get("microtag", "")
                mapped_q["matched_similarity"] = round(best_ratio, 3)
                mapped_q["matched_ref_text"] = best_match.get("questionText")
            else:
                total_unmatched += 1
                mapped_q["subject"] = "Anthropology"
                mapped_q["sectionGroup"] = None
                mapped_q["microTopic"] = None
                mapped_q["subTopic"] = None
                mapped_q["nanoTopic"] = None
                mapped_q["hierarchy_path"] = []
                mapped_q["macrotag"] = None
                mapped_q["microtag"] = None
                mapped_q["matched_similarity"] = round(best_ratio, 3)
                
            mapped_questions.append(mapped_q)
            
            if len(sample_outputs) < 10 and best_ratio >= 0.75:
                sample_outputs.append({
                    "app_key": mapped_q["key"],
                    "app_text": mapped_q["questionText"],
                    "ref_text": best_match.get("questionText") if best_match else None,
                    "similarity": round(best_ratio, 3),
                    "hierarchy_path": mapped_q["hierarchy_path"],
                    "macrotag": mapped_q["macrotag"]
                })
                
        with open(filepath_out, 'w', encoding='utf-8') as out_f:
            json.dump(mapped_questions, out_f, indent=2, ensure_ascii=False)
            
    print(f"\nCompleted mapping for all 28 JSON files with ULTIMATE matching logic!")
    print(f"Total Matched Questions: {total_matched}")
    print(f"Total Unmatched Questions: {total_unmatched}")
    print(f"Match Success Rate: {total_matched / (total_matched + total_unmatched) * 100:.1f}%")
    
    sample_file = os.path.join(JSON_DIR_MAPPED, "mapping_samples.json")
    with open(sample_file, 'w', encoding='utf-8') as sf:
        json.dump(sample_outputs, sf, indent=2, ensure_ascii=False)
        
run_mapping()
