import os
import re
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

file_gs2 = r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\forum mgp\gs3\Forum MGP Final GS2.md"
file_gs3 = r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\forum mgp\gs3\Forum MGP Final GS3.md"
hierarchy_file = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\GS_Syllabus_Hierarchy_Merged.md"

# Rule maps for GS2
gs2_rules = [
    # POLITY - Constitutional Framework & Evolution
    (r"1935|Government of India Act|carbon copy|borrowed|genesis", "POLITY & CONSTITUTION", "Constitutional Framework & Evolution", "Indian Constitution- historical underpinnings, evolution, features, amendments, significant provisions & basic structure", "Evolution & Making"),
    (r"residuary powers|Seventh Schedule|List|distribution of powers", "POLITY & CONSTITUTION", "Union & State Structure", "Functions and responsibilities of the Union and the States, issues and challenges pertaining to the federal structure", "Union-State Financial & Administrative Relations"),
    (r"Article 21|expans|life|liberty|judiciary|transformative|basic structure|privacy|right to", "POLITY & CONSTITUTION", "Constitutional Framework & Evolution", "Indian Constitution- historical underpinnings, evolution, features, amendments, significant provisions & basic structure", "Basic Structure"),
    (r"Governor|Pardon|Article 161|Article 72|President|Discretion|ordinance", "POLITY & CONSTITUTION", "Executive, Judiciary & Representation", "Structure, organization and functioning of Executive and Judiciary", "Office of President, Governor & Executive"),
    (r"Supreme Court|Judicial|High Court|Article 142|Tribunal|Judges|Collegium|Contempt", "POLITY & CONSTITUTION", "Executive, Judiciary & Representation", "Structure, organization and functioning of Executive and Judiciary", "Judiciary & Judicial Appointments"),
    (r"Preamble|Secular|Socialist|Sovereign|Justice|Liberty|Equality|Fraternity", "POLITY & CONSTITUTION", "Constitutional Framework & Evolution", "Indian Constitution- historical underpinnings, evolution, features, amendments, significant provisions & basic structure", "Preamble & Features"),
    (r"Amendment|Article 368|Constitutional Amendment", "POLITY & CONSTITUTION", "Constitutional Framework & Evolution", "Indian Constitution- historical underpinnings, evolution, features, amendments, significant provisions & basic structure", "Amendments"),
    (r"Cooperative Federalism|Zonal Council|Inter-State|GST Council", "POLITY & CONSTITUTION", "Union & State Structure", "Functions and responsibilities of the Union and the States, issues and challenges pertaining to the federal structure", "Cooperative Federalism"),
    (r"Local|Panchayat|73rd|74th|Urban Local|PRI|Municipal", "POLITY & CONSTITUTION", "Union & State Structure", "Functions and responsibilities of the Union and the States, issues and challenges pertaining to the federal structure", "Local Governance & 73rd/74th Amendment"),
    (r"Parliament|Speaker|Privilege|Committee|Rajya Sabha|Lok Sabha|Bill|Disqualification|Anti-Defection|Tenth Schedule", "POLITY & CONSTITUTION", "Executive, Judiciary & Representation", "Parliament and State legislatures-structure, functioning, conduct of business, powers & privileges", "Parliamentary Structure & Conduct"),
    (r"Representation of People|RPA|Electoral|Election Commission|Freebies|Criminalisation", "POLITY & CONSTITUTION", "Executive, Judiciary & Representation", "Salient features of the Representation of People's Act", "Electoral Reforms & Representation of People's Act"),
    (r"CAG|CBI|CVC|NHRC|Election Commission|UPSC|Finance Commission|NITI Aayog|Law Commission|CCI", "POLITY & CONSTITUTION", "Executive, Judiciary & Representation", "Appointment to various Constitutional posts, powers, functions and responsibilities of various Constitutional Bodies", "Constitutional & Non-Constitutional Bodies"),

    # GOVERNANCE
    (r"E-Governance|Digital|ICT|Citizen|Charters|Transparency|RTI|Accountability|Good Governance|Civil Services|Bureaucracy|Lateral Entry", "GOVERNANCE", "Government Policies & Development Interventions", "Government policies and interventions for development in various sectors and issues arising out of their design and implementation", "E-Governance"),
    (r"NGO|SHG|Self Help|Civil Society|Pressure Group|Association|Donor|FCRA", "GOVERNANCE", "Development Processes & NGO Sector", "Development processes and the development industry- the role of NGOs, SHGs, various groups and associations", "NGOs, SHGs & Civil Society Groups"),

    # SOCIAL JUSTICE
    (r"Health|Hospital|Pandemic|Ayushman|Medical|National Health|Malnutrition|Disease", "SOCIAL JUSTICE", "Social Sector & Services (Health, Education, HR)", "Social Sector & Services: Issues relating to Development & Management of Health, Education & Human Resources", "Health"),
    (r"Education|NEP|School|Higher Education|University|Skill|Literacy", "SOCIAL JUSTICE", "Social Sector & Services (Health, Education, HR)", "Social Sector & Services: Issues relating to Development & Management of Health, Education & Human Resources", "Education"),
    (r"Women|Gender|Poverty|Hunger|Vulnerable|SC|ST|OBC|Disabled|PWD|Minorities|Child|Elderly", "SOCIAL JUSTICE", "Vulnerable Sections & Welfare Schemes", "Welfare schemes for vulnerable sections of the population by the Centre and States and performance of these schemes", "Welfare Schemes & Performance"),

    # INTERNATIONAL RELATIONS
    (r"China|Pakistan|Nepal|Bangladesh|Sri Lanka|Maldives|Bhutan|Myanmar|Neighbour|Neighborhood|SAGAR", "INTERNATIONAL RELATIONS", "Neighborhood & Bilateral Engagements", "Neighborhood Relations: India & its Neighborhood-Relations", "Neighbourhood"),
    (r"USA|US|Russia|Japan|Australia|QUAD|BRICS|G20|SCO|ASEAN|I2U2|Global South|West Asia|Middle East|Europe|Africa|Bilateral", "INTERNATIONAL RELATIONS", "Global Geopolitics & Indian Diaspora", "Groupings & Agreements: Bilateral, Regional & Global Groupings", "Groupings beyond South Asia"),
    (r"UN|WTO|IMF|World Bank|WHO|UNSC|Multilateral|International Court|IAEA", "INTERNATIONAL RELATIONS", "International Organizations", "International Institutions: Structure, Mandate & Functioning", "United Nations & its Agencies")
]

