import os
import json
import re
import uuid

VA_DIR = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains tab md files\value additions"
OUT_DIR = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files"

os.makedirs(OUT_DIR, exist_ok=True)

# ==============================================================================
# SYLLABUS TAXONOMY MATCHER (for aligning Keywords, Case Studies, and SC Judgments)
# ==============================================================================
HIERARCHY_PATH = r"C:\Users\Dr. Yogesh\Desktop\mains\neet and upsc cms\upsc\solved paper\merged\GS_Syllabus_Hierarchy_Merged.md"
truth_tree = {}
valid_nodes = []

if os.path.exists(HIERARCHY_PATH):
    import difflib
    try:
        with open(HIERARCHY_PATH, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        current_paper = ""
        current_subject = ""
        current_sec_grp = ""
        current_microtopic = ""
        for line in lines:
            line_strip = line.strip()
            if not line_strip: continue
            if line_strip.startswith("# GS-"):
                current_paper = line_strip.replace("# ", "").strip()
            elif line_strip.startswith("## SUBJECT:"):
                current_subject = line_strip.replace("## SUBJECT:", "").strip().upper()
                if current_subject not in truth_tree:
                    truth_tree[current_subject] = {}
            elif line_strip.startswith("### Section Group:"):
                current_sec_grp = line_strip.replace("### Section Group:", "").strip()
                if current_subject and current_sec_grp not in truth_tree[current_subject]:
                    truth_tree[current_subject][current_sec_grp] = {}
            elif line_strip.startswith("- ") or line_strip.startswith("* "):
                text = re.sub(r'^[-*]\s+', '', line_strip).strip()
                indent = len(line) - len(line.lstrip())
                if indent == 0:
                    current_microtopic = text
                    if current_subject and current_sec_grp:
                        if current_microtopic not in truth_tree[current_subject][current_sec_grp]:
                            truth_tree[current_subject][current_sec_grp][current_microtopic] = set()
                        valid_nodes.append({
                            'paper': current_paper,
                            'subject': current_subject,
                            'section_group': current_sec_grp,
                            'microtopic': current_microtopic,
                            'subtopic': ''
                        })
                elif indent == 2:
                    current_subtopic = text
                    if current_subject and current_sec_grp and current_microtopic:
                        truth_tree[current_subject][current_sec_grp][current_microtopic].add(current_subtopic)
                        valid_nodes.append({
                            'paper': current_paper,
                            'subject': current_subject,
                            'section_group': current_sec_grp,
                            'microtopic': current_microtopic,
                            'subtopic': current_subtopic
                        })
    except Exception as e:
        print(f"Error parsing hierarchy: {e}")

def clean_for_match(text):
    if not text: return ""
    text = text.lower().strip()
    text = text.replace('’', "'").replace('`', "'").replace('–', '-').replace('—', '-')
    text = text.replace('and', '&').replace('isation', 'ization').replace('ise', 'ize')
    text = re.sub(r'[^a-z0-9\s]', '', text)
    return re.sub(r'\s+', ' ', text).strip()

cleaned_micro_map = {}
for n in valid_nodes:
    if n['subtopic'] == '':
        cleaned_micro_map[clean_for_match(n['microtopic'])] = n

subject_alias = {
    "AGRICULTURE & FARM DYNAMICS": "AGRICULTURE",
    "CONSERVATION & ECOSYSTEMS": "ENVIRONMENT",
    "EVERYDAY SCIENCE & INNOVATIONS": "SCIENCE & TECHNOLOGY",
    "INDIGENOUS TECH & ACHIEVEMENTS": "SCIENCE & TECHNOLOGY",
    "FRONTIER TECHNOLOGIES & IPR": "SCIENCE & TECHNOLOGY",
    "PHYSICAL INFRASTRUCTURE & CAPITAL": "INDIAN ECONOMY",
    "MACROECONOMICS & FISCAL POLICY": "INDIAN ECONOMY",
    "POLLUTION & DEGRADATION": "ENVIRONMENT",
    "CLIMATE CHANGE": "ENVIRONMENT",
    "FRAMEWORKS & PREPAREDNESS": "DISASTER MANAGEMENT",
    "SPECIFIC DISASTERS & HAZARDS": "DISASTER MANAGEMENT",
    "EXTREMISM & EXTERNAL THREATS": "INTERNAL SECURITY",
    "BORDER MANAGEMENT & ORGANIZED CRIME": "INTERNAL SECURITY",
    "CYBER, FINANCIAL & MEDIA SECURITY": "INTERNAL SECURITY",
    "SECURITY FORCES & MANDATES": "INTERNAL SECURITY",
    "ETHICS": "ETHICS, INTEGRITY & APTITUDE",
    "GOVERNANCE & PROBITY": "ETHICS, INTEGRITY & APTITUDE",
    "PSYCHOLOGY & FOUNDATIONAL VALUES": "ETHICS, INTEGRITY & APTITUDE",
    "MORAL THINKERS & LEADERS": "ETHICS, INTEGRITY & APTITUDE",
    "APPLIED ETHICS": "ETHICS, INTEGRITY & APTITUDE",
    "SOCIAL JUSTICE AND EMPOWERMENT": "SOCIAL JUSTICE",
    "HEALTH SECTOR REFORMS": "SOCIAL JUSTICE",
    "EDUCATION REFORMS": "SOCIAL JUSTICE",
    "GOVERNANCE AND ACCOUNTABILITY": "GOVERNANCE",
    "ECONOMIC POLICIES AND REFORMS": "INDIAN ECONOMY",
    "ELECTIONS & POLITICAL DYNAMICS": "POLITY",
    "ACCOUNTABILITY & CIVIL SERVICES": "GOVERNANCE",
    "SOCIAL SECTOR & HUMAN DEVELOPMENT": "SOCIAL JUSTICE",
    "ECONOMY": "INDIAN ECONOMY"
}

def find_smart_match(paper, subject, sec_grp, micro, old_subtopic=""):
    if not valid_nodes: return None
    import difflib
    subj_upper = subject.upper().strip()
    subj_resolved = subject_alias.get(subj_upper, subj_upper)
    sec_grp_clean = clean_for_match(sec_grp)
    micro_clean = clean_for_match(micro)
    old_sub_clean = clean_for_match(old_subtopic)
    
    subject_nodes = [n for n in valid_nodes if n['subject'] == subj_resolved]
    
    # 0. Check if the microtopic is general/miscellaneous
    if micro_clean in ('general', 'miscellaneous', 'other', 'unknown', ''):
        for n in subject_nodes:
            if clean_for_match(n['section_group']) == sec_grp_clean and n['subtopic'] == '':
                return n
        for n in subject_nodes:
            if clean_for_match(n['section_group']) == sec_grp_clean:
                return n
    
    for n in subject_nodes:
        if n['subtopic'] and clean_for_match(n['subtopic']) == micro_clean:
            return n
            
    if old_sub_clean:
        for n in subject_nodes:
            if n['subtopic'] and clean_for_match(n['subtopic']) == old_sub_clean:
                return n

    exact_micro_node = None
    for n in subject_nodes:
        if clean_for_match(n['section_group']) == sec_grp_clean:
            if clean_for_match(n['microtopic']) == micro_clean:
                if old_sub_clean and clean_for_match(n['subtopic']) == old_sub_clean:
                    return n
                if n['subtopic'] == '':
                    exact_micro_node = n
                    
    if exact_micro_node:
        if old_sub_clean:
            for n in subject_nodes:
                if clean_for_match(n['section_group']) == sec_grp_clean:
                    if clean_for_match(n['microtopic']) == micro_clean:
                        n_sub_clean = clean_for_match(n['subtopic'])
                        if n_sub_clean and (n_sub_clean in old_sub_clean or old_sub_clean in n_sub_clean):
                            return n
        return exact_micro_node

    for n in subject_nodes:
        if clean_for_match(n['microtopic']) == micro_clean:
            if old_sub_clean and clean_for_match(n['subtopic']) == old_sub_clean:
                return n
            if n['subtopic'] == '':
                exact_micro_node = n
                
    if exact_micro_node:
        if old_sub_clean:
            for n in subject_nodes:
                if clean_for_match(n['microtopic']) == micro_clean:
                    n_sub_clean = clean_for_match(n['subtopic'])
                    if n_sub_clean and (n_sub_clean in old_sub_clean or old_sub_clean in n_sub_clean):
                        return n
        return exact_micro_node

    if micro_clean in cleaned_micro_map:
        base_node = cleaned_micro_map[micro_clean]
        if old_sub_clean:
            for n in valid_nodes:
                if clean_for_match(n['microtopic']) == micro_clean:
                    n_sub_clean = clean_for_match(n['subtopic'])
                    if n_sub_clean and (n_sub_clean in old_sub_clean or old_sub_clean in n_sub_clean):
                        return n
        return base_node

    best_node = None
    best_score = 0.0
    for n in subject_nodes:
        if n['subtopic'] == '':
            score = difflib.SequenceMatcher(None, micro_clean, clean_for_match(n['microtopic'])).ratio()
            if micro_clean in clean_for_match(n['microtopic']) or clean_for_match(n['microtopic']) in micro_clean:
                score += 0.3
            if score > best_score and score >= 0.7:
                best_score = score
                best_node = n
                
    if best_node:
        if old_sub_clean:
            for n in subject_nodes:
                if clean_for_match(n['microtopic']) == clean_for_match(best_node['microtopic']):
                    n_sub_clean = clean_for_match(n['subtopic'])
                    if n_sub_clean and (n_sub_clean in old_sub_clean or old_sub_clean in n_sub_clean):
                        return n
        return best_node

    for n in valid_nodes:
        if n['subtopic'] == '':
            score = difflib.SequenceMatcher(None, micro_clean, clean_for_match(n['microtopic'])).ratio()
            if micro_clean in clean_for_match(n['microtopic']) or clean_for_match(n['microtopic']) in micro_clean:
                score += 0.3
            if score > best_score and score >= 0.75:
                best_score = score
                best_node = n
                
    if best_node:
        if old_sub_clean:
            for n in valid_nodes:
                if clean_for_match(n['microtopic']) == clean_for_match(best_node['microtopic']):
                    n_sub_clean = clean_for_match(n['subtopic'])
                    if n_sub_clean and (n_sub_clean in old_sub_clean or old_sub_clean in n_sub_clean):
                        return n
        return best_node
        
    return None


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

def get_paper_from_subject(subject, default_paper="GS1"):
    if not subject:
        return default_paper
    sub_clean = subject.strip().upper()
    if sub_clean in ["SOCIETY", "GEOGRAPHY", "HISTORY", "ART AND CULTURE", "WORLD HISTORY", "MODERN HISTORY", "HUMAN GEOGRAPHY", "PHYSICAL GEOGRAPHY"]:
        return "GS1"
    elif sub_clean in ["POLITY", "GOVERNANCE", "INTERNATIONAL RELATIONS", "SOCIAL JUSTICE", "NEIGHBORHOOD & BILATERAL ENGAGEMENTS"]:
        return "GS2"
    elif sub_clean in ["INDIAN ECONOMY", "DISASTER MANAGEMENT", "AGRICULTURE", "ENVIRONMENT", "SCIENCE & TECHNOLOGY", "SECURITY", "INTERNAL SECURITY"]:
        return "GS3"
    elif sub_clean in ["ETHICS, INTEGRITY & APTITUDE", "ETHICS"]:
        return "GS4"
    elif "ESSAY" in sub_clean:
        return "Essay"
    return default_paper


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
def parse_card_body_to_dict(card_body):
    body = '\n' + card_body
    # Split by any root-level bullet bold heading: e.g. * **Heading:**
    parts = re.split(r'\n\s*[\*\-]\s+\*\*(.+?):\*\*\s*', body)
    
    sections = {}
    if len(parts) > 1:
        for i in range(1, len(parts), 2):
            h_name = parts[i].strip()
            h_content = parts[i+1] if i+1 < len(parts) else ""
            # Strip trailing separator belonging to next card/subtopic boundaries
            h_content = h_content.split('\n---')[0].strip()
            sections[h_name.lower()] = h_content
            
    return sections

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
        subtopics = re.split(r'\n#####\s+Subtopic:[ \t]*', content)
        
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
                card_body = card_body.split('\n---')[0].strip()
                
                hierarchy_path = build_hierarchy_path(default_paper, subject, section_group, microtopic, subtopic)
                
                results.append({
                    "paper": default_paper,
                    "subject": subject,
                    "section_group": section_group,
                    "microtopic": microtopic,
                    "subtopic": subtopic,
                    "card_title": card_title,
                    "body": card_body,
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
        
    def clean_field_value(val):
        if not val:
            return ""
        val_lines = val.splitlines()
        if len(val_lines) == 1:
            val = re.sub(r'^\s*[-\*•]\s*', '', val)
        elif len(val_lines) > 1:
            first_line = val_lines[0].strip()
            if first_line.startswith('- ') or first_line.startswith('* '):
                val_lines[0] = re.sub(r'^\s*[-\*•]\s*', '', val_lines[0])
            val = "\n".join(val_lines)
        return val.strip()

    # Split by H3 section groups (ANECDOTES or QUOTES)
    sections_parts = re.split(r'\n###\s+Section\s+Group:\s*(ANECDOTES|QUOTES)\n', content)
    
    for idx in range(1, len(sections_parts), 2):
        sec_group = sections_parts[idx].strip()
        sec_content = sections_parts[idx+1]
        
        # Split by H4 microtopics
        microtopics = re.split(r'\n####\s+Microtopic:\s*', sec_content)
        
        for mt_block in microtopics[1:]:
            lines = mt_block.split('\n')
            microtopic_name = strip_clean(lines[0])
            
            block_content = "\n".join(lines[1:])
            
            # Split cards by ###### Anecdote X: or ###### Quote X:
            cards = re.split(r'\n######\s+(Anecdote|Quote)\s+\d+:\s*(.+?)\n', block_content)
            
            for i in range(1, len(cards), 3):
                entry_type = strip_clean(cards[i]).lower() # 'anecdote' or 'quote'
                title = strip_clean(cards[i+1])
                card_body = cards[i+2] if i+2 < len(cards) else ""
                card_body = card_body.split('\n---')[0].strip()
                
                # Parse fields inside card body dynamically
                body = '\n' + card_body
                parts = re.split(r'\n\s*[\*\-]\s+\*\*(.+?):\*\*\s*', body)
                
                fields = {}
                if len(parts) > 1:
                    for j in range(1, len(parts), 2):
                        f_name = parts[j].strip().lower()
                        f_val = parts[j+1].strip() if j+1 < len(parts) else ""
                        fields[f_name] = f_val
                
                category = clean_field_value(fields.get('category')).replace("`", "") if fields.get('category') else microtopic_name
                raw_content = clean_field_value(fields.get('content') or fields.get('quote'))
                
                hierarchy_path = build_hierarchy_path("Essay", "Essay", sec_group, microtopic_name)
                
                row = {
                    "paper": "Essay",
                    "subject": "Essay",
                    "section_group": sec_group,
                    "microtopic": microtopic_name,
                    "subtopic": None,
                    "title": title,
                    "category": category,
                    "entry_type": entry_type,
                    "content": raw_content,
                    "hierarchy_path": hierarchy_path
                }
                
                author_val = clean_field_value(fields.get('author'))
                if author_val:
                    row["author"] = author_val
                    
                usage_val = clean_field_value(fields.get('usage guide') or fields.get('usage_guide'))
                if usage_val:
                    row["usage_guide"] = usage_val
                    
                results.append(row)
            
    # Parse Essay Connectors / Transition Words
    connecting_path = os.path.join(VA_DIR, "essay", "Connecting_Words.md")
    if os.path.exists(connecting_path):
        with open(connecting_path, 'r', encoding='utf-8') as f:
            essay_conn_content = f.read()
            
        def build_conn_card(sec_grp, m_topic, s_topic, card_title, card_body):
            return {
                "paper": "Essay",
                "subject": "Essay",
                "section_group": sec_grp,
                "microtopic": m_topic,
                "subtopic": s_topic,
                "title": card_title,
                "category": "Connecting Words",
                "entry_type": "quote",
                "content": card_body,
                "hierarchy_path": build_hierarchy_path("Essay", "Essay", sec_grp, m_topic, s_topic)
            }
            
        conn_results = _parse_hierarchy_md(essay_conn_content, build_conn_card)
        results.extend(conn_results)

    out_path = os.path.join(OUT_DIR, "mains_essay_value_add.json")
    with open(out_path, 'w', encoding='utf-8') as out_f:
        json.dump(results, out_f, indent=2, ensure_ascii=False)
        
    out_path_admin = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\admin-panel\mains-json\mains_essay_value_add.json"
    with open(out_path_admin, 'w', encoding='utf-8') as out_f:
        json.dump(results, out_f, indent=2, ensure_ascii=False)
        
    print(f"Parsed {len(results)} Essay Anecdotes and Connectors to {out_path} and {out_path_admin}")

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
        subtopics = re.split(r'\n#####\s+Subtopic:[ \t]*', content)
        
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
        
    frameworks = re.split(r'\n#\s+Framework\s+\d+:\s*', '\n' + content)
    
    for fw_block in frameworks[1:]:
        lines = fw_block.split('\n')
        framework_title = strip_clean(lines[0])
        
        block_content = "\n".join(lines[1:])
        
        img_match = re.search(r'!\[.*?\]\(((?:https?://.+?/)?images/.+?)\)', block_content)
        diagram_image_path = img_match.group(1) if img_match else None
        r2_image_path = None
        if diagram_image_path:
            if diagram_image_path.startswith("http"):
                r2_image_path = diagram_image_path
            else:
                r2_image_path = f"https://pub-cfb8b9095d7d4914990dbb6f73afeb92.r2.dev/general/frameworks/{diagram_image_path}"
        
        hierarchies = []
        hierarchy_lines = re.findall(r'\[Hierarchy\s+\d+\]\s*(.+?)(?=\n|$)', fw_block)
        for h_line in hierarchy_lines:
            tags = extract_bracket_tags(h_line)
            subject = tags.get('subject', '')
            paper = tags.get('paper')
            if not paper or paper == 'GS-I/II/III':
                paper = get_paper_from_subject(subject, 'GS1')
                
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
        
        h_paths = [h["path"] for h in hierarchies]
        
        results.append({
            "framework_name": framework_title,
            "diagram_image_path": r2_image_path,
            "breakdown_markdown": strip_clean(cleaned_body),
            "hierarchies": hierarchies,
            "hierarchy_1_path": h_paths[0] if len(h_paths) > 0 else None,
            "hierarchy_2_path": h_paths[1] if len(h_paths) > 1 else None,
            "hierarchy_3_path": h_paths[2] if len(h_paths) > 2 else None,
            "hierarchy_4_path": h_paths[3] if len(h_paths) > 3 else None,
            "hierarchy_5_path": h_paths[4] if len(h_paths) > 4 else None,
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
            
        subtopics = re.split(r'\n#####\s+Subtopic:[ \t]*', content)
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
            if diagram_image_path:
                diagram_image_path = f"https://pub-cfb8b9095d7d4914990dbb6f73afeb92.r2.dev/civilsdaily/{diagram_image_path}"
            
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
            
        diag_sections = re.split(r'\n## (?=\d)', content)
        for section in diag_sections:
            sec_trimmed = section.strip()
            if not sec_trimmed:
                continue
            if '# X-Factor 2026 Ethics Diagrams' in sec_trimmed and '## 1.' not in sec_trimmed:
                continue

            lines = sec_trimmed.split('\n')
            heading = lines[0].strip()
            # Clean heading
            heading_match = re.match(r'^\d+\.\s*(.*)$', heading)
            diagram_type = heading_match.group(1).strip() if heading_match else heading

            subject = 'ETHICS, INTEGRITY & APTITUDE'
            section_group = 'Ethics & Human Values'
            microtopic = ''
            subtopic = ''
            
            intro_lines = []
            use_cases_lines = []
            pyq_lines = []
            diagrams_list = []
            
            current_block = 'intro'
            
            i = 1
            while i < len(lines):
                line = lines[i].replace('\r', '')
                # Clean encoding issue
                line = line.replace('\uFFFD', '—')
                trimmed = line.strip()
                if not trimmed:
                    i += 1
                    continue
                
                if trimmed.startswith('[Subject:'):
                    subject = trimmed[9:-1].strip()
                    i += 1
                    continue
                if trimmed.startswith('[Section Group:'):
                    section_group = trimmed[15:-1].strip()
                    i += 1
                    continue
                if trimmed.startswith('[Microtopic:'):
                    microtopic = trimmed[12:-1].strip()
                    i += 1
                    continue
                if trimmed.startswith('[Subtopic:'):
                    subtopic = trimmed[10:-1].strip()
                    i += 1
                    continue
                
                if trimmed.lower().startswith('### use cases'):
                    current_block = 'usecase'
                    i += 1
                    continue
                if trimmed.lower().startswith('### pyqs') or trimmed.lower().startswith('### pyq'):
                    current_block = 'pyq'
                    i += 1
                    continue
                
                if trimmed.lower().startswith('### diagram:'):
                    diag_name = trimmed[12:].strip()
                    image_path = ''
                    # Look ahead for image
                    j = i + 1
                    while j < min(i + 5, len(lines)):
                        next_line = lines[j].strip()
                        img_match = re.search(r'!\[.*?\]\((.*?)\)', next_line)
                        if img_match:
                            image_path = img_match.group(1).strip()
                            break
                        j += 1
                    diagrams_list.append({
                        "title": diag_name,
                        "imagePath": image_path
                    })
                    i += 1
                    continue
                
                if trimmed.startswith('!['):
                    i += 1
                    continue
                
                if current_block == 'intro':
                    intro_lines.append(line)
                elif current_block == 'usecase':
                    use_cases_lines.append(line)
                elif current_block == 'pyq':
                    pyq_lines.append(line)
                i += 1

            pyq_text = "\n".join(pyq_lines)
            pyq_years = list(set(re.findall(r'\[(20\d{2})\]', pyq_text)))

            intro_part = "\n".join(intro_lines).strip()
            use_case_part = "\n".join(use_cases_lines).strip()
            pyq_part = "\n".join(pyq_lines).strip()

            markdown_body = ""
            if intro_part:
                markdown_body += intro_part + "\n\n"
            if use_case_part:
                markdown_body += f"### Use Cases\n{use_case_part}\n\n"
            if pyq_part:
                markdown_body += f"### PYQs\n{pyq_part}"
            markdown_body = markdown_body.strip()

            if not diagrams_list:
                # Fallback scan for any image tags in the section
                img_matches = re.findall(r'!\[.*?\]\((.*?)\)', sec_trimmed)
                for path in img_matches:
                    diagrams_list.append({
                        "title": "",
                        "imagePath": path.strip()
                    })

            mapped_diagrams = []
            for d in diagrams_list:
                clean_img_path = d["imagePath"].replace('\\', '/')
                full_img_url = f"https://pub-cfb8b9095d7d4914990dbb6f73afeb92.r2.dev/civilsdaily/{clean_img_path}" if clean_img_path else ""
                if full_img_url:
                    mapped_diagrams.append({
                        "title": d["title"],
                        "imagePath": full_img_url
                    })

            diagram_image_path = ",".join([d["imagePath"] for d in mapped_diagrams])

            hierarchy_path = build_hierarchy_path("GS-IV", subject, section_group, microtopic, subtopic)

            results.append({
                "ethics_type": "diagram",
                "paper": "GS-IV",
                "subject": subject,
                "section_group": section_group,
                "microtopic": microtopic,
                "subtopic": subtopic,
                "title": diagram_type,
                "content_markdown": markdown_body,
                "diagram_image_path": diagram_image_path if diagram_image_path else None,
                "officer_name": None,
                "initiative": None,
                "impact": None,
                "core_values": None,
                "pyqs": pyq_years,
                "hierarchy_path": hierarchy_path,
                "ethicsData": {
                    "diagramType": diagram_type,
                    "diagramDescription": markdown_body,
                    "diagramsList": mapped_diagrams,
                    "dimensionsList": [],
                    "comparisonPoints": [],
                    "columnHeaders": { "col1": "Aspect", "col2": "Term A", "col3": "Term B" },
                    "comparisonNonTableContent": "",
                    "keywordDefinition": markdown_body,
                    "keywordExample": ""
                }
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
            sit_type_match = re.search(r'\*\*\s*Situation\s+Type:\s*\*\*\s*`([^`]+)`', block_content, re.IGNORECASE)
            
            theme = strip_clean(theme_match.group(1)) if theme_match else ""
            situation_text = strip_clean(sit_text_match.group(1)) if sit_text_match else ""
            response_text = strip_clean(resp_match.group(1)) if resp_match else ""
            principle = strip_clean(principle_match.group(1)) if principle_match else ""
            situation_type = strip_clean(sit_type_match.group(1)) if sit_type_match else ""
            
            title = f"Case Study Situation - {sit_id}"
            
            formatted_markdown = f"**ID**: {sit_id} ({year})\n**Theme**: {theme}\n**Situation**: {situation_text}\n**Khemka Sir's Response**: {response_text}\n**Principle**: {principle}"
            if situation_type:
                formatted_markdown += f"\n**Situation Type**: {situation_type}"
            
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
            
    out_path = os.path.join(OUT_DIR, "mains_ethics_value_add.json")
    with open(out_path, 'w', encoding='utf-8') as out_f:
        json.dump(results, out_f, indent=2, ensure_ascii=False)
    
    # Also write to admin-panel/mains-json/mains_ethics_value_add.json
    out_path_admin = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\admin-panel\mains-json\mains_ethics_value_add.json"
    with open(out_path_admin, 'w', encoding='utf-8') as out_f:
        json.dump(results, out_f, indent=2, ensure_ascii=False)
    print(f"Parsed {len(results)} Ethics cards to {out_path} and {out_path_admin}")

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
            
    # File 9: GS4- Indian Philosophies and Religious Ethics.md
    philosophies_file = os.path.join(folder, "GS4- Indian Philosophies and Religious Ethics.md")
    if os.path.exists(philosophies_file):
        with open(philosophies_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        cards = re.split(r'\n##\s+\d+\.\s*', content)
        for card_block in cards[1:]:
            lines = card_block.split('\n')
            title = strip_clean(lines[0])
            
            block_content = "\n".join(lines[1:])
            tags = extract_bracket_tags(block_content)
            
            subject = tags.get('subject', 'ETHICS, INTEGRITY & APTITUDE')
            section_group = tags.get('section_group', 'Moral Thinkers & Leaders')
            microtopic = tags.get('microtopic', 'Contributions of Moral Thinkers and Philosophers from India and World')
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
                "title": title,
                "content_markdown": strip_clean(cleaned_text),
                "diagram_image_path": None,
                "officer_name": None,
                "initiative": None,
                "impact": None,
                "core_values": "philosophy",
                "pyqs": [],
                "hierarchy_path": hierarchy_path
            })

    # File 10: Final Ethics Phrases Updated.md
    phrases_file = os.path.join(folder, "Final Ethics Phrases Updated.md")
    if os.path.exists(phrases_file):
        with open(phrases_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        cards = re.split(r'\n##\s+\d+\.\s*', content)
        for card_block in cards[1:]:
            lines = card_block.split('\n')
            title = strip_clean(lines[0])
            
            block_content = "\n".join(lines[1:])
            tags = extract_bracket_tags(block_content)
            
            subject = tags.get('subject', 'ETHICS, INTEGRITY & APTITUDE')
            section_group = tags.get('section_group', 'Governance & Probity')
            microtopic = tags.get('microtopic', None)
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
                "title": title,
                "content_markdown": strip_clean(cleaned_text),
                "diagram_image_path": None,
                "officer_name": None,
                "initiative": None,
                "impact": None,
                "core_values": "phrase",
                "pyqs": [],
                "hierarchy_path": hierarchy_path
            })

    # File 11: ETHICAL DILEMMAS.md
    dilemmas_file = os.path.join(folder, "ETHICAL DILEMMAS.md")
    if os.path.exists(dilemmas_file):
        with open(dilemmas_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        cards = re.split(r'\n##\s+\d+\.\s*', content)
        for card_block in cards[1:]:
            lines = card_block.split('\n')
            title = strip_clean(lines[0])
            
            block_content = "\n".join(lines[1:])
            tags = extract_bracket_tags(block_content)
            
            subject = tags.get('subject', 'ETHICS, INTEGRITY & APTITUDE')
            section_group = tags.get('section_group', 'Applied Ethics')
            microtopic = tags.get('microtopic', 'Case Studies on above issues')
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
                "title": title,
                "content_markdown": strip_clean(cleaned_text),
                "diagram_image_path": None,
                "officer_name": None,
                "initiative": None,
                "impact": None,
                "core_values": "dilemma",
                "pyqs": [],
                "hierarchy_path": hierarchy_path
            })
            
    # Parse Phase 2 General Keywords, Case Studies, and SC Judgments
    def split_into_cards(sub_content):
        """Handle both --- separator and numbered/bullet list formats."""
        # Try --- separator first
        if '\n---' in sub_content:
            parts = sub_content.split('\n---')
            if len(parts) > 1:
                return parts
        # Try numbered list: lines like "1. **keyword**" or "1. keyword"
        numbered = re.split(r'\n(?=\d+\.\s)', sub_content)
        if len(numbered) > 1:
            return numbered
        # Try bullet list: lines like "- **keyword**" or "• **keyword**"
        bulleted = re.split(r'\n(?=[-•]\s+\*\*)', sub_content)
        if len(bulleted) > 1:
            return bulleted
        return [sub_content]

    def extract_title_and_body(card):
        """Extract clean keyword title and body. Handles both:
        1. **Keyword** - definition (correct format)
        2. **Keyword refers to definition** (entire phrase bolded - PDF artifact)
        3. 1. **Keyword** - definition (numbered list)
        """
        card = card.strip()
        # Remove leading number or bullet
        card = re.sub(r'^\d+\.\s+', '', card)
        card = re.sub(r'^[-•]\s+', '', card)

        title_match = re.search(r'\*\*(.+?)\*\*', card, re.DOTALL)
        if not title_match:
            return None, None

        raw_title = title_match.group(1).strip()
        raw_title = re.sub(r'^[-•\*\d\.]\s*', '', raw_title).strip()

        # If the bolded text is actually the whole "Keyword definition Example" phrase,
        # split at the first verb/separator to isolate just the keyword name
        DEFN_SEPARATORS = [
            r'\s+refers to\s+', r'\s+is the\s+', r'\s+are the\s+',
            r'\s+means\s+', r'\s+denotes\s+', r'\s+involves\s+',
            r'\s+describes\s+', r'\s+is a\s+', r'\s+is an\s+',
            r'\s+are a\s+', r'\s+signifies\s+', r'\s+represents\s+',
            r'\s+indicates\s+', r'\s+refers\b', r'\s+is\s+(?:the|a|an)\s+',
            r'\s+are\s+(?:jali|simple|symbolic|carved|sacred|overhanging|complementary|functional|intricate|flexible)',
            r'\s+uses\s+', r'\s+features\s+', r'\s+integrates\s+',
            r'\s+allows\s+', r'\s+promotes\s+', r'\s+emphasizes\s+',
            r'\s+ensures\s+', r'\s+combines\s+', r'\s+blends\s+',
        ]
        prepend_body = ''
        for sep_pat in DEFN_SEPARATORS:
            m = re.search(sep_pat, raw_title, re.IGNORECASE)
            if m and m.start() > 2:  # keyword must be at least 3 chars
                prepend_body = raw_title[m.start():].strip()
                raw_title = raw_title[:m.start()].strip()
                break

        # Get rest of card after the bold match
        parts = card.split(title_match.group(0), 1)
        body_rest = parts[1].strip() if len(parts) > 1 else ''
        # Remove leading colon, dash, hyphen
        body_rest = re.sub(r'^[:\-–]\s*', '', body_rest).strip()

        # Combine
        if prepend_body and body_rest:
            card_body = prepend_body.rstrip(' ') + ' ' + body_rest
        elif prepend_body:
            card_body = prepend_body
        else:
            card_body = body_rest

        # Clean per-line orphan 'o' (PDF artifact) and promo links
        body_lines = card_body.split('\n')
        cleaned_lines = []
        for line in body_lines:
            line = re.sub(r'https\S+', '', line)
            line = re.sub(r'Search @\S+', '', line)
            line = re.sub(r'\s+o\s*$', '', line)  # trailing orphan 'o'
            cleaned_lines.append(line)
        card_body = '\n'.join(cleaned_lines).strip()

        # Also clean title
        raw_title = re.sub(r'\s+o\s*$', '', raw_title).strip()

        return raw_title, card_body

    def parse_md_value_add_cards(filepath, core_val_type, default_subject, default_paper):
        if not os.path.exists(filepath):
            print(f"  File not found: {filepath}")
            return []
            
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        subject_match = re.search(r'^#\s+Subject:\s*(.+)$', content, re.MULTILINE)
        subj = strip_clean(subject_match.group(1)) if subject_match else default_subject
        
        parsed_results = []
        sec_parts = re.split(r'(?m)^\s*###\s+Section\s+Group:\s*', content)
        for sec_part in sec_parts[1:]:
            lines = sec_part.split('\n')
            sec_grp = strip_clean(lines[0])
            sec_content = "\n".join(lines[1:])
            
            micro_parts = re.split(r'(?m)^\s*####\s+Microtopic:\s*', sec_content)
            for micro_part in micro_parts[1:]:
                m_lines = micro_part.split('\n')
                m_topic = strip_clean(m_lines[0])
                micro_content = "\n".join(m_lines[1:])
                
                sub_parts = re.split(r'(?m)^\s*#####\s+Subtopic:\s*', micro_content)
                for sub_part in sub_parts[1:]:
                    s_lines = sub_part.split('\n')
                    s_topic = strip_clean(s_lines[0])
                    sub_content = "\n".join(s_lines[1:])
                    
                    cards = split_into_cards(sub_content)
                    for card in cards:
                        if not card.strip(): continue
                        card_title, card_body = extract_title_and_body(card)
                        if not card_title: continue
                        
                        # Determine Paper from Subject
                        paper = default_paper
                        if subj == "HISTORY" or subj == "SOCIETY":
                            paper = "GS-I"
                        elif subj == "POLITY" or subj == "GOVERNANCE" or subj == "SOCIAL JUSTICE" or subj == "INTERNATIONAL RELATIONS":
                            paper = "GS-II"
                        elif subj == "ECONOMY" or subj == "AGRICULTURE" or subj == "SCIENCE & TECHNOLOGY" or subj == "ENVIRONMENT" or subj == "DISASTER MANAGEMENT" or subj == "INTERNAL SECURITY":
                            paper = "GS-III"
                            
                        h_path = build_hierarchy_path(paper, subj, sec_grp, m_topic, s_topic)
                        
                        parsed_results.append({
                            "paper": paper,
                            "subject": subj,
                            "section_group": sec_grp,
                            "microtopic": m_topic,
                            "subtopic": s_topic,
                            "title": card_title,
                            "content_markdown": card_body,
                            "core_values": [core_val_type],
                            "hierarchy_path": h_path
                        })
        return parsed_results

    # Write Ethics-only output (pure GS4 content)
    out_path = os.path.join(OUT_DIR, "mains_ethics_value_add.json")
    with open(out_path, 'w', encoding='utf-8') as out_f:
        json.dump(results, out_f, indent=2, ensure_ascii=False)
        
    out_path_admin = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\admin-panel\mains-json\mains_ethics_value_add.json"
    with open(out_path_admin, 'w', encoding='utf-8') as out_f:
        json.dump(results, out_f, indent=2, ensure_ascii=False)
        
    print(f"Parsed {len(results)} Ethics cards to {out_path}")


# ==============================================================================
# MODULE-LEVEL CARD PARSING HELPERS (used by parsers 7, 8, 9)
# ==============================================================================
def split_into_cards(sub_content):
    """Handle both --- separator and numbered/bullet list formats."""
    if '\n---' in sub_content:
        parts = sub_content.split('\n---')
        if len(parts) > 1:
            return parts
    numbered = re.split(r'\n(?=\d+\.\s)', sub_content)
    if len(numbered) > 1:
        return numbered
    bulleted = re.split(r'\n(?=[-•]\s+\*\*)', sub_content)
    if len(bulleted) > 1:
        return bulleted
    return [sub_content]

def extract_title_and_body(card):
    """Extract clean keyword title and body, handling bolded-phrase PDF artifacts."""
    card = card.strip()
    card = re.sub(r'^\d+\.\s+', '', card)
    card = re.sub(r'^[-•]\s+', '', card)

    title_match = re.search(r'\*\*(.+?)\*\*', card, re.DOTALL)
    if not title_match:
        return None, None

    raw_title = title_match.group(1).strip()
    raw_title = re.sub(r'^[-•\*\d\.]\s*', '', raw_title).strip()

    is_case_study = '###' in card
    
    DEFN_SEPARATORS = [] if is_case_study else [
        r'\s+refers to\s+', r'\s+is the\s+', r'\s+are the\s+',
        r'\s+means\s+', r'\s+denotes\s+', r'\s+involves\s+',
        r'\s+describes\s+', r'\s+is a\s+', r'\s+is an\s+',
        r'\s+are a\s+', r'\s+signifies\s+', r'\s+represents\s+',
        r'\s+indicates\s+', r'\s+refers\b', r'\s+is\s+(?:the|a|an)\s+',
        r'\s+are\s+(?!the\b|a\b|an\b)', r'\s+uses\s+', r'\s+features\s+',
        r'\s+integrates\s+', r'\s+allows\s+', r'\s+promotes\s+',
        r'\s+emphasizes\s+', r'\s+ensures\s+', r'\s+combines\s+',
        r'\s+blends\s+', r'\s+include\s+', r'\s+is\s+[a-z]',
    ]
    prepend_body = ''
    for sep_pat in DEFN_SEPARATORS:
        m = re.search(sep_pat, raw_title, re.IGNORECASE)
        if m and m.start() > 2:
            prepend_body = raw_title[m.start():].strip()
            raw_title = raw_title[:m.start()].strip()
            break

    parts = card.split(title_match.group(0), 1)
    body_rest = parts[1].strip() if len(parts) > 1 else ''
    if not re.match(r'^[-*•]\s+\*\*', body_rest):
        body_rest = re.sub(r'^[:\-–]\s*', '', body_rest).strip()

    if prepend_body and body_rest:
        card_body = prepend_body.rstrip(' ') + ' ' + body_rest
    elif prepend_body:
        card_body = prepend_body
    else:
        card_body = body_rest

    body_lines = card_body.split('\n')
    cleaned_lines = []
    for line in body_lines:
        line = re.sub(r'https\S+', '', line)
        line = re.sub(r'Search @\S+', '', line)
        line = line.replace('\uf0b7', '').replace('', '')
        line = re.sub(r'\s+o\s*$', '', line)
        cleaned_lines.append(line.strip())
    card_body = '\n'.join(cleaned_lines).strip()
    raw_title = re.sub(r'\s+o\s*$', '', raw_title).strip()
    return raw_title, card_body


def _parse_hierarchy_md(content, card_builder_fn):
    """Generic hierarchy parser: splits by Section Group → Microtopic → Subtopic → cards."""
    results = []
    sec_parts = re.split(r'(?m)^\s*###\s+Section\s+Group:\s*', content)
    for sec_part in sec_parts[1:]:
        lines = sec_part.split('\n')
        sec_grp = strip_clean(lines[0])
        sec_content = "\n".join(lines[1:])
        micro_parts = re.split(r'(?m)^\s*####\s+Microtopic:\s*', sec_content)
        for micro_part in micro_parts[1:]:
            m_lines = micro_part.split('\n')
            m_topic = strip_clean(m_lines[0])
            micro_content = "\n".join(m_lines[1:])
            sub_parts = re.split(r'(?m)^\s*#####\s+Subtopic:[ \t]*', micro_content)
            for sub_part in sub_parts[1:]:
                s_lines = sub_part.split('\n')
                s_topic = strip_clean(s_lines[0])
                sub_content = "\n".join(s_lines[1:])
                for card in split_into_cards(sub_content):
                    if not card.strip(): continue
                    card_title, card_body = extract_title_and_body(card)
                    if not card_title: continue
                    row = card_builder_fn(sec_grp, m_topic, s_topic, card_title, card_body)
                    if row:
                        results.append(row)
    return results


# ==============================================================================
# 7. PARSE KEYWORDS
# ==============================================================================
def parse_keywords():
    def parse_md_cards(filepath, core_val_type, default_subject, default_paper):
        if not os.path.exists(filepath):
            print(f"  File not found: {filepath}")
            return []
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        subject_match = re.search(r'^#\s+Subject:\s*(.+)$', content, re.MULTILINE)
        subj = strip_clean(subject_match.group(1)) if subject_match else default_subject

        def build_card(sec_grp, m_topic, s_topic, card_title, card_body):
            paper = get_paper_from_subject(subj, default_paper)
            seed = f"KEYWORD:{subj.upper()}:{card_title}"
            card_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, seed))
            
            res = find_smart_match(paper, subj, sec_grp, m_topic, s_topic)
            p_val = res['paper'] if res else paper
            s_val = res['subject'] if res else subject_alias.get(subj.upper(), subj)
            sg_val = res['section_group'] if res else sec_grp
            mt_val = res['microtopic'] if res else m_topic
            # ALWAYS keep original subtopic from the MD file — never overwrite with empty
            st_val = s_topic if s_topic.strip() else (res['subtopic'] if res else "")
            
            return {
                "id": card_id,
                "paper": p_val,
                "subject": s_val,
                "section_group": sg_val,
                "microtopic": mt_val,
                "subtopic": st_val,
                "title": card_title,
                "content_markdown": card_body,
                "core_values": [core_val_type],
                "hierarchy_path": build_hierarchy_path(p_val, s_val, sg_val, mt_val, st_val)
            }
        return _parse_hierarchy_md(content, build_card)

    results = []
    kw_dir = os.path.join(VA_DIR, "keywords")
    if os.path.exists(kw_dir):
        for kw_file, subj, paper in [
            ("GS1_History_Keywords.md", "HISTORY", "GS-I"),
            ("GS1_Society_Keywords.md", "SOCIETY", "GS-I"),
            ("GS2_Polity_Keywords.md", "POLITY", "GS-II"),
            ("GS3_Keywords.md", "INDIAN ECONOMY", "GS-III"),
        ]:
            results.extend(parse_md_cards(os.path.join(kw_dir, kw_file), "general_keyword", subj, paper))

    out_path = os.path.join(OUT_DIR, "mains_keywords.json")
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Parsed {len(results)} Keywords cards to {out_path}")


# ==============================================================================
# 8. PARSE CASE STUDIES
# ==============================================================================
def parse_case_studies():
    cs_dir = os.path.join(VA_DIR, "case_studies")
    cs_file = os.path.join(cs_dir, "GS2_GS3_Case_Studies.md") if os.path.exists(cs_dir) else None
    if not cs_file or not os.path.exists(cs_file):
        print("  Case studies file not found.")
        return
    with open(cs_file, 'r', encoding='utf-8') as f:
        content = f.read()

    def build_card(sec_grp, m_topic, s_topic, card_title, card_body):
        # Strip paper and subject lines from card_body (which are redundant)
        lines = card_body.split('\n')
        cleaned_lines = []
        for line in lines:
            line_strip = line.strip().lower()
            if re.match(r'^[-•\*]?\s*\*?(?:paper|subject)\*?\s*:', line_strip):
                continue
            cleaned_lines.append(line)
        cleaned_body = "\n".join(cleaned_lines).strip()
        
        paper = get_paper_from_subject(sec_grp, "GS-III")
        # Generates a stable UUID based on the case study subtopic name (independent of changing hierarchy)
        seed = f"CASE-STUDY:{s_topic}"
        card_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, seed))
        
        res = find_smart_match(paper, sec_grp, sec_grp, m_topic, s_topic)
        p_val = res['paper'] if res else paper
        s_val = res['subject'] if res else sec_grp
        sg_val = res['section_group'] if res else sec_grp
        mt_val = res['microtopic'] if res else m_topic
        # ALWAYS keep original subtopic from MD — never overwrite with empty
        st_val = s_topic if s_topic.strip() else (res['subtopic'] if res else "")
        
        return {
            "id": card_id,
            "paper": p_val,
            "subject": s_val,
            "section_group": sg_val,
            "microtopic": mt_val,
            "subtopic": st_val,
            "title": card_title,
            "content_markdown": cleaned_body,
            "core_values": ["case_study"],
            "hierarchy_path": build_hierarchy_path(p_val, s_val, sg_val, mt_val, st_val)
        }

    results = _parse_hierarchy_md(content, build_card)
    out_path = os.path.join(OUT_DIR, "mains_case_studies.json")
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Parsed {len(results)} Case Studies to {out_path}")


