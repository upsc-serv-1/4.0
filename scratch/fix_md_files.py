import re
import os

md_files = [
    r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\P-1 Anthro PYQs (2013-25) Master Extraction - CONSOLIDATED.md",
    r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\P-II Anthro PYQs (2013-25) Master Extraction - CONSOLIDATED.md"
]

def clean_markdown_content(content):
    # 1. Replace all U+00A0 non-breaking spaces with standard spaces
    content = content.replace('\xa0', ' ')
    
    # 2. Fix nested bullets and remove trailing <br> tags from list items
    # Remove any <br> at the end of lines that precedes a bullet line
    content = re.sub(r':\s*<br>\s*\n(\s*[\u2022\-\*])', r':\n\1', content)
    content = re.sub(r';\s*<br>\s*\n(\s*[\u2022\-\*])', r';\n\1', content)
    content = re.sub(r'\.\s*<br>\s*\n(\s*[\u2022\-\*])', r'.\n\1', content)
    
    # Also handle general <br>\n followed by indent and bullet
    content = re.sub(r'<br>\s*\n(\s*[\u2022\-\*])', r'\n\1', content)
    
    # 3. Convert literal bullet points (•) to hyphens (-) while PRESERVING the exact indentation spaces
    # Group 1 captures the exact indentation spaces
    # Group 2 captures any spaces after the bullet character
    content = re.sub(r'^([ \t]+)\u2022(\s*)', r'\1-\2', content, flags=re.MULTILINE)
    
    # 4. Remove <br> tags at the end of bullet lines (starting with spaces + hyphen + text)
    content = re.sub(r'(^[ \t]*\- .*?)\s*<br>\s*$', r'\1', content, flags=re.MULTILINE)
    
    return content

def main():
    for filepath in md_files:
        print(f"\nProcessing: {os.path.basename(filepath)}")
        if not os.path.exists(filepath):
            print("  [ERROR] File not found!")
            continue
            
        # Read file
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        print("  Original length:", len(content))
        cleaned = clean_markdown_content(content)
        print("  Cleaned length:", len(cleaned))
        
        # Write file back
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(cleaned)
        print("  [SUCCESS] Overwritten with standard formatting.")

if __name__ == "__main__":
    main()
