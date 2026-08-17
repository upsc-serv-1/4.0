import re
import json
import os
import markdown
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

input_file = r'C:\Users\Dr. Yogesh\Downloads\Qwen__20260725_n71jucb07.txt'
json_output = r'c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\UPSC_2026 CSE GS PAPER 1 FORMATTED.json'
pdf_output = r'c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\UPSC_2026 CSE GS PAPER 1 FORMATTED.pdf'

with open(input_file, 'r', encoding='utf-8') as f:
    text = f.read()

blocks = re.split(r'\n(?=^\s*---|\n(?=\*\*Q\.\d+\)\*\*))', text, flags=re.MULTILINE)
blocks = [b.strip() for b in blocks if b.strip() and not b.strip() == '---']

def infer_subject(q_text, exp_text):
    combined = (q_text + ' ' + exp_text).lower()
    
    if any(k in combined for k in ['constitution', 'article', 'parliament', 'court', 'governor', 'judiciary', 'legislative', 'amendment', 'rights', 'writ', 'panchayat']):
        return 'Polity', 'Constitutional Framework', 'Indian Constitution'
    elif any(k in combined for k in ['rigveda', 'stupa', 'dynasty', 'king', 'ancient', 'chola', 'chera', 'pandya', 'sangam', 'buddha', 'maurya', 'gupta', 'vedic', 'inscription', 'temple', 'british', 'bose', 'congress', 'taluqdar', 'mughal', 'sultanate']):
        return 'History', 'Indian History & Culture', 'Ancient & Modern History'
    elif any(k in combined for k in ['river', 'monsoon', 'pleistocene', 'mountain', 'soil', 'tectonic', 'glacier', 'strait', 'sea', 'ocean', 'basin', 'plateau', 'drainage']):
        return 'Geography', 'Physical & Human Geography', 'Indian & World Geography'
    elif any(k in combined for k in ['rbi', 'bank', 'gdp', 'inflation', 'fiscal', 'tax', 'debt', 'export', 'import', 'money', 'revenue', 'capital', 'bond', 'currency', 'market']):
        return 'Economy', 'Indian Economy', 'Economic Development & Finance'
    elif any(k in combined for k in ['species', 'dolphin', 'forest', 'wildlife', 'conservation', 'iucn', 'park', 'wetland', 'biodiversity', 'ecosystem', 'pollution', 'carbon', 'sanctuary']):
        return 'Environment', 'Ecology & Environment', 'Biodiversity & Conservation'
    elif any(k in combined for k in ['satellite', 'missile', 'quantum', 'dna', 'gene', 'vaccine', 'space', 'telescope', 'semiconductor', 'nuclear', 'virus', 'ai', 'computing']):
        return 'Science & Tech', 'Science and Technology', 'General Science & Applied Tech'
    elif any(k in combined for k in ['un', 'asean', 'brics', 'wto', 'treaty', 'quad', 'nato', 'agreement']):
        return 'International Relations', 'International Affairs', 'Global Organizations & Treaties'
    else:
        return 'General Studies', 'General', 'Miscellaneous Topics'

questions = []

