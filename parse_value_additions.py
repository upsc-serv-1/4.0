import os
import json
import re

VA_DIR = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains tab md files\value additions"
OUT_DIR = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files"

os.makedirs(OUT_DIR, exist_ok=True)

def strip_clean(text):
    return text.strip() if text else ""

def extract_bracket_tags(content):
    tags = {}
    pattern = re.compile(r'\[(Paper|Subject|Section Group|Microtopic|Subtopic|Category):\s*([^\]]+)\]', re.IGNORECASE)
    for key, val in pattern.findall(content):
        tags[key.lower().replace(' ', '_')] = strip_clean(val)
    return tags

def build_hierarchy_path(paper, subject, section_group, microtopic=None, subtopic=None):
    path = []
    if paper: path.append(paper)
    if subject: path.append(subject)
    if section_group: path.append(section_group)
    if microtopic: path.append(microtopic)
    if subtopic: path.append(subtopic)
    return path

# ==============================================================================
# 1. PARSE DATA & FACTS
# ==============================================================================
def parse_data_facts():
    folder = os.path.join(VA_DIR, "data and facts")
    results = []
    
    if not os.path.exists(folder):
        print("Data and facts folder not found!")
        return
        
    for file in os.listdir(folder):
        if not file.endswith(".md"):
            continue
        filepath = os.path.join(folder, file)
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # We split by '#### Parameter:'
        params = re.split(r'\n#### Parameter:\s*', content)
        
        # The first part contains H1 / H2 / H3 context
        header_context = params[0]
        h1_match = re.search(r'^#\s+(.+)$', header_context, re.MULTILINE)
        h2_match = re.search(r'^##\s+SUBJECT:\s*(.+)$', header_context, re.MULTILINE)
        h3_match = re.search(r'^###\s+Section Group:\s*(.+)$', header_context, re.MULTILINE)
        
        default_paper = strip_clean(h1_match.group(1)) if h1_match else ""
        default_subject = strip_clean(h2_match.group(1)) if h2_match else ""
        default_section_group = strip_clean(h3_match.group(1)) if h3_match else ""
        
        for param_block in params[1:]:
            lines = param_block.split('\n')
            parameter_name = strip_clean(lines[0])
            
            # Find bracket tags
            block_content = "\n".join(lines[1:])
            tags = extract_bracket_tags(block_content)
            
            paper = tags.get('paper', default_paper)
            subject = tags.get('subject', default_subject)
            section_group = tags.get('section_group', default_section_group)
            
            # Extract cards
            # We look for **Card X: Card Title**
            cards = re.split(r'\n\*\*Card\s+\d+:\s*(.+?)\*\*\n*', block_content)
            
            # The first part of cards split is metadata or empty lines before Card 1
            for i in range(1, len(cards), 2):
                card_title = strip_clean(cards[i])
                card_body = cards[i+1] if i+1 < len(cards) else ""
                
                # Split card body if there is a '---' separating parameter blocks
                card_body = card_body.split('\n---')[0]
                
                # Determine source if any, e.g. [World Bank]
                source_match = re.search(r'\[([^\]]+)\]\s*$', card_body)
                source = strip_clean(source_match.group(1)) if source_match else None
                
                hierarchy_path = build_hierarchy_path(paper, subject, section_group, parameter_name)
                
                results.append({
                    "paper": paper,
                    "subject": subject,
                    "section_group": section_group,
                    "parameter": parameter_name,
                    "card_title": card_title,
                    "content_markdown": strip_clean(card_body),
                    "source": source,
                    "hierarchy_path": hierarchy_path
                })
                
    out_path = os.path.join(OUT_DIR, "mains_data_facts.json")
    with open(out_path, 'w', encoding='utf-8') as out_f:
        json.dump(results, out_f, indent=2, ensure_ascii=False)
    print(f"Parsed {len(results)} Data & Facts cards to {out_path}")

