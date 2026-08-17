import json
import re
import difflib
import os

def clean_question(text):
    if not text: return ""
    text = text.lower()
    
    # Remove exam metadata often added to MD questions like (10M - 2016)
    text = re.sub(r'\(\s*\d+\s*m\s*[-]\s*\d{4}\s*\)', '', text)
    # Remove phrases commonly prefixed in JSON
    text = re.sub(r'(write|answer).*?in\s+(about\s+)?\d+\s+words\s+each\s*:?', '', text)
    text = re.sub(r'write (a )?(short )?note(s)? on', '', text)
    text = re.sub(r'in \d+ words', '', text)
    text = re.sub(r'critically examine', '', text)
    
    # Remove non-alphanumeric chars (keep spaces)
    text = re.sub(r'[^a-z0-9\s]', '', text)
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def parse_markdown(md_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    questions = []
    # Split by '## Question '
    parts = content.split('## Question ')
    
    for part in parts[1:]: # Skip everything before the first question
        # Extract Question text
        q_match = re.search(r'\*\*Question:\*\*\s*(.*?)(?=\n\*\*(Year|Marks):|\n\n)', part, re.IGNORECASE | re.DOTALL)
        if not q_match:
            continue
        q_text = q_match.group(1).strip()
        
        # Extract Answer text (stop at ---)
        ans_start_idx = part.find('## ANSWER')
        if ans_start_idx == -1:
            ans_start_idx = part.find('## Answer')
            
        if ans_start_idx != -1:
            ans_block = part[ans_start_idx:]
            # Find the first '---' after the answer starts
            ans_end_idx = ans_block.find('\n---')
            if ans_end_idx != -1:
                answer_text = ans_block[:ans_end_idx].strip()
            else:
                answer_text = ans_block.strip() # If no --- found, take rest of block
                
            questions.append({
                'q_text': q_text,
                'q_clean': clean_question(q_text),
                'ans_text': answer_text
            })
            
    return questions

def run_sync(md_path, json_path, output_json_path, log_path):
    md_qs = parse_markdown(md_path)
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    matched_count = 0
    unmatched_md = []
    
    logs = []
    
    # Pre-clean JSON questions
    json_qs = data.get('questions', [])
    for q in json_qs:
        q['_clean'] = clean_question(q.get('questionText', ''))
        
    for md_q in md_qs:
        best_match = None
        best_ratio = 0
        
        for jq in json_qs:
            ratio = difflib.SequenceMatcher(None, md_q['q_clean'], jq['_clean']).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_match = jq
                
        if best_ratio > 0.75:
            matched_count += 1
            logs.append(f"MATCH ({best_ratio:.2f}):\n  MD:   {md_q['q_text'][:100]}...\n  JSON: {best_match.get('questionText', '')[:100]}...\n")
            
            # Perform injection (Dry Run logic, but we do update the data in memory)
            if 'answers' in best_match:
                for ans in best_match['answers']:
                    inst = ans.get('instituteName', ans.get('institute', ''))
                    if inst == 'Compass':
                        ans['answerText'] = md_q['ans_text']
                        break
        else:
            unmatched_md.append(f"UNMATCHED (Best {best_ratio:.2f}):\n  MD:   {md_q['q_text'][:100]}...\n  JSON: {(best_match.get('questionText', '')[:100] if best_match else 'None')}...\n")
            
    # Clean up temporary _clean keys
    for jq in json_qs:
        if '_clean' in jq:
            del jq['_clean']
            
    # Write Logs
    with open(log_path, 'w', encoding='utf-8') as f:
        f.write(f"Total MD Questions: {len(md_qs)}\n")
        f.write(f"Matched: {matched_count}\n")
        f.write(f"Unmatched: {len(unmatched_md)}\n\n")
        f.write("=== UNMATCHED ===\n")
        f.write("\n".join(unmatched_md) + "\n\n")
        f.write("=== MATCHES ===\n")
        f.write("\n".join(logs))
        
    # Write updated JSON
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print(f"Processed {os.path.basename(md_path)}. Matched {matched_count}/{len(md_qs)}. Logs written to {log_path}")

if __name__ == '__main__':
    run_sync(
        r'C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\P-1 Anthro PYQs (2013-25) Master Extraction - CONSOLIDATED.md',
        r'C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\mains-upsc_anthro_paper_1_2012-2025_compass_updated_v3.json',
        r'C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\mains-upsc_anthro_paper_1_2012-2025_compass_updated_v3_SYNCED.json',
        r'C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\sync_log_p1.txt'
    )
    
    run_sync(
        r'C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\P-II Anthro PYQs (2013-25) Master Extraction - CONSOLIDATED.md',
        r'C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\mains-upsc_anthro_paper_2_2012-2025_compass_updated_v3.json',
        r'C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\mains-upsc_anthro_paper_2_2012-2025_compass_updated_v3_SYNCED.json',
        r'C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\sync_log_p2.txt'
    )