for idx, b in enumerate(blocks, 1):
    q_match = re.search(r'\*\*Q\.(\d+)\)\*\*\s*(.*?)(?=\n\s*[a-d]\)|\n\s*\|\s*a\)\s*|\n\s*\|\s*a\)\s*|\n\s*\*\*Ans\))', b, re.DOTALL)
    ans_match = re.search(r'\*\*Ans\)\s*([a-d])\*\*', b, re.IGNORECASE)
    exp_match = re.search(r'(\*\*Exp\).*)$', b, re.DOTALL)
    
    q_num = int(q_match.group(1)) if q_match else idx
    q_raw = q_match.group(2).strip() if q_match else ''
    
    # Options extraction (Standard vs Table)
    opt_a = re.search(r'^\s*a\)\s*(.*?)(?=\n\s*b\)|\n\s*\*\*Ans)', b, re.DOTALL | re.MULTILINE)
    opt_b = re.search(r'^\s*b\)\s*(.*?)(?=\n\s*c\)|\n\s*\*\*Ans)', b, re.DOTALL | re.MULTILINE)
    opt_c = re.search(r'^\s*c\)\s*(.*?)(?=\n\s*d\)|\n\s*\*\*Ans)', b, re.DOTALL | re.MULTILINE)
    opt_d = re.search(r'^\s*d\)\s*(.*?)(?=\n\s*\*\*Ans)', b, re.DOTALL | re.MULTILINE)
    
    a_str, b_str, c_str, d_str = '', '', '', ''
    
    if opt_a and opt_b and opt_c and opt_d:
        a_str = opt_a.group(1).strip().replace('\n', ' ')
        b_str = opt_b.group(1).strip().replace('\n', ' ')
        c_str = opt_c.group(1).strip().replace('\n', ' ')
        d_str = opt_d.group(1).strip().replace('\n', ' ')
    else:
        table_a = re.search(r'\|\s*a\)\s*\|?\s*(.*?)(?=\n|\Z)', b)
        table_b = re.search(r'\|\s*b\)\s*\|?\s*(.*?)(?=\n|\Z)', b)
        table_c = re.search(r'\|\s*c\)\s*\|?\s*(.*?)(?=\n|\Z)', b)
        table_d = re.search(r'\|\s*d\)\s*\|?\s*(.*?)(?=\n|\Z)', b)
        if table_a and table_b and table_c and table_d:
            a_str = ' | '.join([x.strip() for x in table_a.group(1).split('|') if x.strip()])
            b_str = ' | '.join([x.strip() for x in table_b.group(1).split('|') if x.strip()])
            c_str = ' | '.join([x.strip() for x in table_c.group(1).split('|') if x.strip()])
            d_str = ' | '.join([x.strip() for x in table_d.group(1).split('|') if x.strip()])
            
    ans_letter = ans_match.group(1).lower() if ans_match else 'a'
    exp_text = exp_match.group(1).strip() if exp_match else ''
    
    lines = [line.strip() for line in q_raw.split('\n') if line.strip()]
    q_text = ' '.join(lines)
    
    subject, sec_group, micro_topic = infer_subject(q_text, exp_text)
    
    q_obj = {
        'id': f'upsc-cse-pyq-2026-gs1-q{q_num:03d}',
        'questionNumber': q_num,
        'subject': subject,
        'sectionGroup': sec_group,
        'microTopic': micro_topic,
        'statementLines': lines,
        'questionText': q_text,
        'options': {
            'a': a_str,
            'b': b_str,
            'c': c_str,
            'd': d_str
        },
        'correctAnswer': ans_letter,
        'explanationMarkdown': exp_text,
        'exam_info': {
            'isPyq': True,
            'is_ncert': False,
            'exam': 'Prelims',
            'group': 'UPSC CSE',
            'year': 2026,
            'is_upsc_cse': True,
            'is_allied': False,
            'is_others': False,
            'exam_category': 'cse',
            'specific_exam': None,
            'stage': 'prelims',
            'paper': 'pre_gs1'
        },
        'source_attribution_label': 'CSE 2026'
    }
    questions.append(q_obj)

paper_json = {
    'id': 'upsc-cse-pyq-2026-gs1',
    'title': '2026- Prelims - GS Paper 1 - UPSC',
    'launch_year': 2026,
    'institute': 'UPSC',
    'program_id': 'cse',
    'program_name': 'CSE',
    'series': 'Prelims (Official)',
    'level': 'GS Paper 1',
    'paperType': 'test-paper',
    'defaultMinutes': 120,
    'sourceMode': 'docx-sol',
    'questions': questions
}

with open(json_output, 'w', encoding='utf-8') as f:
    json.dump(paper_json, f, indent=2, ensure_ascii=False)

print(f'Successfully updated JSON with all 100 questions & options at {json_output}')

