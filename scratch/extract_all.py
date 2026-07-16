import os
import re
import fitz

# Define directories
PDF_DIR = r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop"
OUT_DIR = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains tab md files\value additions"

# Create output subdirectories if they don't exist
os.makedirs(os.path.join(OUT_DIR, "keywords"), exist_ok=True)
os.makedirs(os.path.join(OUT_DIR, "case_studies"), exist_ok=True)
os.makedirs(os.path.join(OUT_DIR, "judgments"), exist_ok=True)
os.makedirs(os.path.join(OUT_DIR, "essay"), exist_ok=True)

# Helper to clean whitespace
def clean_str(s):
    if not s: return ""
    return re.sub(r'\s+', ' ', s).strip()

def clean_key(title):
    return clean_str(title).lower().replace("-", " ").replace("—", " ").replace("–", " ")

# Extract text from pdf
def get_pdf_text(filename):
    path = os.path.join(PDF_DIR, filename)
    if not os.path.exists(path):
        print(f"Error: {filename} not found in {PDF_DIR}")
        return ""
    doc = fitz.open(path)
    full_text = ""
    for page in doc:
        full_text += page.get_text() + "\n"
    doc.close()
    return full_text

# ==========================================
# 1. PARSE KEYWORDS PDFs
# ==========================================
def parse_keywords_pdf(text, subject_name):
    # Regex to find Topics
    # Usually "Topic: <Name>" or "TOPIC <Number>. <Name>"
    blocks = re.split(r'(?i)Topic\s*\d*\s*[\.\:]', text)
    keywords_by_topic = {}
    
    # First block is preamble/intro, skip it if it doesn't contain a number listing
    for block in blocks[1:]:
        lines = block.split('\n')
        topic_title = clean_str(lines[0])
        # Skip garbage headers
        if len(topic_title) < 3: continue
        
        block_text = "\n".join(lines[1:])
        # Regex to match numbered items
        # Format: 1. Name – Definition. Example: Text
        items = re.findall(r'(?m)^\s*(\d+)\.\s*(.+?)\s*[\–\-\—\:]\s*(.*?)(?=\n\s*\d+\.|\n\s*(?:Topic|TOPIC|Page|\Z))', block_text, re.DOTALL)
        
        if not items:
            # Fallback regex if newlines are different
            items = re.findall(r'(\d+)\.\s*([A-Za-z0-9\s\-\'\&]+?)\s*[\–\-\—\:]\s*(.*?)(?=\s*\d+\.|\s*(?:Topic|TOPIC|Page|\Z))', block_text, re.DOTALL)
            
        for num, raw_name, body in items:
            name = clean_str(raw_name)
            body_cleaned = clean_str(body)
            
            # Extract Example if present
            example_match = re.search(r'(?i)(?:Example\s*[\:\–\-]\s*|\s*Example\s+)(.*)$', body_cleaned)
            if example_match:
                definition = clean_str(body_cleaned[:example_match.start()])
                example = clean_str(example_match.group(1))
            else:
                definition = body_cleaned
                example = ""
                
            if topic_title not in keywords_by_topic:
                keywords_by_topic[topic_title] = []
            keywords_by_topic[topic_title].append({
                "name": name,
                "definition": definition,
                "example": example
            })
            
    return keywords_by_topic