# Rule maps for GS3
gs3_rules = [
    # SCIENCE & TECHNOLOGY
    (r"Kasturirangan|Space|Gaganyaan|ISRO|Satellites|NASA|Artemis|Lunar|Solar|Aditya|James Webb", "SCIENCE & TECHNOLOGY", "Frontier Technologies & IPR", "Awareness in the fields of Space and Defence technologies", "Space Technology"),
    (r"Alert|Cell Broadcast|Disaster|Warning|Mass Broadcast|Smartphone|Telecom|5G|6G|Communication", "SCIENCE & TECHNOLOGY", "Everyday Science & Innovations", "Science and Technology- developments and their effects in everyday life", "General Science"),
    (r"Human spaceflight|Space exploration|Space economy|Astronaut", "SCIENCE & TECHNOLOGY", "Frontier Technologies & IPR", "Awareness in the fields of Space and Defence technologies", "Space Technology"),
    (r"Defence|DRDO|Missile|Submarine|Aircraft Carrier|Tejas|Nuclear|Indigenisation|Hypersonic", "SCIENCE & TECHNOLOGY", "Indigenous Tech & Achievements", "Achievements of Indians in S&T; Indigenisation of technology & developing new technology", "Defence Technology"),
    (r"AI|Artificial Intelligence|Robotics|Quantum|Supercomputer|Semiconductor|Nano|Biotech|CRISPR|Gene|IPR|Patent|Copyright|Trademark", "SCIENCE & TECHNOLOGY", "Frontier Technologies & IPR", "Awareness in the fields of IT, Computers, and robotics", "Artificial Intelligence"),

    # ENVIRONMENT & DISASTER MANAGEMENT
    (r"Disaster|Cyclone|Earthquake|Flood|Landslide|Cloudburst|Tsunami|Drought|Heatwave|Urban flood|Dam", "DISASTER MANAGEMENT", "Frameworks & Preparedness", "Disaster Management: Preparedness, resilience, and vulnerability frameworks", "Disaster Preparedness and Resilience"),
    (r"Climate Change|Global Warming|IPCC|UNFCCC|COP|Carbon|Net Zero|Paris Agreement|Renewable|Solar|Wind|Hydrogen|E-waste|Plastic|Pollution|Air Quality|EVs|Biodiversity|Wetland|EIA|Forest|Wildlife", "ENVIRONMENT", "Conservation & Ecosystems", "Conservation and environmental impact assessment", "Environment"),

    # AGRICULTURE
    (r"Crop|Farmer|Agriculture|MSP|Subsidy|PDS|Food Security|Irrigation|Farming|Organic|Horticulture|Millets|Fertilizer|Livestock|Land Reform|Agri-Marketing|e-NAM|FPO", "AGRICULTURE", "Agriculture & Farm Dynamics", "Major Crops, cropping patterns, and regional agriculture production styles", "Crop Diversification"),
    (r"Food processing|Supply chain|Post-harvest|Cold storage|Mega food park", "AGRICULTURE", "Food Processing Industry", "Food processing and related industries (scope, significance, location, supply chain)", "Food Processing Sector"),

    # INTERNAL SECURITY
    (r"Extremism|LWE|Naxal|Insurgency|Cyber|Crypto|Money Laundering|Terror|Border|Maritime|Coast Guard|Assam Rifles|CRPF|BSF|RAW|NIA|Internal Security|Drug", "INTERNAL SECURITY", "Extremism & External Threats", "Linkages between Development & spread of Extremism", "Left-Wing Extremism"),

    # INDIAN ECONOMY
    (r"GDP|Inflation|Fiscal|Monetary|RBI|Banking|NPL|NPA|GST|Tax|Budget|Inclusive Growth|Employment|Unemployment|Demographic|Manufacturing|SEZ|FDI|LPG|Infra|Port|Road|Rail|PPP|Investment", "INDIAN ECONOMY", "Macroeconomics & Fiscal Policy", "Indian Economy and issues relating to planning, mobilization of resources, GDP, and monetary framework", "GDP")
]