# ==============================================================================
# 2. PARSE INTRODUCTIONS & CONCLUSIONS
# ==============================================================================
def parse_intro_conclusions():
    folder = os.path.join(VA_DIR, "Introductions and conclusions")
    results = []
    
    if not os.path.exists(folder):
        print("Introductions and conclusions folder not found!")
        return
        
    for file in os.listdir(folder):
        if not file.endswith(".md"):
            continue
        filepath = os.path.join(folder, file)
        
        # Derive paper from file name (e.g. readymade-intro and conclusion - GS-1.md -> GS-1)
        paper_match = re.search(r'GS-\d', file)
        default_paper = paper_match.group(0) if paper_match else ""
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Split by H5 subtopics
        subtopics = re.split(r'\n#####\s+Subtopic:\s*', content)
        
        for subtopic_block in subtopics[1:]:
            lines = subtopic_block.split('\n')
            subtopic_name = strip_clean(lines[0])
            
            block_content = "\n".join(lines[1:])
            tags = extract_bracket_tags(block_content)
            
            subject = tags.get('subject', "")
            section_group = tags.get('section_group', "")
            microtopic = tags.get('microtopic', "")
            subtopic = tags.get('subtopic', subtopic_name)
            
            # Split cards by ###### Card X:
            cards = re.split(r'\n######\s+Card\s+\d+:\s*(.+?)\n', block_content)
            
            for i in range(1, len(cards), 2):
                card_title = strip_clean(cards[i])
                card_body = cards[i+1] if i+1 < len(cards) else ""
                
                # Split card body if there is a '---' separating subtopics
                card_body = card_body.split('\n---')[0]
                
                # Parse fields inside card body: Quote, Introduction, Examples, Conclusion, Data
                quote_match = re.search(r'\*\s+\*\*Quote:\*\*\s*\n\s*>\s*(.+?)(?=\n\*|\n---|\n######|$)', card_body, re.DOTALL)
                intro_match = re.search(r'\*\s+\*\*Introduction:\*\*\s*\n(.+?)(?=\n\*|\n---|\n######|$)', card_body, re.DOTALL)
                examples_match = re.search(r'\*\s+\*\*Examples:\*\*\s*\n(.+?)(?=\n\*|\n---|\n######|$)', card_body, re.DOTALL)
                conclusion_match = re.search(r'\*\s+\*\*Conclusion:\*\*\s*\n(.+?)(?=\n\*|\n---|\n######|$)', card_body, re.DOTALL)
                data_match = re.search(r'\*\s+\*\*Data:\*\*\s*\n(.+?)(?=\n\*|\n---|\n######|$)', card_body, re.DOTALL)
                
                quote_raw = strip_clean(quote_match.group(1)) if quote_match else None
                quote_text, quote_author = None, None
                if quote_raw:
                    quote_raw = re.sub(r'^\*\*|\*\*$|^"|"$', '', quote_raw)
                    if " – " in quote_raw:
                        parts = quote_raw.split(" – ")
                        quote_text = parts[0].strip(' "')
                        quote_author = parts[1].strip(' *')
                    elif " — " in quote_raw:
                        parts = quote_raw.split(" — ")
                        quote_text = parts[0].strip(' "')
                        quote_author = parts[1].strip(' *')
                    else:
                        quote_text = quote_raw
                
                hierarchy_path = build_hierarchy_path(default_paper, subject, section_group, microtopic, subtopic)
                
                results.append({
                    "paper": default_paper,
                    "subject": subject,
                    "section_group": section_group,
                    "microtopic": microtopic,
                    "subtopic": subtopic,
                    "card_title": card_title,
                    "quote_text": quote_text,
                    "quote_author": quote_author,
                    "introduction": strip_clean(intro_match.group(1)) if intro_match else None,
                    "examples": strip_clean(examples_match.group(1)) if examples_match else None,
                    "conclusion": strip_clean(conclusion_match.group(1)) if conclusion_match else None,
                    "data_points": strip_clean(data_match.group(1)) if data_match else None,
                    "hierarchy_path": hierarchy_path
                })
                
    out_path = os.path.join(OUT_DIR, "mains_intro_conclusions.json")
    with open(out_path, 'w', encoding='utf-8') as out_f:
        json.dump(results, out_f, indent=2, ensure_ascii=False)
    print(f"Parsed {len(results)} Intro/Conclusion cards to {out_path}")

