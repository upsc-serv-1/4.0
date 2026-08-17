import json
import sys
import os

# Let's import parse_markdown from our sync script
sys.path.append(r'C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\scratch')
from sync_answers import parse_markdown

# Define the overrides
overrides_p1 = [
    {
        'md_search': 'Critically Examine the Concept of Avoidance and Joking Relationships',
        'json_search': 'Critical perspective on avoidance and joking relationship'
    }
]

overrides_p2 = [
    {
        'md_search': 'Contribution of M.N. Srinivas to the Study of Indian Society',
        'json_search': 'Discuss the contribution of M. N. Srinivas to the study of Indian society'
    },
    {
        'md_search': 'Discuss the impact of the Forest Rights Act',
        'json_search': 'Recognition of Forest Right\'s Act 2006'
    }
]

def apply_overrides(md_path, json_path, overrides):
    md_qs = parse_markdown(md_path)
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    json_qs = data.get('questions', [])
    success_count = 0
    
    for override in overrides:
        # Find MD Answer
        md_ans = None
        for q in md_qs:
            if override['md_search'].lower() in q['q_text'].lower():
                md_ans = q['ans_text']
                break
                
        if not md_ans:
            print(f"Could not find MD answer for: {override['md_search']}")
            continue
            
        # Find JSON Question
        for jq in json_qs:
            if override['json_search'].lower() in jq.get('questionText', '').lower():
                # Inject
                if 'answers' in jq:
                    for ans in jq['answers']:
                        inst = ans.get('instituteName', ans.get('institute', ''))
                        if inst == 'Compass':
                            ans['answerText'] = md_ans
                            success_count += 1
                            print(f"SUCCESS: Injected '{override['md_search']}'")
                            break
                break
                
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print(f"Completed overrides. Success: {success_count}/{len(overrides)}")

# Apply P1
apply_overrides(
    r'C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\P-1 Anthro PYQs (2013-25) Master Extraction - CONSOLIDATED.md',
    r'C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\mains-upsc_anthro_paper_1_2012-2025_compass_updated_v3_SYNCED.json',
    overrides_p1
)

# Apply P2
apply_overrides(
    r'C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\P-II Anthro PYQs (2013-25) Master Extraction - CONSOLIDATED.md',
    r'C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\mains-upsc_anthro_paper_2_2012-2025_compass_updated_v3_SYNCED.json',
    overrides_p2
)
