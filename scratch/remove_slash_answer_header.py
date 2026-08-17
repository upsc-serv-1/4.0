import json
import re
import os

TARGET_INSTITUTE = "Levelup IAS"

BACKUP_PAIRS = [
    {
        "backup_md": r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\LEVELUP BOOK\New folder\Anthropology_PAPER_1_PYQs_20_25_Extracted - Copy.md",
        "target_md": r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_1_PYQs_20_25_Extracted.md",
        "json":      r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro1_new_consolidated.json",
        "label":     "Paper 1"
    },
    {
        "backup_md": r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\LEVELUP BOOK\New folder\Anthropology_PAPER_2_PYQs_20_25_Extracted - Copy.md",
        "target_md": r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_2_PYQs_20_25_Extracted.md",
        "json":      r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro2_new_consolidated.json",
        "label":     "Paper 2"
    }
]

def format_cell_lines_with_hierarchy(text_block):
    lines = text_block.strip().split('\n')
    formatted = []
    for line in lines:
        if not line.strip():
            continue
        leading_spaces = len(line) - len(line.lstrip())
        l = line.strip()
        is_sub = leading_spaces >= 2 or l.startswith('o ') or l.startswith('• ') and leading_spaces > 0
        l = re.sub(r'^(?:[-*•✔✓💡❌o]|\s)+', '', l).strip()
        l = l.replace('|', '\\|')

        if is_sub:
            formatted.append(f"&nbsp;&nbsp;&nbsp;&nbsp;◦ {l}")
        else:
            formatted.append(f"• {l}")
    return ' <br> '.join(formatted)

def process_section_clean(ma_body):
    if not ma_body:
        return "", ""

    lines = ma_body.split('\n')
    clean_lines = [l for l in lines if l.strip() != '---']
    text = '\n'.join(clean_lines).strip()

    aspects_match = re.search(
        r'(?:[-*•✔✓]|\s)*(?:\*\*|__)?(?:[✔✓]|\s)*Aspects?\s+to\s+Take\s+in?to\s+Account(?:\*\*|__)?\s*\n(.*?)(?=\n\s*(?:[-*•✔✓]|\s)*(?:\*\*|__)?\s*Structure\s+to\s+Follow|\n\s*(?:[-*•✔✓]|\s)*(?:\*\*|__)?\s*Don\'?ts?|\n\s*#{1,4}\s+|\Z)',
        text, re.DOTALL | re.I
    )
    structure_match = re.search(
        r'(?:[-*•✔✓]|\s)*(?:\*\*|__)?\s*Structure\s+to\s+Follow(?:\*\*|__)?\s*\n(.*?)(?=\n\s*(?:[-*•✔✓]|\s)*(?:\*\*|__)?\s*Don\'?ts?|\n\s*#{1,4}\s+|\/\/|\Z)',
        text, re.DOTALL | re.I
    )
    donts_match = re.search(
        r'(?:[-*•✔✓]|\s)*(?:\*\*|__)?\s*Don\'?ts?\s*(?:\*\*|__)?\s*\n(.*?)(?=\n\s*(?:#{1,4}|\/\/|\*\*ANSWER\*\*|\*\*Model Answer\*\*)\s*|\Z)',
        text, re.DOTALL | re.I
    )

    if aspects_match:
        aspects_text = format_cell_lines_with_hierarchy(aspects_match.group(1))
        structure_text = format_cell_lines_with_hierarchy(structure_match.group(1)) if structure_match else "-"
        donts_text = format_cell_lines_with_hierarchy(donts_match.group(1)) if donts_match else "-"

        table_md = (
            f"| **✔ Aspects to Take into Account** | **💡 Structure to Follow** | **❌ Don'ts** |\n"
            f"| --- | --- | --- |\n"
            f"| {aspects_text} | {structure_text} | {donts_text} |\n\n"
        )

        if donts_match: end_pos = donts_match.end()
        elif structure_match: end_pos = structure_match.end()
        else: end_pos = aspects_match.end()

        rest = text[end_pos:].strip()
    else:
        table_md = ""
        rest = text.strip()

    # Clean headers, remove Introduction headers and // ANSWER headers completely
    rest = re.sub(r'^(?:#{1,4}\s*)?(?:\*\*|__)?\s*(?:ANSWER|Model Answer|Introduction|\/\/ ANSWER)\s*(?:\*\*|__)?\s*\n?', '', rest, flags=re.I).strip()
    rest = re.sub(r'^(?:\*\*|__)?\s*Notes?\s*(?:\*\*|__)?\s*\n?', '', rest, flags=re.I).strip()

    # Format Conclusion header
    rest = re.sub(r'\n(?:\s*#{1,4}\s*)?(?:\*\*|__)?\s*Conclusion\s*(?:\*\*|__)?\s*:\s*\n?', r'\n\n### **Conclusion**\n\n', rest, flags=re.I)
    rest = re.sub(r'\n(?:\s*#{1,4}\s*)?(?:\*\*|__)?\s*Conclusion\s*(?:\*\*|__)?\s*\n', r'\n\n### **Conclusion**\n\n', rest, flags=re.I)

    full_formatted_body = "## Model Answer\n\n" + rest

    if table_md:
        formatted_section_text = table_md + full_formatted_body
        json_answer_text = table_md + full_formatted_body
    else:
        formatted_section_text = full_formatted_body
        json_answer_text = full_formatted_body

    return formatted_section_text, json_answer_text

