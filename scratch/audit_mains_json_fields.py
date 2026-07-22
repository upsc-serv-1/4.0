import json
import os
import glob

mains_dir = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files"
json_files = glob.glob(os.path.join(mains_dir, "*.json"))

print(f"Found {len(json_files)} JSON files in {mains_dir}:")

for fpath in sorted(json_files):
    fname = os.path.basename(fpath)
    try:
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        questions = data.get("questions", [])
        if not questions:
            print(f"  {fname}: No questions array or empty")
            continue
            
        q_sample = questions[0]
        ei = q_sample.get("exam_info", {})
        
        # Check counts of is_upsc_cse in questions
        upsc_cse_true_cnt = sum(1 for q in questions if q.get("exam_info", {}).get("is_upsc_cse") is True or q.get("is_upsc_cse") is True)
        upsc_cse_false_cnt = sum(1 for q in questions if q.get("exam_info", {}).get("is_upsc_cse") is False or q.get("is_upsc_cse") is False)
        upsc_cse_none_cnt = len(questions) - (upsc_cse_true_cnt + upsc_cse_false_cnt)
        
        q_num_sample = [q.get("questionNumber") for q in questions[:5]]
        
        print(f"\n[{fname}] Total Qs: {len(questions)}")
        print(f"  Course: {data.get('course')}, Institute: {data.get('institute')}, Subject: {q_sample.get('subject')}")
        print(f"  Sample questionNumber: {q_num_sample}")
        print(f"  is_upsc_cse counts -> True: {upsc_cse_true_cnt}, False: {upsc_cse_false_cnt}, None: {upsc_cse_none_cnt}")
        print(f"  exam_info sample: {ei}")
    except Exception as e:
        print(f"  {fname}: Error loading - {e}")
