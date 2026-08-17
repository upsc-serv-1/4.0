import re
import os

def fix_lists_in_file(filepath):
    print(f"\nProcessing {os.path.basename(filepath)}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
        
    original_text = text
    
    # Regex 1: Numeric Lists (e.g. "** 1. **" or ". 1. Primary")
    pattern1 = r'(\*\*|\:|\.)[ \t]+(\d{1,2}\.\s+(?:\*\*|[A-Z]))'
    
    # Regex 2: Alphabetic Lists (e.g. "globally. **B. Middle" or "BehaviourA. Lower")
    pattern2 = r'([a-z\.\,])[ \t]*(\*\*?[A-I]\.\s+(?:\*\*|[A-Z])[A-Za-z]{2,})'
    
    # Track how many times we fix something
    def count_and_replace(match):
        return match.group(1) + '\n\n' + match.group(2)
        
    text, count1 = re.subn(pattern1, count_and_replace, text)
    print(f"  Fixed {count1} numeric lists.")
    
    text, count2 = re.subn(pattern2, count_and_replace, text)
    print(f"  Fixed {count2} alphabetic lists.")
    
    if text != original_text:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(text)
        print("  File updated successfully!")
    else:
        print("  No changes needed.")

if __name__ == '__main__':
    files = [
        r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\P-1 Anthro PYQs (2013-25) Master Extraction - CONSOLIDATED.md",
        r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\P-II Anthro PYQs (2013-25) Master Extraction - CONSOLIDATED.md"
    ]
    
    for f in files:
        if os.path.exists(f):
            fix_lists_in_file(f)
        else:
            print(f"[ERROR] File not found: {f}")
