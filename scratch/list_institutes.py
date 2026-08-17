import json

filepath = r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 2 - Copy\backup\mains-upsc_anthro_paper_1_2012-2025_consolidated_with_levelpanswers.json"

def main():
    institutes = set()
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        for q in data.get("questions", []):
            for a in q.get("answers", []):
                institutes.add(a.get("institute", ""))
                
        print("Institutes found in the JSON file:")
        for inst in institutes:
            print(f"- {inst}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