def derive_tags(q_text, default_subj="GS"):
    q_lower = q_text.lower()
    
    # Macrotag derivation
    if any(k in q_lower for k in ["analyse", "analyze", "critical", "evaluate", "assess", "examine", "implications"]):
        macro = "Analytical, Applied"
    elif any(k in q_lower for k in ["explain", "elucidate", "describe", "discuss", "detail"]):
        macro = "Descriptive, Applied"
    else:
        macro = "Conceptual, Applied"
        
    # Microtag derivation
    first_word = q_text.split()[0].replace("“", "").replace("\"", "").strip() if q_text else "Discuss"
    if first_word.lower() not in ["comment", "explain", "discuss", "critically", "elucidate", "examine", "analyze", "analyse", "evaluate"]:
        first_word = "Discuss"
    micro = f"{first_word.capitalize()}, India"
    
    return macro, micro

def process_file(filepath, paper_code, rules):
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    blocks = re.split(r'\n(?=##\s*(?:Question|mgp-))', content)
    output_blocks = []
    
    count = 0
    for b in blocks:
        if not b.strip():
            continue
            
        m_q = re.search(r'\*\*Question:\*\*\s*(.*?)(?=\n\*\*|\n##|\Z)', b, re.S)
        m_id = re.search(r'\*\*question id:\*\*\s*(.*?)(?=\n|\Z)', b, re.I)
        m_test = re.search(r'\*\*Test Number:\*\*\s*(.*?)(?=\n|\Z)', b, re.I)
        
        q_text = m_q.group(1).strip() if m_q else ""
        q_id = m_id.group(1).strip() if m_id else ""
        q_test = m_test.group(1).strip() if m_test else ""
        
        if not q_id:
            output_blocks.append(b)
            continue
            
        count += 1
        
        # Match rules
        matched_subj = "POLITY & CONSTITUTION" if paper_code == "GS2" else "INDIAN ECONOMY"
        matched_sec = "Constitutional Framework & Evolution" if paper_code == "GS2" else "Macroeconomics & Fiscal Policy"
        matched_micro = "Indian Constitution- historical underpinnings" if paper_code == "GS2" else "Indian Economy and issues relating to planning"
        matched_sub = "Evolution & Making" if paper_code == "GS2" else "GDP"
        
        for pat, subj, sec, micro_t, sub_t in rules:
            if re.search(pat, q_text, re.I):
                matched_subj = subj
                matched_sec = sec
                matched_micro = micro_t
                matched_sub = sub_t
                break
                
        macro_tag, micro_tag = derive_tags(q_text)
        
        # Reconstruct Question Block with exact schema & question id header
        lines = [
            f"## Question: {q_id}",
            f"**Question:** {q_text}",
            f"**Test Number:** {q_test}",
            f"**question id:** {q_id}",
            f"**subject:** {matched_subj}",
            f"**sectionGroup:** {matched_sec}",
            f"**microTopic:** {matched_micro}",
            f"**subTopic:** {matched_sub}",
            f"**macrotag:** {macro_tag}",
            f"**microtag:** {micro_tag}\n"
        ]
        
        # Find start of ## ANSWER
        ans_match = re.search(r'\n##\s*ANSWER', b, re.I)
        if ans_match:
            rest_content = b[ans_match.start():]
        else:
            rest_content = ""
            
        new_block = "\n".join(lines) + rest_content
        output_blocks.append(new_block)
        
    out_content = "\n".join(output_blocks)
    return out_content, count

def main():
    print("Processing Forum MGP Final GS2.md...")
    out_gs2, c2 = process_file(file_gs2, "GS2", gs2_rules)
    out_path_gs2 = r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\forum mgp\gs3\Forum MGP Final GS2 - Formatted.md"
    with open(out_path_gs2, "w", encoding="utf-8") as f:
        f.write(out_gs2)
    with open(file_gs2, "w", encoding="utf-8") as f:
        f.write(out_gs2)
    print(f"  [SUCCESS] Formatted {c2} questions in Forum MGP Final GS2.md!")

    print("\nProcessing Forum MGP Final GS3.md...")
    out_gs3, c3 = process_file(file_gs3, "GS3", gs3_rules)
    out_path_gs3 = r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\forum mgp\gs3\Forum MGP Final GS3 - Formatted.md"
    with open(out_path_gs3, "w", encoding="utf-8") as f:
        f.write(out_gs3)
    with open(file_gs3, "w", encoding="utf-8") as f:
        f.write(out_gs3)
    print(f"  [SUCCESS] Formatted {c3} questions in Forum MGP Final GS3.md!")

if __name__ == "__main__":
    main()
