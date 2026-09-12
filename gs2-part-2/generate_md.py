import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
catalog = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))
entries = catalog.get("entries", [])
syllabus = catalog.get("syllabus_index", [])
total_pages = catalog.get("total_pdf_pages", 0)
paper_title = catalog.get("paper_title", "GS2 Part-2")
subject_name = catalog.get("subject", "GS2-Part-2")
complete_md_name = f"{subject_name}-Complete.md"
consolidated_md_name = f"{subject_name}-consolidated.md"

cons_lines = [
    f"# {paper_title} — Complete Compilation (All {total_pages} Pages)",
    f"**Total Questions:** {len(entries)} | **Total Topics:** {len(syllabus)}",
    "",
    "---",
    ""
]

curr_topic = None
for e in entries:
    if e["topic_id"] != curr_topic:
        curr_topic = e["topic_id"]
        cons_lines.extend([
            f"# Topic {curr_topic}: {e['topic_name']}",
            "",
            "---",
            ""
        ])
    topper_str = e["topper"] + (f" (AIR {e['air']})" if e.get("air") else "")
    cons_lines.extend([
        f"## Question {e['global_id']}",
        f"**Question:** {e['question']}",
        f"**Year:** {e.get('year', '')}",
        f"**Marks:** {e.get('marks', 10)} marks",
        f"**Topper:** {topper_str}",
        f"**Topic:** {e['topic_name']}",
        f"**PDF Pages:** {', '.join(map(str, e['pdf_pages']))}",
        "",
        "## ANSWER",
        ""
    ])
    for p in e["pdf_pages"]:
        cons_lines.append(f"![](pages/p{p:03d}.jpg)")
        cons_lines.append("")
    cons_lines.extend(["---", ""])

cons_text = "\n".join(cons_lines).rstrip() + "\n"
(ROOT / complete_md_name).write_text(cons_text, encoding="utf-8")
(ROOT / consolidated_md_name).write_text(cons_text, encoding="utf-8")

idx_lines = [
    f"# {paper_title} — Topper Answers Master Index",
    f"**Total Questions:** {len(entries)} | **Total Topics:** {len(syllabus)} | **Total PDF Pages:** {total_pages}",
    "",
    f"Consolidated Markdown: [{complete_md_name}]({complete_md_name}) | Clickable PDF: [{subject_name}_clickable-index.pdf]({subject_name}_clickable-index.pdf)",
    "",
    "## Syllabus Topics",
    ""
]
for t in syllabus:
    t_answers = [e for e in entries if e["topic_id"] == t["topic_id"]]
    if not t_answers:
        continue
    p_start = t_answers[0]["pdf_pages"][0]
    p_end = t_answers[-1]["pdf_pages"][-1]
    first_q_id = t_answers[0]["global_id"]
    idx_lines.append(f"- [**Topic {t['topic_id']}: {t['title']}**]({complete_md_name}#question-{first_q_id}) — {len(t_answers)} questions (pp. {p_start}–{p_end})")

idx_lines.extend(["", "---", "", "## Complete Questions Directory", "", "| # | Topic | Question | Topper | Year | Marks | PDF Pages |", "|---|---|---|---|---|---|---|"])
for e in entries:
    q_snippet = e["question"][:75] + "..." if len(e["question"]) > 75 else e["question"]
    q_snippet = q_snippet.replace("|", "/")
    topper_display = e["topper"] + (f" ({e['air']})" if e.get("air") else "")
    pages_display = f"{e['pdf_pages'][0]}–{e['pdf_pages'][-1]}" if len(e['pdf_pages']) > 1 else str(e['pdf_pages'][0])
    idx_lines.append(f"| [{e['global_id']}]({complete_md_name}#question-{e['global_id']}) | {e['topic_name']} | {q_snippet} | {topper_display} | {e['year']} | {e['marks']}m | pp. {pages_display} |")

(ROOT / "INDEX.md").write_text("\n".join(idx_lines).rstrip() + "\n", encoding="utf-8")
print("Regenerated consolidated markdowns and INDEX.md successfully.")
