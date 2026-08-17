import os
import re

md_files = [
    r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\P-1 Anthro PYQs (2013-25) Master Extraction - CONSOLIDATED.md",
    r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\P-II Anthro PYQs (2013-25) Master Extraction - CONSOLIDATED.md"
]

def main():
    found_questions = []
    
    for filepath in md_files:
        if not os.path.exists(filepath):
            continue
            
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        # Find lines starting with 8 or more spaces and a hyphen
        # We will split by questions (## Question)
        questions = content.split("## Question")
        for q in questions[1:]:
            # Check if this question has 8 spaces indent
            if re.search(r'^( {8,})\-', q, flags=re.MULTILINE):
                # Extract question title
                title_match = re.search(r'\*\*Question:\*\*(.*?)\n', q)
                if title_match:
                    title = title_match.group(1).strip()
                    year_match = re.search(r'\*\*Year:\*\*(.*?)\n', q)
                    year = year_match.group(1).strip() if year_match else "Unknown"
                    found_questions.append(f"{title} ({year})")
                    
    print("\n--- Questions containing deep sub-sub-bullets ---")
    for i, q in enumerate(found_questions[:5]):
        print(f"{i+1}. {q}")
    if not found_questions:
        print("None found!")

if __name__ == "__main__":
    main()