def compile_subject_keywords(files_list, subject, paper, sec_group, microtopic_mapping, out_filename):
    aggregated = {}
    seen_keys = set()
    
    for f in files_list:
        text = get_pdf_text(f)
        if not text: continue
        topics = parse_keywords_pdf(text, subject)
        for t_title, cards in topics.items():
            # Match topic title to syllabus hierarchy section group & microtopic
            matched_sec_group = sec_group
            matched_microtopic = "General"
            
            # Try to match topic title to microtopic mapping keys
            for mapping_key, (sg, mt) in microtopic_mapping.items():
                if mapping_key.lower() in t_title.lower():
                    matched_sec_group = sg
                    matched_microtopic = mt
                    break
                    
            if matched_microtopic not in aggregated:
                aggregated[matched_microtopic] = (matched_sec_group, [])
                
            for card in cards:
                key = clean_key(card["name"])
                if key in seen_keys: continue
                seen_keys.add(key)
                aggregated[matched_microtopic][1].append(card)
                
    # Write to Markdown
    md_content = f"# Subject: {subject}\n\n"
    for microtopic, (sg, cards) in aggregated.items():
        if not cards: continue
        md_content += f"### Section Group: {sg}\n"
        md_content += f"#### Microtopic: {microtopic}\n"
        md_content += f"##### Subtopic: {microtopic} Keywords\n\n"
        
        for idx, card in enumerate(cards):
            md_content += f"**{card['name']}**\n"
            md_content += f"- **Definition**: {card['definition']}\n"
            if card['example']:
                md_content += f"- **Example**: {card['example']}\n"
            md_content += "\n---\n\n"
            
    out_path = os.path.join(OUT_DIR, "keywords", out_filename)
    with open(out_path, "w", encoding="utf-8") as out_f:
        out_f.write(md_content.strip() + "\n")
    print(f"Generated Keywords: {out_filename} ({len(seen_keys)} cards)")

# ==========================================
# 2. PARSE CASE STUDIES PDF
# ==========================================
def parse_case_studies():
    text = get_pdf_text("GS2 GS3 CASE STUDIES topic wise.pdf")
    if not text: return
    
    # Split by topic sections: e.g. "1. Agriculture", "2. Environment and Ecology"
    sections = re.split(r'(?m)^\s*(\d+)\.\s+([A-Za-z0-9\s\&]+)\s*$', text)
    cases = []
    
    # Iterate over split blocks
    # Index 0 is preamble, then we have triplets of (num, title, block_content)
    for i in range(1, len(sections), 3):
        sec_num = sections[i]
        sec_title = clean_str(sections[i+1])
        block_content = sections[i+2]
        
        # Split by Case Study:
        cases_blocks = re.split(r'(?i)Case Study\s*\:\s*', block_content)
        for cb in cases_blocks[1:]:
            lines = cb.split('\n')
            title = clean_str(lines[0])
            content_block = "\n".join(lines[1:])
            
            # Extract Details and Impact
            # Format:  Details: ...  Impact: ...
            details_match = re.search(r'(?i)Details\s*\:\s*(.*?)(?=Impact\s*\:|\Z)', content_block, re.DOTALL)
            impact_match = re.search(r'(?i)Impact\s*\:\s*(.*?)(?=\Z)', content_block, re.DOTALL)
            
            details = clean_str(details_match.group(1)) if details_match else ""
            impact = clean_str(impact_match.group(1)) if impact_match else ""
            
            # Map syllabus hierarchy
            paper = "GS-III"
            subject = "ECONOMY"
            sec_group = "Macroeconomics & Fiscal Policy"
            microtopic = "Economic Growth"
            
            title_lower = sec_title.lower()
            if "agriculture" in title_lower:
                paper = "GS-III"
                subject = "AGRICULTURE"
                sec_group = "Agriculture & Farm Dynamics"
                microtopic = "Agri-Marketing"
            elif "environment" in title_lower:
                paper = "GS-III"
                subject = "ENVIRONMENT"
                sec_group = "Conservation & Ecosystems"
                microtopic = "Sustainable Development"
            elif "disaster" in title_lower:
                paper = "GS-III"
                subject = "DISASTER MANAGEMENT"
                sec_group = "Specific Disasters & Hazards"
                microtopic = "Disaster Preparedness and Resilience"
            elif "infrastructure" in title_lower:
                paper = "GS-III"
                subject = "INDIAN ECONOMY"
                sec_group = "Physical Infrastructure & Capital"
                microtopic = "PPP X Infrastructure"
            elif "science" in title_lower or "technology" in title_lower:
                paper = "GS-III"
                subject = "SCIENCE & TECHNOLOGY"
                sec_group = "Everyday Science & Innovations"
                microtopic = "Innovative Technologies"
            elif "governance" in title_lower or "polity" in title_lower:
                paper = "GS-II"
                subject = "GOVERNANCE"
                sec_group = "Accountability & Civil Services"
                microtopic = "Transparency and Accountability"
            elif "health" in title_lower or "education" in title_lower:
                paper = "GS-II"
                subject = "SOCIAL JUSTICE"
                sec_group = "Social Sector & Human Development"
                microtopic = "Health"
            elif "security" in title_lower:
                paper = "GS-III"
                subject = "INTERNAL SECURITY"
                sec_group = "Cyber, Financial & Media Security"
                microtopic = "Cyber security"
                
            cases.append({
                "paper": paper,
                "subject": subject,
                "sec_group": sec_group,
                "microtopic": microtopic,
                "title": title,
                "details": details,
                "impact": impact
            })
            
    # Write to Markdown file
    md_content = "# Subject: CASE STUDIES\n\n"
    for c in cases:
        md_content += f"### Section Group: {c['sec_group']}\n"
        md_content += f"#### Microtopic: {c['microtopic']}\n"
        md_content += f"##### Subtopic: {c['title']} Case Study\n\n"
        md_content += f"**{c['title']}**\n"
        md_content += f"- **Details**: {c['details']}\n"
        md_content += f"- **Impact**: {c['impact']}\n"
        md_content += f"- **Paper**: {c['paper']}\n"
        md_content += f"- **Subject**: {c['subject']}\n"
        md_content += "\n---\n\n"
        
    out_path = os.path.join(OUT_DIR, "case_studies", "GS2_GS3_Case_Studies.md")
    with open(out_path, "w", encoding="utf-8") as out_f:
        out_f.write(md_content.strip() + "\n")
    print(f"Generated Case Studies: GS2_GS3_Case_Studies.md ({len(cases)} cases)")

