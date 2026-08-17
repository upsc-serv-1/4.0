import re
import os

filepath = r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\old\P-1 Anthro PYQs (2013-25) Master Extraction - CONSOLIDATED.md"

def main():
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
        
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
    # We want to find lines that start with any kind of whitespace followed by a bullet
    # and print their raw representation so we can see the exact characters.
    
    from collections import Counter
    
    # Match 1 or more spaces/tabs/non-breaking spaces, then a bullet
    pattern = r'(^[ \t\xa0]+)[\u2022\-\*].*$'
    matches = re.finditer(pattern, content, flags=re.MULTILINE)
    
    lengths = Counter()
    
    for match in matches:
        spaces = match.group(1)
        # Count the number of characters in the whitespace block
        lengths[len(spaces)] += 1
        
    print("--- Frequency of Indentation Lengths ---")
    for length, count in sorted(lengths.items()):
        print(f"{length} spaces: used {count} times")
        
    if not lengths:
        print("No indented bullets found!")

if __name__ == "__main__":
    main()
