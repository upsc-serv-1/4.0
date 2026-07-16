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
        
    sec_parts = re.split(r'\n###\s+Section\s+Group:\s*', content)
    print("sec_parts:", len(sec_parts))
    for idx, sec_part in enumerate(sec_parts[1:]):
        lines = sec_part.split('\n')
        sec_grp = strip_clean(lines[0])
        sec_content = "\n".join(lines[1:])
        
        # Look at the separator in the file
        # The file content uses:
        # ### Section Group: Art and Culture
        # #### Microtopic: Indian Culture-Salient aspects of Art Forms, ...
        # Let's see if there is a carriage return \r\n!
        print(f"Sec {idx}: {sec_grp}, content starts with: {repr(sec_content[:100])}")
        
        micro_parts = re.split(r'\n####\s+Microtopic:\s*', sec_content)
        print("  micro_parts:", len(micro_parts))
        
test()