# ==============================================================================
# 9. PARSE SC JUDGMENTS
# ==============================================================================
def parse_sc_judgments():
    import uuid
    jd_dir = os.path.join(VA_DIR, "judgments")
    jd_file = os.path.join(jd_dir, "SC_Judgments.md") if os.path.exists(jd_dir) else None
    if not jd_file or not os.path.exists(jd_file):
        print("  SC Judgments file not found.")
        return
    with open(jd_file, 'r', encoding='utf-8') as f:
        content = f.read()

    results = []
    sec_grp = ""
    m_topic = ""
    s_topic = ""
    
    lines = content.split('\n')
    for line in lines:
        line_strip = line.strip()
        if not line_strip:
            continue
            
        # Parse bracket tags
        m_sec = re.match(r'^\[Section Group:\s*([^\]]+)\]', line_strip, re.IGNORECASE)
        m_micro = re.match(r'^\[Microtopic:\s*([^\]]+)\]', line_strip, re.IGNORECASE)
        m_theme = re.match(r'^\[Theme:\s*([^\]]+)\]', line_strip, re.IGNORECASE)
        
        if m_sec:
            sec_grp = m_sec.group(1).strip()
        elif m_micro:
            m_topic = m_micro.group(1).strip()
        elif m_theme:
            s_topic = m_theme.group(1).strip()
            
        # Parse table rows starting with | [number] |
        m_row = re.match(r'^\|\s*(\d+)\s*\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|', line_strip)
        if m_row:
            case_name = m_row.group(2).replace('**', '').replace('*', '').strip()
            key_issue = m_row.group(3).strip()
            ruling = m_row.group(4).strip()
            articles = m_row.group(5).strip()
            
            # Format content_markdown as a clean markdown table
            content_markdown = f"| Key Issue | Supreme Court's Ruling | Related Articles / Laws |\n| :--- | :--- | :--- |\n| {key_issue} | {ruling} | {articles} |"
            
            # Generate a stable UUID (independent of changing hierarchy)
            seed = f"SC-JUDGMENT:{case_name}"
            card_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, seed))
            
            res = find_smart_match("GS-II", "POLITY", sec_grp or "Constitutional Framework & Evolution", m_topic or "Features, amendments, significant provisions and basic structure", s_topic)
            p_val = res['paper'] if res else "GS-II"
            s_val = res['subject'] if res else "POLITY"
            sg_val = res['section_group'] if res else (sec_grp or "Constitutional Framework & Evolution")
            mt_val = res['microtopic'] if res else (m_topic or "Features, amendments, significant provisions and basic structure")
            # ALWAYS keep original subtopic from MD — never overwrite with empty
            st_val = s_topic if s_topic.strip() else (res['subtopic'] if res else "")
            
            results.append({
                "id": card_id,
                "paper": p_val,
                "subject": s_val,
                "section_group": sg_val,
                "microtopic": mt_val,
                "subtopic": st_val,
                "title": case_name,
                "content_markdown": content_markdown,
                "core_values": ["judgment"],
                "hierarchy_path": build_hierarchy_path(p_val, s_val, sg_val, mt_val, st_val)
            })

    out_path = os.path.join(OUT_DIR, "mains_sc_judgments.json")
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Parsed {len(results)} SC Judgments to {out_path}")


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
    parse_keywords()
    parse_case_studies()
    parse_sc_judgments()
    print("Value Additions Parsing Completed Successfully!")

if __name__ == "__main__":
    main()