# ==========================================
# 3. PARSE SUPREME COURT JUDGMENTS
# ==========================================
def parse_judgments():
    text = get_pdf_text("THEME WISE IMP SC JUDGEMENTS PDF BY X IAS.pdf")
    if not text: return
    
    # Split by Theme:
    themes = re.split(r'(?i)Theme\s+\d+\s*[\.\:]', text)
    judgments = []
    
    for theme_block in themes[1:]:
        lines = theme_block.split('\n')
        theme_title = clean_str(lines[0])
        block_text = "\n".join(lines[1:])
        
        # Parse table rows: Format is Case Name, Key Issue, Ruling, Related Articles
        # Let's extract rows based on the number matching
        rows = re.findall(r'(?m)^\s*(\d+)\s*\n\s*(.+?)\s*\n\s*(.+?)\s*\n\s*(.+?)\s*\n\s*(.+?)(?=\n\s*\d+\s*\n|\n\s*(?:Theme|THEME|Page|\Z))', block_text, re.DOTALL)
        if not rows:
            # Fallback if text format differs slightly
            rows = re.findall(r'(?m)^\s*(\d+)\s*\n\s*(.+?)\s*\n\s*(.+?)\s*\n\s*(.+?)(?=\n\s*\d+\s*\n|\n\s*(?:Theme|THEME|Page|\Z))', block_text, re.DOTALL)
            
        for r in rows:
            num = r[0]
            case_name = clean_str(r[1])
            issue = clean_str(r[2])
            ruling = clean_str(r[3])
            articles = clean_str(r[4]) if len(r) > 4 else "Polity & Constitution"
            
            # Map theme_title to syllabus hierarchy
            sec_group = "Constitutional Framework & Evolution"
            microtopic = "Features, amendments, significant provisions and basic structure"
            
            t_lower = theme_title.lower()
            if "governor" in t_lower or "federalism" in t_lower or "centre-state" in t_lower:
                sec_group = "Federal Structure & Local Governance"
                microtopic = "Issues and challenges pertaining to the federal structure"
            elif "election" in t_lower or "electoral" in t_lower:
                sec_group = "Elections & Political Dynamics"
                microtopic = "Salient features of the Representation of People's Act"
            elif "forest" in t_lower or "environment" in t_lower or "tribal" in t_lower:
                sec_group = "Constitutional Framework & Evolution"
                microtopic = "Features, amendments, significant provisions and basic structure"
            elif "gender" in t_lower or "lgbtq" in t_lower or "social justice" in t_lower or "reservation" in t_lower or "disability" in t_lower or "child" in t_lower:
                sec_group = "Constitutional Framework & Evolution"
                microtopic = "Fundamental Rights, Preamble, DPSP, Fundamental Duties, etc."
                
            judgments.append({
                "sec_group": sec_group,
                "microtopic": microtopic,
                "case_name": case_name,
                "issue": issue,
                "ruling": ruling,
                "articles": articles
            })
            
    md_content = "# Subject: SUPREME COURT JUDGMENTS\n\n"
    for j in judgments:
        md_content += f"### Section Group: {j['sec_group']}\n"
        md_content += f"#### Microtopic: {j['microtopic']}\n"
        md_content += f"##### Subtopic: {j['case_name']} Case Law\n\n"
        md_content += f"**{j['case_name']}**\n"
        md_content += f"- **Issue**: {j['issue']}\n"
        md_content += f"- **Ruling**: {j['ruling']}\n"
        md_content += f"- **Articles**: {j['articles']}\n"
        md_content += "\n---\n\n"
        
    out_path = os.path.join(OUT_DIR, "judgments", "SC_Judgments.md")
    with open(out_path, "w", encoding="utf-8") as out_f:
        out_f.write(md_content.strip() + "\n")
    print(f"Generated SC Judgments: SC_Judgments.md ({len(judgments)} cases)")