# ==============================================================================
# 3. PARSE ESSAY ANECDOTES & QUOTES
# ==============================================================================
def parse_essay_value_add():
    filepath = os.path.join(VA_DIR, "essay", "ESSAY ANECDOTES AND QUOTES.md")
    results = []
    
    if not os.path.exists(filepath):
        print("Essay anecdotes file not found!")
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Split by H4 microtopics
    microtopics = re.split(r'\n####\s+Microtopic:\s*', content)
    
    for mt_block in microtopics[1:]:
        lines = mt_block.split('\n')
        microtopic_name = strip_clean(lines[0])
        
        block_content = "\n".join(lines[1:])
        
        # Split cards by ###### Anecdote X: or ###### Quote X:
        # We capture both the type (Anecdote or Quote) and the title
        cards = re.split(r'\n######\s+(Anecdote|Quote)\s+\d+:\s*(.+?)\n', block_content)
        
        for i in range(1, len(cards), 3):
            entry_type = strip_clean(cards[i]).lower() # 'anecdote' or 'quote'
            title = strip_clean(cards[i+1])
            card_body = cards[i+2] if i+2 < len(cards) else ""
            
            card_body = card_body.split('\n---')[0]
            
            # Extract category & content
            cat_match = re.search(r'-\s*\*\*Category:\*\*\s*(.+?)(?=\n-|\n\*|\n---|\n######|$)', card_body, re.DOTALL)
            content_match = re.search(r'-\s*\*\*Content:\*\*\s*(.+?)(?=\n-|\n\*|\n---|\n######|$)', card_body, re.DOTALL)
            
            category = strip_clean(cat_match.group(1)).replace("`", "") if cat_match else microtopic_name
            anecdote_text = strip_clean(content_match.group(1)) if content_match else strip_clean(card_body)
            
            anecdote_text = re.sub(r'^\s*-\s*', '', anecdote_text)
            
            hierarchy_path = build_hierarchy_path("Essay", "Essay", "ANECDOTES", microtopic_name)
            
            results.append({
                "paper": "Essay",
                "subject": "Essay",
                "section_group": "ANECDOTES",
                "microtopic": microtopic_name,
                "subtopic": None,
                "title": title,
                "category": category,
                "entry_type": entry_type,
                "content": anecdote_text,
                "author": None,
                "usage_guide": None,
                "hierarchy_path": hierarchy_path
            })
            
    out_path = os.path.join(OUT_DIR, "mains_essay_value_add.json")
    with open(out_path, 'w', encoding='utf-8') as out_f:
        json.dump(results, out_f, indent=2, ensure_ascii=False)
    print(f"Parsed {len(results)} Essay Anecdotes to {out_path}")

