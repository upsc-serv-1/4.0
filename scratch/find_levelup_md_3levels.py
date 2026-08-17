import os
import re

md_files = [
    r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 2 - Copy\backup\Anthropology Paper 1 PYQ 2018-2025 Karandeep Sir LevelUP PYQ.md",
    r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 2 - Copy\backup\Anthropology Paper 2 PYQ 2018-2025 Karandeep Sir LevelUP PYQ.md"
]

def main():
    found_any = False
    
    for filepath in md_files:
        if not os.path.exists(filepath):
            continue
            
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        # Let's search for lines that start with 8 or more spaces followed by a hyphen or bullet
        # Or numbers like '1.' or 'a.'
        
        questions = content.split("## Question")
        for q in questions[1:]:
            match = re.search(r'(^ {8,}[\-\*A-Za-z0-9\.] .*$)', q, flags=re.MULTILINE)
            if match:
                title_match = re.search(r'\*\*Question:\*\*(.*?)\n', q)
                if title_match:
                    title = title_match.group(1).strip()
                    year_match = re.search(r'\*\*Year:\*\*(.*?)\n', q)
                    year = year_match.group(1).strip() if year_match else "Unknown"
                    
                    # Print the exact snippet to be absolutely sure!
                    # Find a block of text containing the match
                    idx = match.start()
                    print(f"Question: {title} ({year})")
                    print("Snippet:")
                    print(q[max(0, idx-200):idx+250])
                    print("-" * 50)
                    found_any = True
                    if found_any: break
        if found_any: break
        
    if not found_any:
        print("Could not find any 8-space indented text in LevelUp MD files.")

if __name__ == "__main__":
    main()
