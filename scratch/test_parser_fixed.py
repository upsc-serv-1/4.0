import os
import re

VA_DIR = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains tab md files\value additions"

def strip_clean(s):
    if not s: return ""
    return s.strip()

def test():
    filepath = os.path.join(VA_DIR, "keywords", "GS1_History_Keywords.md")
    if not os.path.exists(filepath):
        print("File not found")
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    sec_parts = re.split(r'(?m)^\s*###\s+Section\s+Group:\s*', content)
    print("sec_parts:", len(sec_parts))
    for idx, sec_part in enumerate(sec_parts[1:]):
        lines = sec_part.split('\n')
        sec_grp = strip_clean(lines[0])
        sec_content = "\n".join(lines[1:])
        
        micro_parts = re.split(r'(?m)^\s*####\s+Microtopic:\s*', sec_content)
        print(f"Sec {idx}: {sec_grp}, micro_parts: {len(micro_parts)}")
        for m_idx, micro_part in enumerate(micro_parts[1:]):
            m_lines = micro_part.split('\n')
            m_topic = strip_clean(m_lines[0])
            micro_content = "\n".join(m_lines[1:])
            
            sub_parts = re.split(r'(?m)^\s*#####\s+Subtopic:\s*', micro_content)
            print(f"  Micro {m_idx}: {m_topic}, sub_parts: {len(sub_parts)}")
            for s_idx, sub_part in enumerate(sub_parts[1:]):
                s_lines = sub_part.split('\n')
                s_topic = strip_clean(s_lines[0])
                sub_content = "\n".join(s_lines[1:])
                
                cards = sub_content.split('\n---')
                valid_cards = [c for c in cards if c.strip()]
                print(f"    Sub {s_idx}: {s_topic}, cards: {len(valid_cards)}")
        
test()
