import json
import os
import re

# JSON source paths
mains_dir = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files"
files_config = [
    {
        "input": os.path.join(mains_dir, "mains_anthro1_new_consolidated.json"),
        "output": os.path.join(mains_dir, "anthro1_questions_post2012.txt"),
        "title": "Anthropology Paper 1 (2012-Present)"
    },
    {
        "input": os.path.join(mains_dir, "mains_anthro2_new_consolidated.json"),
        "output": os.path.join(mains_dir, "anthro2_questions_post2012.txt"),
        "title": "Anthropology Paper 2 (2012-Present)"
    },
    {
        "input": os.path.join(mains_dir, "mains_anthro1_pre2012.json"),
        "output": os.path.join(mains_dir, "anthro1_questions_pre2012.txt"),
        "title": "Anthropology Paper 1 (Pre-2012)"
    },
    {
        "input": os.path.join(mains_dir, "mains_anthro2_pre2012.json"),
        "output": os.path.join(mains_dir, "anthro2_questions_pre2012.txt"),
        "title": "Anthropology Paper 2 (Pre-2012)"
    }
]

# Prompt instruction template
PROMPT_HEADER = """================================================================================
GEMINI PROMPT INSTRUCTIONS FOR ANTHROPOLOGY OPTIONAL MODEL ANSWERS
================================================================================
Act as an expert Anthropology professor and UPSC civil services exam mentor.
You are required to write high-scoring model answers for the following UPSC Anthropology Optional questions.

Please strictly follow these formatting guidelines:
1. The output must be written in high-quality Markdown, using standard markdown elements:
   - Headings (###) and subheadings (####) for clean structure.
   - Bullet points (-) and numbered lists (1.) for clarity.
   - Tables (| Column 1 | Column 2 |) where comparison is needed.
2. Highlight and BOLD key terms, important scholars, anthropological theories, case studies, tribal examples, and key data points.
   - For example: **M.N. Srinivas**, **L.H. Morgan**, **Functionalism**, **Gond tribe**, **Sanskritization**, etc.
3. Every answer must follow a standard high-scoring mains structure:
   - Introduction: Define the core anthropological concept or term and give context.
   - Body: Elaborate points, include scholars, case studies, and diagrams/flowcharts description where applicable.
   - Conclusion: Summarize the anthropological significance or contemporary relevance.
4. Surround each answer with the custom delimiters <<<START_ANSWER id="[QUESTION_ID]">>> and <<<END_ANSWER>>> exactly as shown below:

<<<START_ANSWER id="[QUESTION_ID]">>>
### Introduction
[Intro text here...]

### Body
[Body text here...]

### Conclusion
[Conclusion text here...]
<<<END_ANSWER>>>

Do NOT include any extra conversational text or preambles outside these delimiters.
================================================================================
QUESTIONS LIST:
================================================================================
"""

def extract_word_limit(q_text, microtag):
    # Search for word count patterns like "150 words", "250 words" in question text or microtag
    combined = f"{q_text} {microtag or ''}"
    match = re.search(r'(\d+)\s*-?\s*words', combined, re.IGNORECASE)
    if match:
        return f"{match.group(1)} words"
    return "Not specified"

def main():
    for cfg in files_config:
        input_path = cfg["input"]
        output_path = cfg["output"]
        
        if not os.path.exists(input_path):
            print(f"Skipping: {input_path} (does not exist)")
            continue
            
        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        questions = data.get("questions", [])
        
        with open(output_path, "w", encoding="utf-8") as out:
            out.write(PROMPT_HEADER)
            
            for idx, q in enumerate(questions):
                q_id = q.get("id")
                q_text = q.get("questionText", "").strip()
                marks = q.get("marks")
                microtag = q.get("microtag", "")
                
                word_limit = extract_word_limit(q_text, microtag)
                marks_str = f"{marks} Marks" if marks is not None else "Not specified"
                
                out.write(f"Question #{idx+1}\n")
                out.write(f"ID: {q_id}\n")
                out.write(f"Marks: {marks_str}\n")
                out.write(f"Word Limit: {word_limit}\n")
                out.write(f"Question: {q_text}\n")
                out.write("-" * 80 + "\n\n")
                
        print(f"Generated text file: {os.path.basename(output_path)} with {len(questions)} questions.")

if __name__ == "__main__":
    main()
