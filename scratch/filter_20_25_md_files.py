import json
import os

J1_PATH = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro1_new_consolidated.json"
J2_PATH = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro2_new_consolidated.json"

MD1_PATH = r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_1_PYQs_20_25_Extracted.md"
MD2_PATH = r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_2_PYQs_20_25_Extracted.md"

def build_20_25_md_from_json(json_path, md_path, paper_title):
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    questions = data.get("questions", [])

    # Filter only questions with Levelup IAS answers or 2020-2025 with answers
    target_questions = [
        q for q in questions
        if any(a.get("institute") == "Levelup IAS" for a in q.get("answers", []))
    ]

    lines = [
        f"# {paper_title}",
        "",
        "---",
        ""
    ]

    for idx, q in enumerate(target_questions, start=1):
        q_id = q.get("id", f"q{idx}")
        q_text = q.get("questionText", "").strip()
        year = q.get("year", "N/A")
        marks = q.get("marks", "N/A")
        topic = q.get("topicName", "")
        subtopic = q.get("subtopicName", "")
        nanotopic = q.get("nanotopicName", "")

        lines.append(f"## Question {idx}")
        lines.append(f"**Question ID:** `{q_id}`")
        lines.append(f"**Question:** {q_text}")
        lines.append(f"**Year:** {year}")
        lines.append(f"**Marks:** {marks}")
        if topic:
            lines.append(f"**Topic:** {topic}")
        if subtopic:
            lines.append(f"**Subtopic:** {subtopic}")
        if nanotopic:
            lines.append(f"**Nanotopic:** {nanotopic}")
        lines.append("")

        answers = q.get("answers", [])
        if answers:
            lines.append("## Model Answer")
            lines.append("")
            for ans in answers:
                ans_text = ans.get("answerText", "").strip()
                lines.append(ans_text)
                lines.append("")

        lines.append("---")
        lines.append("")

    content = "\n".join(lines)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"Rebuilt {os.path.basename(md_path)} -> {os.path.getsize(md_path)} bytes ({len(target_questions)} questions)")

def main():
    build_20_25_md_from_json(J1_PATH, MD1_PATH, "Anthropology Paper 1 PYQs 2020-2025")
    build_20_25_md_from_json(J2_PATH, MD2_PATH, "Anthropology Paper 2 PYQs 2020-2025")

if __name__ == "__main__":
    main()