# ==========================================
# 4. PARSE ESSAY CONNECTING WORDS
# ==========================================
def parse_essay_connectors():
    text = get_pdf_text("ESSAY PARAGRAPH SENTENCE CONNECTING WORDS.pdf")
    if not text: return
    
    # Split by categories: e.g. "1.Example", "2. Addition", "3. Contrast"
    categories = re.split(r'(?m)^\s*(\d+)\.\s*([A-Za-z0-9\s\&]+)\s*$', text)
    connectors = []
    
    for i in range(1, len(categories), 3):
        cat_num = categories[i]
        cat_name = clean_str(categories[i+1])
        block_content = categories[i+2]
        
        # Match list items:  Word: Example sentence
        items = re.findall(r'(?m)^\s*[\u2022\u00b7\uf0b7]\s*(.+?)\s*\:\s*(.*?)(?=\n\s*[\u2022\u00b7\uf0b7]|\n\s*\d+\.|\Z)', block_content, re.DOTALL)
        for word, sentence in items:
            connectors.append({
                "category": cat_name,
                "word": clean_str(word),
                "sentence": clean_str(sentence)
            })
            
    # Write to Markdown file
    md_content = "# Subject: ESSAY CONNECTORS\n\n"
    md_content += "### Section Group: Essay Writing Toolkit\n"
    md_content += "#### Microtopic: Paragraph Transition & Connecting Words\n"
    md_content += "##### Subtopic: Essay Connectors\n\n"
    
    for c in connectors:
        md_content += f"**{c['word']}**\n"
        md_content += f"- **Category**: {c['category']}\n"
        md_content += f"- **Example Sentence**: {c['sentence']}\n"
        md_content += "\n---\n\n"
        
    out_path = os.path.join(OUT_DIR, "essay", "Connecting_Words.md")
    with open(out_path, "w", encoding="utf-8") as out_f:
        out_f.write(md_content.strip() + "\n")
    print(f"Generated Essay Connectors: Connecting_Words.md ({len(connectors)} words)")


