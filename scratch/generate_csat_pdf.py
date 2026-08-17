import json
import os
import re
import markdown
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

sys.stdout.reconfigure(encoding='utf-8')

json_output = r'C:\Users\Dr. Yogesh\Downloads\Qwen_json_20260725_4bvuoipmw.json'
pdf_output = r'C:\Users\Dr. Yogesh\Downloads\Qwen_json_20260725_4bvuoipmw.pdf'

with open(json_output, 'r', encoding='utf-8') as f:
    paper_json = json.load(f)

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
            self.drawString(36, 810, 'UPSC CSE 2026 - CSAT Paper 2 (Official PYQ & Solutions)')
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
q_sub_tag_style = ParagraphStyle('QSubTag', parent=styles['Normal'], fontName='Helvetica-Oblique', fontSize=8.5, leading=11, textColor=colors.HexColor('#2B6CB0'))
opt_style = ParagraphStyle('OptBody', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=12.5, textColor=colors.HexColor('#1A202C'))
ans_style = ParagraphStyle('AnsBadge', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=colors.HexColor('#22543D'))
exp_head_style = ParagraphStyle('ExpHead', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=colors.HexColor('#2C5282'))
exp_body_style = ParagraphStyle('ExpBody', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=13, textColor=colors.HexColor('#2D3748'))

def clean_md(text):
    if not text:
        return ''
    # Protect numbered/lettered lists from markdown swallowing
    text_protected = re.sub(r'^(\s*)(\d+|[A-Z]|I{1,3}|IV|VI{0,3}|IX|X)\.\s+', r'\1<b>\2.</b> ', text)
    h = markdown.markdown(text_protected.strip())
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
elements.append(Paragraph('PRELIMS CSAT - PAPER 2', subtitle_style))
elements.append(Spacer(1, 4))
elements.append(Paragraph('Official Question Paper with Detailed Explanations & Model Solutions', meta_style))
elements.append(Spacer(1, 6))
elements.append(Paragraph('<b>Total Questions:</b> 80 &nbsp;&nbsp;|&nbsp;&nbsp; <b>Max Marks:</b> 200 &nbsp;&nbsp;|&nbsp;&nbsp; <b>Time Allowed:</b> 2 Hours', meta_style))
elements.append(Spacer(1, 10))
elements.append(HRFlowable(width='100%', thickness=1.5, color=colors.HexColor('#1A365D'), spaceAfter=12))

for q in paper_json['questions']:
    q_num = q['questionNumber']
    subject = q.get('subject', 'CSAT')
    sec_group = q.get('sectionGroup', '')
    micro = q.get('microTopic', '')
    
    tag_str = f'Subject: <b>{subject}</b>'
    if sec_group:
        tag_str += f' &nbsp;|&nbsp; Section: <b>{sec_group}</b>'
    if micro:
        tag_str += f' &nbsp;|&nbsp; Topic: <b>{micro}</b>'
        
    q_banner_text = Paragraph(f'<b>QUESTION {q_num}</b>', q_header_style)
    q_banner_table = Table([[q_banner_text]], colWidths=[510])
    q_banner_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#EBF8FF')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#BEE3F8')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8)
    ]))
    
    elements.append(q_banner_table)
    elements.append(Spacer(1, 3))
    elements.append(Paragraph(tag_str, q_sub_tag_style))
    elements.append(Spacer(1, 6))
    
    stmt_lines = q['statementLines']
    i = 0
    while i < len(stmt_lines):
        line = stmt_lines[i]
        if line.startswith('|'):
            t_lines = []
            while i < len(stmt_lines) and stmt_lines[i].startswith('|'):
                t_lines.append(stmt_lines[i])
                i += 1
            t_elem = parse_and_render_md_table(t_lines)
            if t_elem:
                elements.append(t_elem)
                elements.append(Spacer(1, 4))
        else:
            cleaned = clean_md(line)
            if cleaned:
                elements.append(Paragraph(cleaned, body_style))
                elements.append(Spacer(1, 3))
            i += 1
            
    elements.append(Spacer(1, 4))
    
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
print(f'PDF successfully generated at: {pdf_output}')
