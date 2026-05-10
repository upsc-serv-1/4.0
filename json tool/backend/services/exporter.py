"""Export job → final JSON in schema 2.0 (matches sample schema)."""
from __future__ import annotations
from typing import Dict, List, Any


def build_schema2_json(job: Dict, questions: List[Dict]) -> Dict[str, Any]:
    """Build the schema 2.0 JSON given a job document and its questions."""
    md = job.get("metadata") or {}
    test_id = md.get("id") or job.get("id") or "untitled"
    exam_frame = md.get("exam_frame") or {
        "exam_category": "cse",
        "specific_exam": None,
        "stage": "prelims",
        "paper": "pre_gs1",
    }

    out_questions = []
    for q in sorted(questions, key=lambda x: x.get("question_number", 0)):
        n = q.get("question_number")
        statement_lines = q.get("statement_lines") or []
        if not statement_lines and q.get("question_text"):
            statement_lines = [q["question_text"]]
        question_text = q.get("question_text") or " ".join(statement_lines)
        opts = q.get("options") or {}
        is_pyq = bool(q.get("pyq_source"))
        exam_info = {
            "isPyq": is_pyq,
            "is_ncert": False,
            "exam": q.get("pyq_source") or None,
            "group": None,
            "year": q.get("pyq_year") or None,
            "is_upsc_cse": (q.get("pyq_source") or "").upper() == "UPSC",
            "is_allied": False,
            "is_others": False,
            "exam_category": exam_frame.get("exam_category"),
            "specific_exam": exam_frame.get("specific_exam"),
            "stage": exam_frame.get("stage"),
            "paper": exam_frame.get("paper"),
        }
        out_questions.append({
            "id": f"{test_id}-q{n:02d}",
            "questionNumber": n,
            "subject": q.get("subject") or "",
            "sectionGroup": q.get("section_group") or "",
            "microTopic": q.get("microtopic") or "",
            "statementLines": statement_lines,
            "questionText": question_text,
            "options": {
                "a": opts.get("a", ""),
                "b": opts.get("b", ""),
                "c": opts.get("c", ""),
                "d": opts.get("d", ""),
            },
            "correctAnswer": q.get("correct_answer") or "",
            "explanationMarkdown": q.get("explanation_markdown") or "",
            "exam_info": exam_info,
        })

    final = {
        "id": test_id,
        "title": md.get("title", job.get("title", "")),
        "launch_year": md.get("launch_year"),
        "institute": md.get("institute", ""),
        "program_id": md.get("program_id", ""),
        "program_name": md.get("program_name", ""),
        "series": md.get("series", ""),
        "level": md.get("level", ""),
        "paperType": md.get("paperType", ""),
        "defaultMinutes": md.get("defaultMinutes"),
        "sourceMode": md.get("sourceMode", "docx-inline"),
        "schema_version": md.get("schema_version", "2.0"),
        "institute_id": md.get("institute_id"),
        "institute_name": md.get("institute_name"),
        "exam_frame": exam_frame,
        "questions": out_questions,
    }
    return final


def build_markdown(job: Dict, questions: List[Dict]) -> str:
    md = job.get("metadata") or {}
    out = [f"# {md.get('title') or job.get('title','')}", ""]
    out.append(f"- Institute: {md.get('institute','')}")
    out.append(f"- Program: {md.get('program_name','')}")
    out.append(f"- Total questions: {len(questions)}")
    out.append("")
    for q in sorted(questions, key=lambda x: x.get("question_number", 0)):
        n = q.get("question_number")
        out.append(f"## Q{n}. ({q.get('subject','?')} → {q.get('section_group','?')} → {q.get('microtopic','?')})")
        for line in q.get("statement_lines") or []:
            out.append(line)
        out.append("")
        opts = q.get("options") or {}
        for k in ("a", "b", "c", "d"):
            out.append(f"- {k}) {opts.get(k,'')}")
        out.append("")
        out.append(f"**Correct:** {q.get('correct_answer','')}    **Confidence:** {q.get('confidence',0)}")
        out.append("")
        out.append("**Explanation:**")
        out.append(q.get("explanation_markdown") or "")
        out.append("")
    return "\n".join(out)
