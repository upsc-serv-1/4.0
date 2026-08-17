import json
import os
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

json_file = r'c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\UPSC_2026 CSE GS PAPER 1 FORMATTED.json'
pdf_file = r'c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\UPSC_2026 CSE GS PAPER 1 FORMATTED.pdf'

with open(json_file, 'r', encoding='utf-8') as f:
    paper_data = json.load(f)

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
        
        # Header (Pages 2+)
        if self._pageNumber > 1:
            self.drawString(36, 810, 'UPSC CSE 2026 - GS Paper 1 (Official PYQ & Solutions)')
            self.drawRightString(559, 810, 'Dr. UPSC / Antigravity')
            self.setStrokeColor(colors.HexColor('#CBD5E0'))
            self.setLineWidth(0.5)
            self.line(36, 802, 559, 802)
            
        # Footer
        self.setFont('Helvetica', 8)
        self.drawString(36, 25, 'Confidential - For Personal / Academic Preparation')
        page_str = f'Page {self._pageNumber} of {page_count}'
        self.drawRightString(559, 25, page_str)
        self.setStrokeColor(colors.HexColor('#E2E8F0'))
        self.setLineWidth(0.5)
        self.line(36, 35, 559, 35)
        self.restoreState()

import markdown

def clean_md(text):
    if not text:
        return ''
    # Convert markdown to html cleanly
    h = markdown.markdown(text.strip())
    # Standardize tags for ReportLab
    h = h.replace('<strong>', '<b>').replace('</strong>', '</b>')
    h = h.replace('<em>', '<i>').replace('</em>', '</i>')
    
    # Strip wrapping <p> if present
    if h.startswith('<p>') and h.endswith('</p>'):
        h = h[3:-4]
    
    h = h.replace('<p>', '').replace('</p>', '<br/><br/>')
    return h

doc = SimpleDocTemplate(
    pdf_file,
    pagesize=A4,
    leftMargin=36,
    rightMargin=36,
    topMargin=45,
    bottomMargin=45
)

styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'DocTitle',
    parent=styles['Heading1'],
    fontName='Helvetica-Bold',
    fontSize=18,
    leading=22,
    textColor=colors.HexColor('#1A365D'),
    alignment=1
)

subtitle_style = ParagraphStyle(
    'DocSubTitle',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=11,
    leading=15,
    textColor=colors.HexColor('#2B6CB0'),
    alignment=1
)

meta_style = ParagraphStyle(
    'DocMeta',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=9,
    leading=12,
    textColor=colors.HexColor('#4A5568'),
    alignment=1
)

q_header_style = ParagraphStyle(
    'QHeader',
    parent=styles['Heading2'],
    fontName='Helvetica-Bold',
    fontSize=11,
    leading=14,
    textColor=colors.HexColor('#1A365D')
)

q_sub_tag_style = ParagraphStyle(
    'QSubTag',
    parent=styles['Normal'],
    fontName='Helvetica-Oblique',
    fontSize=8.5,
    leading=11,
    textColor=colors.HexColor('#4A5568')
)

body_style = ParagraphStyle(
    'QBody',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=9.5,
    leading=13.5,
    textColor=colors.HexColor('#2D3748')
)

opt_style = ParagraphStyle(
    'OptBody',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=9,
    leading=12.5,
    textColor=colors.HexColor('#1A202C')
)

ans_style = ParagraphStyle(
    'AnsBadge',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=9.5,
    leading=13,
    textColor=colors.HexColor('#22543D')
)

exp_head_style = ParagraphStyle(
    'ExpHead',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=9.5,
    leading=13,
    textColor=colors.HexColor('#2C5282')
)

exp_body_style = ParagraphStyle(
    'ExpBody',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=9,
    leading=13,
    textColor=colors.HexColor('#2D3748')
)

elements = []

# Title Banner
elements.append(Paragraph('UPSC CIVIL SERVICES EXAMINATION 2026', title_style))
elements.append(Spacer(1, 4))
elements.append(Paragraph('PRELIMS GENERAL STUDIES - PAPER 1', subtitle_style))
elements.append(Spacer(1, 4))
elements.append(Paragraph('Official Question Paper with Detailed Explanations & Model Solutions', meta_style))
elements.append(Spacer(1, 6))
elements.append(Paragraph('<b>Total Questions:</b> 100 &nbsp;&nbsp;|&nbsp;&nbsp; <b>Max Marks:</b> 200 &nbsp;&nbsp;|&nbsp;&nbsp; <b>Time Allowed:</b> 2 Hours', meta_style))
elements.append(Spacer(1, 10))
elements.append(HRFlowable(width='100%', thickness=1.5, color=colors.HexColor('#1A365D'), spaceAfter=12))

for q in paper_data['questions']:
    q_num = q['questionNumber']
    subject = q.get('subject', 'General Studies')
    sec_group = q.get('sectionGroup', '')
    micro = q.get('microTopic', '')
    
    # Question Tagline
    tag_str = f'Subject: <b>{subject}</b>'
    if sec_group:
        tag_str += f' &nbsp;|&nbsp; Section: {sec_group}'
    if micro:
        tag_str += f' &nbsp;|&nbsp; Topic: {micro}'
        
    q_title_p = Paragraph(f'Question {q_num}', q_header_style)
    q_tag_p = Paragraph(tag_str, q_sub_tag_style)
    
    # Statement Lines / Text
    q_flowables = [q_title_p, q_tag_p, Spacer(1, 4)]
    
    # Add statement lines
    for stmt in q['statementLines']:
        stmt_clean = clean_md(stmt)
        q_flowables.append(Paragraph(stmt_clean, body_style))
        q_flowables.append(Spacer(1, 2))
        
    q_flowables.append(Spacer(1, 4))
    
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
    q_flowables.append(opt_table)
    q_flowables.append(Spacer(1, 6))
    
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
    q_flowables.append(ans_box)
    q_flowables.append(Spacer(1, 6))
    
    # Explanation
    exp_md = q.get('explanationMarkdown', '')
    if exp_md:
        q_flowables.append(Paragraph('<b>Detailed Explanation:</b>', exp_head_style))
        q_flowables.append(Spacer(1, 2))
        
        # Split explanation by paragraphs (\n\n)
        paragraphs = exp_md.split('\n\n')
        for p in paragraphs:
            p_str = p.strip()
            if not p_str:
                continue
            # Replace single \n inside paragraph with space or br
            p_clean = clean_md(p_str).replace('\n', '<br/>')
            q_flowables.append(Paragraph(p_clean, exp_body_style))
            q_flowables.append(Spacer(1, 4))
            
    q_flowables.append(Spacer(1, 6))
    q_flowables.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#CBD5E0'), spaceAfter=10))
    
    elements.extend(q_flowables)

doc.build(elements, canvasmaker=NumberedCanvas)
print(f'PDF successfully generated at: {pdf_file}')
