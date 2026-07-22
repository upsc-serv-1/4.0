import re

file_path = r"C:\Users\Dr. Yogesh\Downloads\Qwen__20260722_byxmvixnv.txt"

with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

pattern = r'\[(\d{4})/([I|V|X]+)/([^/]+)/(\d+)\]\s*(.*?)\n+Hierarchy:\s*(.*?)(?=\n+\[|\Z)'
matches = list(re.finditer(pattern, text, re.DOTALL))

all_q_headers = re.findall(r'\[\d{4}/[I|V|X]+/[^/]+/\d+\]', text)

print(f"Total [Year/Paper/QNo/Marks] headers in file: {len(all_q_headers)}")
print(f"Total matched questions by regex: {len(matches)}")

if len(all_q_headers) != len(matches):
    print("WARNING: Some questions were not matched by regex!")
else:
    print("ALL questions matched perfectly!")