# ==============================================================================
# 4. PARSE MNEMONICS
# ==============================================================================
def parse_mnemonics():
    folder = os.path.join(VA_DIR, "neelesh sir mnemonics")
    results = []
    
    if not os.path.exists(folder):
        print("Mnemonics folder not found!")
        return
        
    for file in os.listdir(folder):
        if not file.endswith(".md"):
            continue
        filepath = os.path.join(folder, file)
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        h1_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        h2_match = re.search(r'^##\s+SUBJECT:\s*(.+)$', content, re.MULTILINE)
        
        paper_text = "GS1"
        if h1_match and "GS" in h1_match.group(1):
            pm = re.search(r'GS\d', h1_match.group(1))
            if pm: paper_text = pm.group(0)
            
        default_subject = strip_clean(h2_match.group(1)) if h2_match else "GEOGRAPHY"
        
        # Split by Subtopic H5
        subtopics = re.split(r'\n#####\s+Subtopic:\s*', content)
        
        for subtopic_block in subtopics[1:]:
            lines = subtopic_block.split('\n')
            subtopic_name = strip_clean(lines[0])
            
            block_content = "\n".join(lines[1:])
            
            mnemonics = re.split(r'\n######\s+Mnemonic\s+\d+:\s*(.+?)\n', block_content)
            
            for i in range(1, len(mnemonics), 2):
                mnemonic_title = strip_clean(mnemonics[i])
                mnemonic_body = mnemonics[i+1] if i+1 < len(mnemonics) else ""
                
                mnemonic_body = mnemonic_body.split('\n---')[0]
                
                keyword_match = re.search(r'-\s*\*\*Mnemonic Keyword:\*\*\s*(.+?)(?=\n-|\n\*|\n---|\n######|$)', mnemonic_body, re.DOTALL)
                formula_match = re.search(r'-\s*\*\*Formula\s*/\s*Expansion:\*\*\s*\n(.+?)(?=\n-\s*\*\*Explanation|$)', mnemonic_body, re.DOTALL)
                explanation_match = re.search(r'-\s*\*\*Explanation\s*&\s*Examples:\*\*\s*\n(.+?)(?=\n-|\n\*|\n---|\n######|$)', mnemonic_body, re.DOTALL)
                
                keyword = strip_clean(keyword_match.group(1)).replace("`", "") if keyword_match else ""
                
                formula_expansion = []
                if formula_match:
                    for line in formula_match.group(1).split('\n'):
                        line = strip_clean(line)
                        if not line: continue
                        m = re.match(r'^[-\*]\s*\*\*([A-Za-z0-9\s]+):\*\*\s*(.+)$', line)
                        if m:
                            formula_expansion.append({
                                "letter": m.group(1),
                                "meaning": m.group(2).strip(),
                                "detail": ""
                            })
                        else:
                            m2 = re.match(r'^[-\*]\s*\*\*([A-Za-z0-9\s]+)\*\*:\s*(.+)$', line)
                            if m2:
                                formula_expansion.append({
                                    "letter": m2.group(1),
                                    "meaning": m2.group(2).strip(),
                                    "detail": ""
                                })
                                
                explanation = strip_clean(explanation_match.group(1)) if explanation_match else strip_clean(mnemonic_body)
                
                section_group = "Geography" if "GEOGRAPHY" in default_subject else "History"
                if "SOCIETY" in default_subject: section_group = "Society"
                microtopic = "General"
                
                prev_text = content.split(subtopic_block)[0]
                sec_matches = re.findall(r'^###\s+Section Group:\s*(.+)$', prev_text, re.MULTILINE)
                if sec_matches: section_group = strip_clean(sec_matches[-1])
                
                mic_matches = re.findall(r'^####\s+Microtopic:\s*(.+)$', prev_text, re.MULTILINE)
                if mic_matches: microtopic = strip_clean(mic_matches[-1])
                
                hierarchy_path = build_hierarchy_path(paper_text, default_subject, section_group, microtopic, subtopic_name)
                
                results.append({
                    "paper": paper_text,
                    "subject": default_subject,
                    "section_group": section_group,
                    "microtopic": microtopic,
                    "subtopic": subtopic_name,
                    "mnemonic_number_title": mnemonic_title,
                    "mnemonic_keyword": keyword,
                    "formula_expansion": formula_expansion,
                    "explanation_examples": explanation,
                    "hierarchy_path": hierarchy_path
                })
                
    out_path = os.path.join(OUT_DIR, "mains_mnemonics.json")
    with open(out_path, 'w', encoding='utf-8') as out_f:
        json.dump(results, out_f, indent=2, ensure_ascii=False)
    print(f"Parsed {len(results)} Mnemonics cards to {out_path}")

# ==============================================================================
# 5. PARSE FRAMEWORKS
# ==============================================================================
def parse_frameworks():
    filepath = os.path.join(VA_DIR, "general  for all subjects", "frameworks", "answer writing_framework.md")
    results = []
    
    if not os.path.exists(filepath):
        print("Frameworks file not found!")
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    frameworks = re.split(r'\n#\s+Framework\s+\d+:\s*', content)
    
    for fw_block in frameworks[1:]:
        lines = fw_block.split('\n')
        framework_title = strip_clean(lines[0])
        
        block_content = "\n".join(lines[1:])
        
        img_match = re.search(r'!\[.*?\]\((images/.+?)\)', block_content)
        diagram_image_path = img_match.group(1) if img_match else None
        
        hierarchies = []
        hierarchy_lines = re.findall(r'\[Hierarchy\s+\d+\]\s*(.+?)(?=\n|$)', fw_block)
        for h_line in hierarchy_lines:
            tags = extract_bracket_tags(h_line)
            paper = tags.get('paper', 'GS-I/II/III')
            subject = tags.get('subject', '')
            section_group = tags.get('section_group', '')
            microtopic = tags.get('microtopic', '')
            subtopic = tags.get('subtopic', '')
            
            hierarchies.append({
                "paper": paper,
                "subject": subject,
                "section_group": section_group,
                "microtopic": microtopic,
                "subtopic": subtopic,
                "path": build_hierarchy_path(paper, subject, section_group, microtopic, subtopic)
            })
            
        cleaned_body = re.sub(r'###\s+Hierarchy\n(?:\[Hierarchy \d+\].*?\n)+', '', block_content)
        cleaned_body = re.sub(r'###\s+Diagram:.*?\n!\[.*?\]\(images/.+?\)\n', '', cleaned_body)
        
        results.append({
            "framework_name": framework_title,
            "diagram_image_path": diagram_image_path,
            "breakdown_markdown": strip_clean(cleaned_body),
            "hierarchies": hierarchies
        })
        
    out_path = os.path.join(OUT_DIR, "mains_frameworks.json")
    with open(out_path, 'w', encoding='utf-8') as out_f:
        json.dump(results, out_f, indent=2, ensure_ascii=False)
    print(f"Parsed {len(results)} Frameworks cards to {out_path}")

