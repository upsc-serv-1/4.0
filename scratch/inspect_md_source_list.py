import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

md_files = [
    r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\P-1 Anthro PYQs (2013-25) Master Extraction - CONSOLIDATED.md"
]

def main():
    for filepath in md_files:
        print(f"\nInspecting Cleaned File: {os.path.basename(filepath)}")
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        idx = content.find("Experimental archaeology showed")
        if idx != -1:
            start = max(0, idx - 200)
            end = min(len(content), idx + 200)
            print("--- Snippet ---")
            print(repr(content[start:end]))
            print("---------------")

if __name__ == "__main__":
    main()
