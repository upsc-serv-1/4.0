import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TOPICS_DIR = ROOT / "topics"
TOPICS_DIR.mkdir(exist_ok=True)

catalog = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))
entries = catalog.get("entries", [])
syllabus = catalog.get("syllabus_index", [])

for t in syllabus:
    tid = t["topic_id"]
    slug = t["slug"]
    t_answers = [e for e in entries if e.get("topic_id") == tid]
    if not t_answers:
        continue
    lines = [
        f"# Topic {tid}: {t['title']}",
        f"*General Studies 1 — Indian Society* | **Total Questions:** {len(t_answers)}",
        "",
        "---",
        ""
    ]
    for qnum, e in enumerate(t_answers, 1):
        topper_str = e["topper"] + (f" (AIR {e['air']})" if e.get("air") else "")
        lines.extend([
            f"## Question {qnum}",
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
            lines.append(f"![](../pages/p{p:03d}.jpg)")
            lines.append("")
        lines.extend(["---", ""])
    (TOPICS_DIR / f"{slug}.md").write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")

print("Regenerated all topic markdown files successfully.")
