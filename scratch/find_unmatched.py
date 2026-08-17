import json, re
from difflib import SequenceMatcher

files = {
    'Paper1': r'C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro1_new_consolidated.json',
    'Paper2': r'C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro2_new_consolidated.json',
}

mds = {
    'Paper1': r'C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_1_PYQs_20_25_Extracted.md',
    'Paper2': r'C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_2_PYQs_20_25_Extracted.md',
}

SHORT_NOTE_PREFIXES = [
    r'write short notes? on the following in about \d+ words? each\s*[:\.\s]*',
    r'write short notes? on the following\s*[:\.\s]*',
    r'write short notes? on\s*[:\.\s]*',
    r'write a short note on\s*[:\.\s]*',
    r'write notes? on\s*[:\.\s]*',
    r'comment briefly on\s*[:\.\s]*',
    r'comment on\s*[:\.\s]*',
    r'write a note on\s*[:\.\s]*',
    r'briefly explain\s*[:\.\s]*',
]

def strip_p(t):
    for pat in SHORT_NOTE_PREFIXES:
        t = re.sub(pat, '', t, flags=re.IGNORECASE).strip()
    return t

def sim(a, b):
    a = re.sub(r'\s+', ' ', a.lower().strip())
    b = re.sub(r'\s+', ' ', b.lower().strip())
    return SequenceMatcher(None, a, b).ratio()

for label, md_path in mds.items():
    with open(md_path, encoding='utf-8') as f:
        raw = f.read()
    sections = re.split(r'\n(?=## )', raw)
    with open(files[label], encoding='utf-8') as f:
        data = json.load(f)
    qs = data['questions']

    for sec in sections:
        if not sec.strip() or sec.startswith('# '):
            continue
        q_match = re.search(r'\*\*Question:\*\*\s*(.*?)\*\*Year:\*\*', sec, re.DOTALL)
        if q_match:
            qt = q_match.group(1).strip()
        else:
            h = re.match(r'## \d+\.\s*(.+)', sec.split('\n')[0])
            qt = h.group(1).strip() if h else ''
        if not qt:
            continue

        best_r = 0
        best_q = None
        for q in qs:
            r1 = sim(qt, q['questionText'])
            r2 = sim(strip_p(qt), strip_p(q['questionText']))
            r3 = 0.92 if len(strip_p(qt)) >= 8 and strip_p(qt).lower() in q['questionText'].lower() else 0
            r = max(r1, r2, r3)
            if r > best_r:
                best_r = r
                best_q = q

        if best_r < 0.85:
            print(f"[{label}] UNMATCHED [{best_r:.2f}]: {qt}")
            if best_q:
                best_text = best_q['questionText']
                print(f"         Best DB match: {best_text[:100]}")
            print()