# ==================== BUILD PDF WITH FULL TABLE SUPPORT ====================

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.pages = []

    def showPage(self):
        self.pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        page_count = len(self.pages)
        for page in self.pages:
            self.__dict__.update(page)
            self.draw_header_footer(page_count)
            super().showPage()
        super().save()

    def draw_header_footer(self, page_count):
        self.saveState()
        self.setFont('Helvetica-Bold', 8)
        self.setFillColor(colors.HexColor('#4A5568'))
        
        if self._pageNumber > 1:
            self.drawString(36, 810, 'UPSC CSE 2026 - GS Paper 1 (Official PYQ & Solutions)')
            self.drawRightString(559, 810, 'Dr. UPSC / Antigravity')
            self.setStrokeColor(colors.HexColor('#CBD5E0'))
            self.setLineWidth(0.5)
            self.line(36, 802, 559, 802)
            
        self.setFont('Helvetica', 8)
        self.drawString(36, 25, 'Confidential - For Personal / Academic Preparation')
        page_str = f'Page {self._pageNumber} of {page_count}'
        self.drawRightString(559, 25, page_str)
        self.setStrokeColor(colors.HexColor('#E2E8F0'))
        self.setLineWidth(0.5)
        self.line(36, 35, 559, 35)
        self.restoreState()

styles = getSampleStyleSheet()

body_style = ParagraphStyle('QBody', parent=styles['Normal'], fontName='Helvetica', fontSize=9.5, leading=13.5, textColor=colors.HexColor('#2D3748'))
title_style = ParagraphStyle('DocTitle', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=colors.HexColor('#1A365D'), alignment=1)
subtitle_style = ParagraphStyle('DocSubTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=11, leading=15, textColor=colors.HexColor('#2B6CB0'), alignment=1)
meta_style = ParagraphStyle('DocMeta', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=12, textColor=colors.HexColor('#4A5568'), alignment=1)
q_header_style = ParagraphStyle('QHeader', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=colors.HexColor('#1A365D'))
q_sub_tag_style = ParagraphStyle('QSubTag', parent=styles['Normal'], fontName='Helvetica-Oblique', fontSize=8.5, leading=11, textColor=colors.HexColor('#4A5568'))
opt_style = ParagraphStyle('OptBody', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=12.5, textColor=colors.HexColor('#1A202C'))
ans_style = ParagraphStyle('AnsBadge', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=colors.HexColor('#22543D'))
exp_head_style = ParagraphStyle('ExpHead', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=colors.HexColor('#2C5282'))
exp_body_style = ParagraphStyle('ExpBody', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=13, textColor=colors.HexColor('#2D3748'))

def clean_md(text):
    if not text:
        return ''
    h = markdown.markdown(text.strip())
    h = h.replace('<strong>', '<b>').replace('</strong>', '</b>')
    h = h.replace('<em>', '<i>').replace('</em>', '</i>')
    if h.startswith('<p>') and h.endswith('</p>'):
        h = h[3:-4]
    h = h.replace('<p>', '').replace('</p>', '<br/><br/>')
    return h

def parse_and_render_md_table(table_lines):
    rows = []
    for line in table_lines:
        line_s = line.strip()
        if not line_s.startswith('|'):
            continue
        if re.match(r'^\|[\s:\-|\-]+\|$', line_s):
            continue
        cells = [c.strip() for c in line_s.split('|')[1:-1]]
        row_p = [Paragraph(clean_md(cell), body_style) for cell in cells]
        rows.append(row_p)
    if not rows:
        return None
    num_cols = max(len(r) for r in rows)
    for r in rows:
        while len(r) < num_cols:
            r.append(Paragraph('', body_style))
            
    col_w = 510 / num_cols
    t = Table(rows, colWidths=[col_w]*num_cols)
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#EDF2F7')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E0')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0'))
    ]))
    return t

doc = SimpleDocTemplate(pdf_output, pagesize=A4, leftMargin=36, rightMargin=36, topMargin=45, bottomMargin=45)
elements = []

elements.append(Paragraph('UPSC CIVIL SERVICES EXAMINATION 2026', title_style))
elements.append(Spacer(1, 4))
elements.append(Paragraph('PRELIMS GENERAL STUDIES - PAPER 1', subtitle_style))
elements.append(Spacer(1, 4))
elements.append(Paragraph('Official Question Paper with Detailed Explanations & Model Solutions', meta_style))
elements.append(Spacer(1, 6))
elements.append(Paragraph('<b>Total Questions:</b> 100 &nbsp;&nbsp;|&nbsp;&nbsp; <b>Max Marks:</b> 200 &nbsp;&nbsp;|&nbsp;&nbsp; <b>Time Allowed:</b> 2 Hours', meta_style))
elements.append(Spacer(1, 10))
elements.append(HRFlowable(width='100%', thickness=1.5, color=colors.HexColor('#1A365D'), spaceAfter=12))