def process_pristine_backup_clean(backup_path, target_path):
    with open(backup_path, "r", encoding="utf-8") as f:
        raw_md = f.read()

    secs = re.split(r'\n(?=##\s*Question\s*\d+|\Z)', raw_md)
    processed_secs = []
    extracted_entries = []

    for s in secs:
        if not s.strip() or s.startswith("# Table of Contents"):
            processed_secs.append(s.strip())
            continue

        q_id_m = re.search(r'\*\*Question ID:\*\*\s*`?(mains-[a-z0-9\-]+)`?', s)
        q_id = q_id_m.group(1).strip() if q_id_m else None

        q_txt_m = re.search(r'\*\*Question:\*\*\s*(.*?)(?=\*\*Year:\*\*|\*\*Marks:\*\*|\n\n|\Z)', s, re.DOTALL)
        question_text = q_txt_m.group(1).strip() if q_txt_m else ""

        ma_split = re.split(r'\n##\s*Model Answer\s*\n', s, flags=re.I)
        if len(ma_split) > 1:
            q_header = ma_split[0].strip()
            ma_body = ma_split[1].strip()

            formatted_sec_text, json_ans_text = process_section_clean(ma_body)

            full_q_sec = q_header + "\n\n" + formatted_sec_text
            processed_secs.append(full_q_sec)

            extracted_entries.append({
                "q_id": q_id,
                "question_text": question_text,
                "answer_text": json_ans_text
            })
        else:
            processed_secs.append(s.strip())

    final_md = "# Table of Contents\n[TOC]\n\n" + "\n\n---\n\n".join(processed_secs) + "\n\n---\n"

    with open(target_path, "w", encoding="utf-8") as f:
        f.write(final_md)

    print(f"  Generated {os.path.basename(target_path)} cleanly without // ANSWER ({os.path.getsize(target_path)} bytes)")
    return extracted_entries

def main():
    for pair in BACKUP_PAIRS:
        label = pair["label"]
        print(f"\n{'='*60}")
        print(f"  Removing // ANSWER Header for {label}")
        print(f"{'='*60}")

        extracted_entries = process_pristine_backup_clean(pair["backup_md"], pair["target_md"])

        with open(pair["json"], "r", encoding="utf-8") as f:
            data = json.load(f)

        questions = data.get("questions", [])
        q_map = {q["id"]: q for q in questions if "id" in q}

        for md_item in extracted_entries:
            target_q = None
            if md_item["q_id"] and md_item["q_id"] in q_map:
                target_q = q_map[md_item["q_id"]]
            else:
                for q in questions:
                    if md_item["question_text"] and md_item["question_text"].lower()[:30] in q.get("questionText", "").lower():
                        target_q = q
                        break

            if target_q:
                q_id = target_q["id"]
                ans_id = f"{q_id}-levelup_ias"

                cleaned_ans = [a for a in target_q.get("answers", []) if a.get("institute") not in ["Model Answer", TARGET_INSTITUTE]]
                cleaned_ans.append({
                    "id": ans_id,
                    "institute": TARGET_INSTITUTE,
                    "answerText": md_item["answer_text"]
                })
                target_q["answers"] = cleaned_ans

        with open(pair["json"], "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  {label} JSON updated locally.")

    print("\nDone! // ANSWER header removed from local MD & JSON files. (Supabase upload skipped per directive)")

if __name__ == "__main__":
    main()
