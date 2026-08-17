import os
import re

md_files = [
    r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\P-1 Anthro PYQs (2013-25) Master Extraction - CONSOLIDATED.md",
    r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\P-II Anthro PYQs (2013-25) Master Extraction - CONSOLIDATED.md"
]

def main():
    found = False
    for filepath in md_files:
        if not os.path.exists(filepath):
            continue
            
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        # We want to find a line starting with "- " or "* " or "•"
        # Followed by a line starting with "    - " (4 spaces) or "\t- "
        # We will split by questions to get the exact question title
        questions = content.split("## Question")
        for q in questions[1:]:
            # Regex: match a top-level bullet, then any number of text lines, then a sub-bullet
            # Top-level: starts with a letter, maybe some spaces, but let's just look for a standard list hierarchy
            # A line starting with exactly "- " or "* " or "•"
            # followed by some newlines
            # followed by a line starting with 4 to 8 spaces and "- " or "* " or "•"
            
            # Since the user used U+2022 originally or now hyphens, let's look for:
            # ^\- (.*?)\n+(?:^ {4,8}\- .*$)
            if re.search(r'^[\-\*] (.*?)\n+(?:^ {4,10}[\-\*] .*$)', q, flags=re.MULTILINE):
                title_match = re.search(r'\*\*Question:\*\*(.*?)\n', q)
                if title_match:
                    title = title_match.group(1).strip()
                    year_match = re.search(r'\*\*Year:\*\*(.*?)\n', q)
                    year = year_match.group(1).strip() if year_match else "Unknown"
                    
                    # Print the exact snippet to be absolutely sure!
                    match = re.search(r'(^[\-\*] (.*?)\n+(?:^ {4,10}[\-\*] .*$)+)', q, flags=re.MULTILINE)
                    if match:
                        print(f"Question: {title} ({year})")
                        print("Snippet:")
                        print(match.group(1))
                        print("-" * 50)
                        found = True
                        if found: break # Just find one good example
        if found: break

if __name__ == "__main__":
    main()