# Run all
if __name__ == "__main__":
    # GS1 History mappings
    history_files = ["X IAS HISTORY KEYWORDS GS1.pdf", "HISTORY ART & CULTURE KEYWORDS BY X IAS.pdf"]
    history_mapping = {
        "art": ("Art and Culture", "Indian Culture-Salient aspects of Art Forms, Literature and Architecture from ancient to modern times."),
        "literature": ("Art and Culture", "Indian Culture-Salient aspects of Art Forms, Literature and Architecture from ancient to modern times."),
        "architecture": ("Art and Culture", "Indian Culture-Salient aspects of Art Forms, Literature and Architecture from ancient to modern times."),
        "modern": ("Modern History", "Modern Indian History-Mid-18th century - Present (significant events, personalities, issues);"),
        "freedom": ("Modern History", "Freedom Struggle-various stages, important contributors/contributions from different parts of the country"),
        "struggle": ("Modern History", "Freedom Struggle-various stages, important contributors/contributions from different parts of the country"),
        "post": ("Post Independence", "Post-Independence-consolidation and reorganisation within country")
    }
    compile_subject_keywords(history_files, "HISTORY", "GS-I", "Modern History", history_mapping, "GS1_History_Keywords.md")
    
    # GS1 Society mappings
    society_files = ["Keywords & phrases Society.pdf", "SOCIETY KEYWORDS BY X IASrsrs.pdf"]
    society_mapping = {
        "diversity": ("Foundations & Diversity", "Diversity of India"),
        "salient": ("Foundations & Diversity", "Salient features of Indian Society"),
        "women": ("Gender & Demographics", "Role of women and women's organization"),
        "population": ("Gender & Demographics", "Population and associated issues"),
        "poverty": ("Poverty, Empowerment & Development", "Social empowerment, poverty and developmental issues"),
        "globalization": ("Social Dynamics & Ideologies", "Effects of globalization on Indian society"),
        "empowerment": ("Poverty, Empowerment & Development", "Social empowerment, poverty and developmental issues"),
        "communalism": ("Social Dynamics & Ideologies", "National Integration, communalism, regionalism & secularism"),
        "regionalism": ("Social Dynamics & Ideologies", "National Integration, communalism, regionalism & secularism"),
        "secularism": ("Social Dynamics & Ideologies", "National Integration, communalism, regionalism & secularism"),
        "urbanization": ("Urbanisation", "Urbanisation: problems and remedies")
    }
    compile_subject_keywords(society_files, "SOCIETY", "GS-I", "Foundations & Diversity", society_mapping, "GS1_Society_Keywords.md")
    
    # GS2 Polity mappings
    polity_files = ["X IAS GS2 POLITY KEYWORDS.pdf", "POLITY KEYWORDS AND EXAMPLES FOR GS2 BY XIAS.pdf"]
    polity_mapping = {
        "constitutional": ("Constitutional Framework & Evolution", "Features, amendments, significant provisions and basic structure"),
        "evolution": ("Constitutional Framework & Evolution", "Indian Constitution- historical underpinnings and evolution"),
        "fundamental": ("Constitutional Framework & Evolution", "Fundamental Rights, Preamble, DPSP, Fundamental Duties, etc."),
        "federal": ("Federal Structure & Local Governance", "Issues and challenges pertaining to the federal structure"),
        "judiciary": ("Organs of Government & Dispute Redressal", "Structure, organization and functioning of the Judiciary (including Tribunals & ADR)"),
        "executive": ("Organs of Government & Dispute Redressal", "Structure, organization and functioning of the Executive"),
        "legislature": ("Organs of Government & Dispute Redressal", "Parliament and State Legislatures - structure, functioning, conduct of business, powers & privileges and issues arising out of these"),
        "elections": ("Elections & Political Dynamics", "Salient features of the Representation of People's Act"),
        "rpa": ("Elections & Political Dynamics", "Salient features of the Representation of People's Act"),
        "governance": ("DEVELOPMENT PROCESSES & POLICIES", "Government Policies & Interventions for development of various sectors (issues in their design, implementation)"),
        "statutory": ("CONSTITUTIONAL & REGULATORY BODIES", "Statutory, Regulatory and Quasi-judicial bodies"),
        "accountability": ("ACCOUNTABILITY & CIVIL SERVICES", "Transaparency and accountability (institutional and other measures); Citizens Charter"),
        "welfare": ("Vulnerable Sections & Welfare", "Welfare Schemes (Vulnerable Sections): Performance, Mechanisms, Laws, Institutions & Bodies"),
        "poverty": ("Poverty & Hunger", "Issues and Challenges relating to Poverty & Hunger"),
        "relations": ("NEIGHBORHOOD & BILATERAL ENGAGEMENTS", "Neighborhood Relations: India & its Neighborhood-Relations")
    }
    compile_subject_keywords(polity_files, "POLITY", "GS-II", "Constitutional Framework & Evolution", polity_mapping, "GS2_Polity_Keywords.md")
    
    # GS3 Economy mappings
    economy_files = ["X IAS GS3 KEYWORDS AND PHRASES.pdf", "Internal Security keywords  & Examples By  XIAS.pdf"]
    economy_mapping = {
        "macro": ("Macroeconomics & Fiscal Policy", "Inclusive growth and issues arising from it"),
        "growth": ("Macroeconomics & Fiscal Policy", "Issues relating to overall economic growth, sector manufacturing, and employment generation"),
        "inclusive": ("Macroeconomics & Fiscal Policy", "Inclusive growth and issues arising from it"),
        "budget": ("Macroeconomics & Fiscal Policy", "Government Budgeting and fiscal management policies"),
        "industry": ("Industrial Dynamics & Reforms", "Effects of Liberalisation on the economy; Changes in Industrial policy & their effects on industrial growth"),
        "reform": ("Industrial Dynamics & Reforms", "Effects of Liberalisation on the economy; Changes in Industrial policy & their effects on industrial growth"),
        "infrastructure": ("Physical Infrastructure & Capital", "Infrastructure systems connectivity: energy, ports, roads, airports, and railways"),
        "agriculture": ("Agriculture & Farm Dynamics", "Major Crops, cropping patterns, and regional agriculture production styles"),
        "crop": ("Agriculture & Farm Dynamics", "Major Crops, cropping patterns, and regional agriculture production styles"),
        "irrigation": ("Agriculture & Farm Dynamics", "Irrigation design, management, water efficiency, and conservation infrastructure"),
        "subsidy": ("Agriculture & Farm Dynamics", "Issues related to direct and indirect farm subsidies and minimum support prices (MSP)"),
        "food": ("Food Processing Industry", "Food processing and related industries (scope, significance, structural locations, and supply chain management)"),
        "science": ("Everyday Science & Innovations", "Science and Technology- developments and their effects in everyday life"),
        "indigenous": ("Indigenous Tech & Achievements", "Achievements of Indians in S&T; Indigenisation of technology & developing new technology"),
        "frontier": ("Frontier Technologies & IPR", "Awareness in the fields of IT, Computers, and robotics"),
        "environment": ("Conservation & Ecosystems", "Conservation and environmental impact assessment"),
        "pollution": ("Pollution & Degradation", "Environmental pollution and degradation"),
        "climate": ("Climate Change", "Global warming, climate change, and international frameworks"),
        "disaster": ("Frameworks & Preparedness", "Disaster Management: Preparedness, resilience, and vulnerability frameworks"),
        "extremism": ("Extremism & External Threats", "Linkages between Development & spread of Extremism"),
        "cyber": ("Cyber, Financial & Media Security", "Challenges to internal security through communication networks, role of media and social networking sites, and basics of cyber security"),
        "border": ("Border Management & Organized Crime", "Security challenges and their management in border areas"),
        "organized": ("Border Management & Organized Crime", "Linkages of organized crime with terrorism"),
        "forces": ("Security Forces & Mandates", "Various Security forces and agencies and their mandate")
    }
    compile_subject_keywords(economy_files, "ECONOMY", "GS-III", "Macroeconomics & Fiscal Policy", economy_mapping, "GS3_Keywords.md")
    
    # Parse Case Studies
    parse_case_studies()
    
    # Parse SC Judgments
    parse_judgments()
    
    # Parse Essay Connectors
    parse_essay_connectors()
