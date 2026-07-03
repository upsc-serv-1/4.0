import re

MD_FILES = [
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 001-100.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 101-200.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1  201-300.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 301-400.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1  401-500.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 501-565.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 566-600.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 601-650.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 651-700.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 701-800.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 801-900.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 901-1000.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 1001-1100.md",
    r"C:\Users\Dr. Yogesh\Desktop\mains\anthro with ai ide\anthro\paper 1\p1 1101-1157.md",
]

HEADER_START_RE = re.compile(r'^\*\*Q(\d+)\.', re.IGNORECASE)

def clean_q_text(line, q_num):
    text = re.sub(rf'^\*\*Q{q_num}\.\s*', '', line, flags=re.IGNORECASE)
    text = re.sub(r'\*\*\s*$', '', text)
    # Remove parenthetical wrappers containing Year/Marks/UPSC/Paper
    text = re.sub(r'\(\s*(?:UPSC|Paper\s*\d+|[\w\s\.,]*/?)*\[Year:.*?\)\s*$', '', text, flags=re.IGNORECASE)
    # Remove bracket markers
    text = re.sub(r'\[Year:\s*[^\]]+\]', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\[Marks:\s*[^\]]+\]', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\bUPSC\b', '', text, flags=re.IGNORECASE)
    text = text.strip()
    text = re.sub(r'[\s,\.\(\)\[\]\-]+$', '', text)
    return text.strip()

parsed_count = 0
samples = []

for fp in MD_FILES:
    with open(fp, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f):
            line_str = line.strip()
            m = HEADER_START_RE.match(line_str)
            if m:
                parsed_count += 1
                q_num = int(m.group(1))
                # Extract year
                year_match = re.search(r'\[Year:\s*([^\]]+)\]', line_str, re.IGNORECASE)
                year = None
                if year_match:
                    year_val = year_match.group(1).strip()
                    yr_num = re.search(r'\d{4}', year_val)
                    if yr_num:
                        year = int(yr_num.group(0))
                        
                # Extract marks
                marks_match = re.search(r'\[Marks:\s*([^\]]+)\]', line_str, re.IGNORECASE)
                marks = None
                if marks_match:
                    marks_val = marks_match.group(1).strip()
                    m_num = re.search(r'\d+', marks_val)
                    if m_num:
                        marks = int(m_num.group(0))
                        
                cleaned = clean_q_text(line_str, q_num)
                
                if len(samples) < 10 or q_num in [33, 85, 209, 211, 214, 233]:
                    samples.append((q_num, year, marks, cleaned))
                    
print("Total questions found with header pattern:", parsed_count)
print("Sample parsed questions:")
for s in samples[:15]:
    print(f"  Q{s[0]} [Year: {s[1]}] [Marks: {s[2]}]: {s[3]}")
