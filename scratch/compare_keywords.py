import re

md_path = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains tab md files\value additions\ethics\ETHICS 2025 KEYWORDS.md"

with open(md_path, 'r', encoding='utf-8') as f:
    md_content = f.read()

keywords_in_md = re.findall(r'^##\s+\d+\.\s*(.+)$', md_content, re.MULTILINE)
print(f"Total keywords in existing MD: {len(keywords_in_md)}")
print("First 10 keywords in MD:", keywords_in_md[:10])
print("Last 10 keywords in MD:", keywords_in_md[-10:])