for q in paper_json['questions']:
    q_num = q['questionNumber']
    subject = q.get('subject', 'General Studies')
    sec_group = q.get('sectionGroup', '')
    micro = q.get('microTopic', '')
    
    tag_str = f'Subject: <b>{subject}</b>'
    if sec_group:
        tag_str += f' &nbsp;|&nbsp; Section: {sec_group}'
    if micro:
        tag_str += f' &nbsp;|&nbsp; Topic: {micro}'
        
    elements.append(Paragraph(f'Question {q_num}', q_header_style))
    elements.append(Paragraph(tag_str, q_sub_tag_style))
    elements.append(Spacer(1, 4))
    
    # Process statement lines & tables
    stmt_lines = q['statementLines']
    i = 0
    while i < len(stmt_lines):
        line = stmt_lines[i]
        if line.startswith('|'):
            # Gather consecutive table lines
            t_lines = []
            while i < len(stmt_lines) and stmt_lines[i].startswith('|'):
                t_lines.append(stmt_lines[i])
                i += 1
            t_elem = parse_and_render_md_table(t_lines)
            if t_elem:
                elements.append(t_elem)
                elements.append(Spacer(1, 4))
        else:
            elements.append(Paragraph(clean_md(line), body_style))
            elements.append(Spacer(1, 2))
            i += 1
            
    elements.append(Spacer(1, 4))
    
    # Options Table
    opts = q['options']
    opt_a = clean_md(opts.get('a', ''))
    opt_b = clean_md(opts.get('b', ''))
    opt_c = clean_md(opts.get('c', ''))
    opt_d = clean_md(opts.get('d', ''))
    
    opt_rows = [
        [Paragraph(f'<b>(a)</b> {opt_a}', opt_style), Paragraph(f'<b>(b)</b> {opt_b}', opt_style)],
        [Paragraph(f'<b>(c)</b> {opt_c}', opt_style), Paragraph(f'<b>(d)</b> {opt_d}', opt_style)]
    ]
    opt_table = Table(opt_rows, colWidths=[255, 255])
    opt_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F7FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#EDF2F7'))
    ]))
    elements.append(opt_table)
    elements.append(Spacer(1, 6))
    
    # Answer Badge
    ans_letter = q['correctAnswer'].upper()
    ans_p = Paragraph(f'<b>Correct Answer:</b> Option ({ans_letter})', ans_style)
    ans_box = Table([[ans_p]], colWidths=[510])
    ans_box.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#C6F6D5')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#9AE6B4')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8)
    ]))
    elements.append(ans_box)
    elements.append(Spacer(1, 6))
    
    # Explanation
    exp_md = q.get('explanationMarkdown', '')
    if exp_md:
        elements.append(Paragraph('<b>Detailed Explanation:</b>', exp_head_style))
        elements.append(Spacer(1, 2))
        
        paragraphs = exp_md.split('\n\n')
        for p in paragraphs:
            p_str = p.strip()
            if not p_str:
                continue
            if p_str.startswith('|'):
                t_elem = parse_and_render_md_table(p_str.split('\n'))
                if t_elem:
                    elements.append(t_elem)
                    elements.append(Spacer(1, 4))
                else:
                    elements.append(Paragraph(clean_md(p_str).replace('\n', '<br/>'), exp_body_style))
                    elements.append(Spacer(1, 4))
            else:
                elements.append(Paragraph(clean_md(p_str).replace('\n', '<br/>'), exp_body_style))
                elements.append(Spacer(1, 4))
                
    elements.append(Spacer(1, 6))
    elements.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#CBD5E0'), spaceAfter=10))

doc.build(elements, canvasmaker=NumberedCanvas)
print(f'PDF successfully generated with full table & numbering support at: {pdf_output}')
