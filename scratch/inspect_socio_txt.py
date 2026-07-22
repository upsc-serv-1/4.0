import re

file_path = r"C:\Users\Dr. Yogesh\Downloads\Qwen__20260722_byxmvixnv.txt"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")

paper_headers = []
chapter_headers = []
question_lines = []

for idx, line in enumerate(lines):
    if "SOCIOLOGY PAPER" in line.upper():
        paper_headers.append((idx + 1, line.strip()))
    elif "CHAPTER" in line.upper():
        chapter_headers.append((idx + 1, line.strip()))
    elif re.match(r'^\s*\[\d{4}/', line):
        question_lines.append((idx + 1, line.strip()))

print("\n--- PAPER HEADERS ---")
for p in paper_headers:
    print(f"Line {p[0]}: {p[1]}")

print(f"\n--- CHAPTER HEADERS ({len(chapter_headers)} chapters) ---")
for c in chapter_headers[:15]:
    print(f"Line {c[0]}: {c[1]}")
if len(chapter_headers) > 15:
    print(f"... and {len(chapter_headers)-15} more chapters")

print(f"\n--- TOTAL QUESTIONS FOUND: {len(question_lines)} ---")
print("First 3 questions:")
for q in question_lines[:3]:
    print(f"Line {q[0]}: {q[1]}")

print("Last 3 questions:")
for q in question_lines[-3:]:
    print(f"Line {q[0]}: {q[1]}")