# ==============================================================================
# 6. PARSE ETHICS VALUE ADDITIONS
# ==============================================================================
def parse_ethics_value_add():
    folder = os.path.join(VA_DIR, "ethics")
    results = []
    
    if not os.path.exists(folder):
        print("Ethics folder not found!")
        return
        
    # File 1: CD_X-Factor_Innovations by Civil Servants.md
    innovations_file = os.path.join(folder, "CD_X-Factor_Innovations by Civil Servants.md")
    if os.path.exists(innovations_file):
        with open(innovations_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        subtopics = re.split(r'\n#####\s+Subtopic:\s*', content)
        for st_block in subtopics[1:]:
            lines = st_block.split('\n')
            subtopic_name = strip_clean(lines[0])
            
            prev_text = content.split(st_block)[0]
            sec_group = "Applied Ethics"
            sec_matches = re.findall(r'^###\s+Section Group:\s*(.+)$', prev_text, re.MULTILINE)
            if sec_matches: sec_group = strip_clean(sec_matches[-1])
            
            microtopic = "Aptitude and Foundational Values"
            mic_matches = re.findall(r'^####\s+Microtopic:\s*(.+)$', prev_text, re.MULTILINE)
            if mic_matches: microtopic = strip_clean(mic_matches[-1])
            
            block_content = "\n".join(lines[1:])
            rows = re.findall(r'^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$', block_content, re.MULTILINE)
            
            for row in rows:
                if row[0].startswith("---") or row[0].startswith("Name of the Officer") or row[0].startswith(":---"):
                    continue
                    
                officer = strip_clean(row[0]).replace("**", "")
                initiative = strip_clean(row[1])
                impact = strip_clean(row[2])
                values = strip_clean(row[3])
                pyqs_raw = strip_clean(row[4])
                
                pyqs_list = re.findall(r'\[(?:GS\d\s+)?(\d{4})\]', pyqs_raw)
                
                title = f"{officer} - {initiative}"
                formatted_markdown = f"**Officer**: {officer}\n**Initiative**: {initiative}\n**Impact**: {impact}\n**Values**: {values}\n**Indicative PYQs**: {pyqs_raw}"
                
                hierarchy_path = build_hierarchy_path("GS-IV", "ETHICS, INTEGRITY & APTITUDE", sec_group, microtopic, subtopic_name)
                
                results.append({
                    "ethics_type": "innovation",
                    "paper": "GS-IV",
                    "subject": "ETHICS, INTEGRITY & APTITUDE",
                    "section_group": sec_group,
                    "microtopic": microtopic,
                    "subtopic": subtopic_name,
                    "title": title,
                    "content_markdown": formatted_markdown,
                    "diagram_image_path": None,
                    "officer_name": officer,
                    "initiative": initiative,
                    "impact": impact,
                    "core_values": values,
                    "pyqs": pyqs_list,
                    "hierarchy_path": hierarchy_path
                })

    # File 2: ETHICS 2025 KEYWORDS.md
    keywords_file = os.path.join(folder, "ETHICS 2025 KEYWORDS.md")
    if os.path.exists(keywords_file):
        with open(keywords_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        keywords = re.split(r'\n##\s+\d+\.\s*', content)
        for kw_block in keywords[1:]:
            lines = kw_block.split('\n')
            kw_name = strip_clean(lines[0])
            
            block_content = "\n".join(lines[1:])
            tags = extract_bracket_tags(block_content)
            
            subject = tags.get('subject', 'ETHICS, INTEGRITY & APTITUDE')
            section_group = tags.get('section_group', 'Ethics & Human Values')
            microtopic = tags.get('microtopic', 'Ethics and Human Interface')
            subtopic = tags.get('subtopic', None)
            
            hierarchy_path = build_hierarchy_path("GS-IV", subject, section_group, microtopic, subtopic)
            
            cleaned_text = re.sub(r'\[(Subject|Section Group|Microtopic|Subtopic|Category):\s*[^\]]+\]\n*', '', block_content)
            
            results.append({
                "ethics_type": "keyword",
                "paper": "GS-IV",
                "subject": subject,
                "section_group": section_group,
                "microtopic": microtopic,
                "subtopic": subtopic,
                "title": kw_name,
                "content_markdown": strip_clean(cleaned_text),
                "diagram_image_path": None,
                "officer_name": None,
                "initiative": None,
                "impact": None,
                "core_values": None,
                "pyqs": [],
                "hierarchy_path": hierarchy_path
            })

    # File 3: X-Factor 2026 Ethical Terms Compared.md
    compared_file = os.path.join(folder, "X-Factor 2026 Ethical Terms Compared.md")
    if os.path.exists(compared_file):
        with open(compared_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        terms = re.split(r'\n##\s+\d+\.\s*', content)
        for term_block in terms[1:]:
            lines = term_block.split('\n')
            term_name = strip_clean(lines[0])
            
            block_content = "\n".join(lines[1:])
            tags = extract_bracket_tags(block_content)
            
            subject = tags.get('subject', 'ETHICS, INTEGRITY & APTITUDE')
            section_group = tags.get('section_group', 'Ethics & Human Values')
            microtopic = tags.get('microtopic', 'Ethics and Human Interface')
            subtopic = tags.get('subtopic', None)
            
            pyqs_list = re.findall(r'\[(\d{4})\]', block_content)
            
            img_match = re.search(r'!\[.*?\]\((x_factor_terms_images/.+?)\)', block_content)
            diagram_image_path = img_match.group(1) if img_match else None
            
            cleaned_text = re.sub(r'\[(Subject|Section Group|Microtopic|Subtopic|Category):\s*[^\]]+\]\n*', '', block_content)
            cleaned_text = re.sub(r'!\[.*?\]\(x_factor_terms_images/.+?\)\n*', '', cleaned_text)
            
            hierarchy_path = build_hierarchy_path("GS-IV", subject, section_group, microtopic, subtopic)
            
            results.append({
                "ethics_type": "comparison",
                "paper": "GS-IV",
                "subject": subject,
                "section_group": section_group,
                "microtopic": microtopic,
                "subtopic": subtopic,
                "title": term_name,
                "content_markdown": strip_clean(cleaned_text),
                "diagram_image_path": diagram_image_path,
                "officer_name": None,
                "initiative": None,
                "impact": None,
                "core_values": None,
                "pyqs": pyqs_list,
                "hierarchy_path": hierarchy_path
            })

    # File 4: X-Factor 2026 Ethics Diagrams.md
    diagrams_file = os.path.join(folder, "X-Factor 2026 Ethics Diagrams.md")
    if os.path.exists(diagrams_file):
        with open(diagrams_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        diag_sections = re.split(r'\n##\s+\d+\.\s*', content)
        for section in diag_sections[1:]:
            lines = section.split('\n')
            category_title = strip_clean(lines[0])
            
            block_content = "\n".join(lines[1:])
            
            subsections = re.split(r'\n###\s+Diagram:\s*', block_content)
            
            meta_block = subsections[0]
            tags = extract_bracket_tags(meta_block)
            
            subject = tags.get('subject', 'ETHICS, INTEGRITY & APTITUDE')
            section_group = tags.get('section_group', 'Applied Ethics')
            microtopic = tags.get('microtopic', 'Ethics and Human Interface')
            subtopic = tags.get('subtopic', None)
            
            pyqs_list = re.findall(r'\[(\d{4})\]', meta_block)
            
            hierarchy_path = build_hierarchy_path("GS-IV", subject, section_group, microtopic, subtopic)
            
            for sub in subsections[1:]:
                sub_lines = sub.split('\n')
                diag_title = strip_clean(sub_lines[0])
                sub_body = "\n".join(sub_lines[1:])
                
                img_match = re.search(r'!\[.*?\]\((x_factor_diagram_images/.+?)\)', sub_body)
                diagram_image_path = img_match.group(1) if img_match else None
                
                cleaned_sub_body = re.sub(r'!\[.*?\]\(x_factor_diagram_images/.+?\)\n*', '', sub_body)
                
                results.append({
                    "ethics_type": "diagram",
                    "paper": "GS-IV",
                    "subject": subject,
                    "section_group": section_group,
                    "microtopic": microtopic,
                    "subtopic": subtopic,
                    "title": f"{category_title} - {diag_title}",
                    "content_markdown": strip_clean(cleaned_sub_body),
                    "diagram_image_path": diagram_image_path,
                    "officer_name": None,
                    "initiative": None,
                    "impact": None,
                    "core_values": None,
                    "pyqs": pyqs_list,
                    "hierarchy_path": hierarchy_path
                })

    # File 5: Quotes from UPSC PYQ.md
    quotes_file = os.path.join(folder, "Quotes from UPSC PYQ.md")
    if os.path.exists(quotes_file):
        with open(quotes_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        topics = re.split(r'\n###\s*', content)
        for topic_block in topics[1:]:
            lines = topic_block.split('\n')
            topic_name = strip_clean(lines[0])
            
            quote_blocks = re.split(r'\n---\n*', "\n".join(lines[1:]))
            
            for quote_block in quote_blocks:
                quote_block = strip_clean(quote_block)
                if not quote_block or quote_block.startswith("##") or quote_block.startswith("Total"):
                    continue
                    
                text_match = re.search(r'^>\s*\*\*“(.+?)”\*\*|^>\s*\*\*(.+?)\*\*', quote_block, re.MULTILINE)
                author_match = re.search(r'^>\s*—\s*\*\*Attributed to:\*\*\s*\*\*([^\*]+)\*\*', quote_block, re.MULTILINE)
                
                if not text_match:
                    continue
                    
                quote_text = text_match.group(1) or text_match.group(2)
                thinker = strip_clean(author_match.group(1)) if author_match else "UPSC"
                
                title = f"{thinker} Quote"
                
                pyq_match = re.search(r'Year:\s*(\d{4})', quote_block)
                pyqs_list = [pyq_match.group(1)] if pyq_match else []
                
                hierarchy_path = build_hierarchy_path("GS-IV", "ETHICS, INTEGRITY & APTITUDE", "UPSC PYQ Quotes", topic_name)
                
                results.append({
                    "ethics_type": "pyq_quote",
                    "paper": "GS-IV",
                    "subject": "ETHICS, INTEGRITY & APTITUDE",
                    "section_group": "UPSC PYQ Quotes",
                    "microtopic": topic_name,
                    "subtopic": None,
                    "title": title,
                    "content_markdown": quote_block,
                    "diagram_image_path": None,
                    "officer_name": None,
                    "initiative": None,
                    "impact": None,
                    "core_values": None,
                    "pyqs": pyqs_list,
                    "hierarchy_path": hierarchy_path
                })

    # File 6: X-Factor 2026 Ethics 6 Dimensions_pages_5_6.md
    theory_file = os.path.join(folder, "X-Factor 2026 Ethics 6 Dimensions_pages_5_6.md")
    if os.path.exists(theory_file):
        with open(theory_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        sections = re.split(r'\n##\s+', content)
        for sec in sections[1:]:
            lines = sec.split('\n')
            sec_title = strip_clean(lines[0])
            
            block_content = "\n".join(lines[1:])
            tags = extract_bracket_tags(block_content)
            
            subject = tags.get('subject', 'ETHICS, INTEGRITY & APTITUDE')
            section_group = tags.get('section_group', 'Ethics & Human Values')
            microtopic = tags.get('microtopic', 'Ethics and Human Interface')
            subtopic = tags.get('subtopic', None)
            
            pyqs_list = re.findall(r'\[(\d{4})\]', block_content)
            
            cleaned_text = re.sub(r'\[(Subject|Section Group|Microtopic|Subtopic|Category):\s*[^\]]+\]\n*', '', block_content)
            
            hierarchy_path = build_hierarchy_path("GS-IV", subject, section_group, microtopic, subtopic)
            
            results.append({
                "ethics_type": "dimension",
                "paper": "GS-IV",
                "subject": subject,
                "section_group": section_group,
                "microtopic": microtopic,
                "subtopic": subtopic,
                "title": sec_title,
                "content_markdown": strip_clean(cleaned_text),
                "diagram_image_path": None,
                "officer_name": None,
                "initiative": None,
                "impact": None,
                "core_values": None,
                "pyqs": pyqs_list,
                "hierarchy_path": hierarchy_path
            })

    # File 7: khemka sir/khemka_situations_tagged.md
    khemka_situations = os.path.join(folder, "khemka sir", "khemka_situations_tagged.md")
    if os.path.exists(khemka_situations):
        with open(khemka_situations, 'r', encoding='utf-8') as f:
            content = f.read()
            
        situations = re.split(r'\n---\s*###\s+\*\*Situation\s+\d+', content)
        for sit_block in situations[1:]:
            lines = sit_block.split('\n')
            
            header_line = lines[0]
            id_match = re.search(r'\[ID:\s*([^\]]+)\]', header_line)
            year_match = re.search(r'\((\d{4})\)', header_line)
            
            sit_id = id_match.group(1) if id_match else ""
            year = year_match.group(1) if year_match else ""
            
            block_content = "\n".join(lines[1:])
            tags = extract_bracket_tags(block_content)
            
            subject = tags.get('subject', 'ETHICS, INTEGRITY & APTITUDE')
            section_group = tags.get('section_group', 'Applied Ethics')
            microtopic = tags.get('microtopic', 'Case Studies on above issues')
            subtopic = tags.get('subtopic', 'Workplace Ethics & Institutional Integrity')
            
            theme_match = re.search(r'\*\s+\*\*Theme:\*\*\s*(.+)$', block_content, re.MULTILINE)
            sit_text_match = re.search(r'\*\s+\*\*Situation:\*\*\s*(.+?)(?=\n\*|\n---|$)', block_content, re.DOTALL)
            resp_match = re.search(r'\*\s+\*\*Khemka Sir’s Response:\*\*\s*(.+?)(?=\n\*|\n---|$)', block_content, re.DOTALL)
            principle_match = re.search(r'\*\s+\*\*Principle:\*\*\s*(.+?)(?=\n\*|\n---|$)', block_content, re.DOTALL)
            
            theme = strip_clean(theme_match.group(1)) if theme_match else ""
            situation_text = strip_clean(sit_text_match.group(1)) if sit_text_match else ""
            response_text = strip_clean(resp_match.group(1)) if resp_match else ""
            principle = strip_clean(principle_match.group(1)) if principle_match else ""
            
            title = f"Case Study Situation - {sit_id}"
            
            formatted_markdown = f"**ID**: {sit_id} ({year})\n**Theme**: {theme}\n**Situation**: {situation_text}\n**Khemka Sir's Response**: {response_text}\n**Principle**: {principle}"
            
            hierarchy_path = build_hierarchy_path("GS-IV", subject, section_group, microtopic, subtopic)
            
            results.append({
                "ethics_type": "situation",
                "paper": "GS-IV",
                "subject": subject,
                "section_group": section_group,
                "microtopic": microtopic,
                "subtopic": subtopic,
                "title": title,
                "content_markdown": formatted_markdown,
                "diagram_image_path": None,
                "officer_name": None,
                "initiative": None,
                "impact": None,
                "core_values": principle,
                "pyqs": [year] if year else [],
                "hierarchy_path": hierarchy_path
            })

    # File 8: General Khemka Sir files
    for other_khemka_file in ["khemka_ethical_rules.md", "khemka_keyword_toolkit.md", "Khemka_Sir's_5_Step_Answer_Skeleton.md"]:
        filepath = os.path.join(folder, "khemka sir", other_khemka_file)
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                raw_content = f.read()
                
            title_match = re.search(r'^#\s+(.+)$|^##\s+(.+)$', raw_content, re.MULTILINE)
            title = strip_clean(title_match.group(1) or title_match.group(2)) if title_match else other_khemka_file.replace(".md", "").replace("_", " ")
            
            hierarchy_path = ["GS-IV", "ETHICS, INTEGRITY & APTITUDE", "Applied Ethics", "Case Studies Toolkit"]
            
            results.append({
                "ethics_type": "keyword",
                "paper": "GS-IV",
                "subject": "ETHICS, INTEGRITY & APTITUDE",
                "section_group": "Applied Ethics",
                "microtopic": "Case Studies Toolkit",
                "subtopic": None,
                "title": title,
                "content_markdown": strip_clean(raw_content),
                "diagram_image_path": None,
                "officer_name": None,
                "initiative": None,
                "impact": None,
                "core_values": None,
                "pyqs": [],
                "hierarchy_path": hierarchy_path
            })
            
    out_path = os.path.join(OUT_DIR, "mains_ethics_value_add.json")
    with open(out_path, 'w', encoding='utf-8') as out_f:
        json.dump(results, out_f, indent=2, ensure_ascii=False)
    print(f"Parsed {len(results)} Ethics cards to {out_path}")

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================
def main():
    print("Starting Value Additions Markdown Parsing...")
    parse_data_facts()
    parse_intro_conclusions()
    parse_essay_value_add()
    parse_mnemonics()
    parse_frameworks()
    parse_ethics_value_add()
    print("Value Additions Parsing Completed Successfully!")

if __name__ == "__main__":
    main()
