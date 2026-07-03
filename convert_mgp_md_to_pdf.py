"""
Markdown to PDF Converter for Forum MGP Model Answers
Uses ReportLab to generate a highly professional, beautifully formatted PDF layout.

Usage: python convert_mgp_md_to_pdf.py <md_path> [pdf_path]
"""

import os
import re
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
import markdown

class NumberedCanvas(canvas.Canvas):
    """Canvas that performs a two-pass render to print total page numbers in footer."""
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
            self.draw_footer(page_count)
            super().showPage()
        super().save()

    def draw_footer(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#718096"))
        
        # Draw header on all pages except the first
        if self._pageNumber > 1:
            self.drawString(54, 800, "Forum MGP Test Series - Model Answers")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(54, 792, 541, 792)
            
        # Draw footer on all pages
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(541, 40, page_str)
        self.restoreState()


def convert_md_to_pdf(md_path, pdf_path=None):
    if pdf_path is None:
        base = os.path.splitext(md_path)[0]
        pdf_path = base + ".pdf"
        
    with open(md_path, 'r', encoding='utf-8') as f:
        md_text = f.read()

    # Setup document
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        leftMargin=54,
        rightMargin=54,
        topMargin=72,
        bottomMargin=72
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    h1_style = ParagraphStyle(
        'CustomH1',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#1A365D"),
        spaceAfter=12
    )
    
    h2_style = ParagraphStyle(
        'CustomH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#2B6CB0"),
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#2D3748"),
        spaceAfter=8
    )
    
    list_body_style = ParagraphStyle(
        'ListBody',
        parent=body_style,
        spaceAfter=3.5
    )
    
    question_style = ParagraphStyle(
        'QuestionStyle',
        parent=body_style,
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#1A202C"),
        spaceAfter=8
    )

    metadata_style = ParagraphStyle(
        'MetadataStyle',
        parent=body_style,
        fontName='Helvetica-Oblique',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#718096"),
        spaceAfter=8
    )
    
    approach_style = ParagraphStyle(
        'ApproachStyle',
        parent=body_style,
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#2D3748")
    )
    
    story = []
    
    # Parse markdown line by line
    lines = md_text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        if not stripped:
            i += 1
            continue
            
        # H1 title
        if line.startswith('# '):
            text = line[2:].strip()
            text = parse_inline_markdown(text)
            story.append(Paragraph(text, h1_style))
            story.append(Spacer(1, 10))
            
        # H2 title (Q1, etc.)
        elif line.startswith('## '):
            text = line[3:].strip()
            text = parse_inline_markdown(text)
            story.append(Paragraph(text, h2_style))
            
        # Question block
        elif line.startswith('**Question:**'):
            text = line.replace('**Question:**', '<b>Question:</b>').strip()
            text = parse_inline_markdown(text)
            story.append(Paragraph(text, question_style))
            
        # Metadata
        elif line.startswith('*Metadata:'):
            text = line.replace('*', '').strip()
            story.append(Paragraph(text, metadata_style))
            
        # Subtitle / italic header
        elif line.startswith('*') and line.endswith('*') and len(line) > 2 and 'Metadata' not in line:
            text = line[1:-1].strip()
            text = parse_inline_markdown(text)
            sub_style = ParagraphStyle('Sub', parent=body_style, fontName='Helvetica-Oblique', textColor=colors.HexColor("#4A5568"))
            story.append(Paragraph(text, sub_style))
            
        # Approach block table
        elif line.startswith('| **Approach:**'):
            match = re.search(r'\|\s*\*\*Approach:\*\*(.*?)\|', line)
            if match:
                approach_text = match.group(1).strip()
                approach_text = re.sub(r'<br\s*/?>', '<br/>', approach_text)
                approach_text = parse_inline_markdown(approach_text)
                
                # Wrap inside a nice single-cell table (callout box)
                cell_p = Paragraph(f"<b>Approach:</b><br/>{approach_text}", approach_style)
                t = Table([[cell_p]], colWidths=[487])
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F7FAFC")),
                    ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#E2E8F0")),
                    ('PADDING', (0,0), (-1,-1), 8),
                    ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ]))
                story.append(t)
                story.append(Spacer(1, 10))
            if i + 1 < len(lines) and lines[i+1].strip().startswith('| ---'):
                i += 1
                
        # Dividers
        elif line.startswith('---'):
            story.append(Spacer(1, 8))
            story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E2E8F0"), spaceAfter=12))
            
        # Normal text and lists
        else:
            leading_spaces = len(line) - len(line.lstrip())
            indent = leading_spaces * 5  # 3 spaces -> 15pt, 6 spaces -> 30pt
            
            # Extract list marker if present at start of stripped line
            marker_match = re.match(
                r'^((?:(?:\*\*|\*)?\d+\.(?:\*\*|\*)?\s*)?(?:(?:\*\*|\*)?[a-z][).](?:\*\*|\*)?|\((?:\*\*|\*)?[a-z](?:\*\*|\*)?\))|(?:\*\*|\*)?\d+\.(?:\*\*|\*)?|(?:\*\*|\*)?[a-z][).](?:\*\*|\*)?|\((?:\*\*|\*)?[a-z](?:\*\*|\*)?\)|\b[ivx]+[).])(?:\s+(.*)|$)',
                stripped,
                re.IGNORECASE
            )
            
            if marker_match or indent > 0:
                if marker_match:
                    marker_part = marker_match.group(1)
                    rest_part = marker_match.group(2) or ""
                    parsed_rest = parse_inline_markdown(rest_part.strip())
                    text = f"{marker_part} {parsed_rest}"
                else:
                    text = parse_inline_markdown(stripped)
                base_style = list_body_style
            else:
                text = parse_inline_markdown(stripped)
                base_style = body_style
                
            style_name = f'Indent_{indent}_{base_style.name}'
            if style_name not in styles:
                p_style = ParagraphStyle(
                    style_name,
                    parent=base_style,
                    leftIndent=indent
                )
            else:
                p_style = styles[style_name]
                
            story.append(Paragraph(text, p_style))
            
        i += 1

    # Build PDF
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Compiled {pdf_path}")
    return pdf_path


def parse_inline_markdown(text):
    """Convert markdown formatting to ReportLab-compatible HTML using python-markdown library."""
    # Convert markdown to HTML
    html = markdown.markdown(text)
    # Remove outer <p>...</p> tags
    if html.startswith('<p>') and html.endswith('</p>'):
        html = html[3:-4]
    return html


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python convert_mgp_md_to_pdf.py <md_path> [pdf_path]")
        sys.exit(1)
        
    md_path = sys.argv[1]
    pdf_path = sys.argv[2] if len(sys.argv) > 2 else None
    convert_md_to_pdf(md_path, pdf_path)
