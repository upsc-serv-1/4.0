import json
import os
import glob

mains_dir = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files"
json_files = glob.glob(os.path.join(mains_dir, "*.json"))

print(f"Checking {len(json_files)} JSON files...\n")

for fpath in sorted(json_files):
    fname = os.path.basename(fpath)
    try:
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        questions = data.get("questions", [])
        if not questions:
            continue
            
        is_upsc_cse_vals = set()
        exam_group_vals = set()
        exam_category_vals = set()
        
        for q in questions:
            ei = q.get("exam_info", {}) or {}
            
            # Check is_upsc_cse
            c_val = q.get("is_upsc_cse")
            if c_val is None:
                c_val = ei.get("is_upsc_cse")
            is_upsc_cse_vals.add(str(c_val))
            
            # Check group
            g_val = q.get("exam_group")
            if g_val is None:
                g_val = ei.get("group")
            exam_group_vals.add(str(g_val))
            
            # Check exam_category
            ec_val = q.get("exam_category")
            if ec_val is None:
                ec_val = ei.get("exam_category")
            exam_category_vals.add(str(ec_val))
            
        print(f"[{fname}] ({len(questions)} Qs):")
        print(f"  is_upsc_cse: {is_upsc_cse_vals}")
        print(f"  exam_group:  {exam_group_vals}")
        print(f"  exam_category: {exam_category_vals}")
    except Exception as e:
        print(f"[{fname}] Error: {e}")
