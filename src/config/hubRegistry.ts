export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'markdown' | 'select' | 'boolean';
  required: boolean;
  options?: string[];
}

export interface HubConfig {
  id: string;
  displayName: string;
  targetTable: string;
  uniqueKeyFn: (item: any) => string;
  aiPromptTemplate: string;
  formFields: FormField[];
}

// ────────────────────────────────────────────────────────────────────────────────
// MASTER PROMPT BUILDER
// ────────────────────────────────────────────────────────────────────────────────
const buildHubPrompt = (hubName: string, specificInstructions: string, outputSchemaExample: string): string => `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 FIRST-RESPONSE INTERACTION PROTOCOL (READ BEFORE EXECUTING):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are acting as the Official AI Ingestion & Parsing Engine for Pilot Pro 10.4: ${hubName}.

📌 STEP 1 — CHECK USER INPUT:
If the user's message contains this prompt WITHOUT raw study material / questions / notes attached:
👉 DO NOT generate sample, random, or placeholder data.
👉 REPLY IMMEDIATELY with EXACTLY:
"✅ **Pilot Pro ${hubName} Engine Ready.**

Please paste the raw questions, model answers, topper copies, or syllabus notes you would like to convert into JSON format."

👉 Then STOP and WAIT for the user to provide their content.

📌 STEP 2 — EXECUTION (WHEN CONTENT IS PROVIDED):
When raw text, notes, questions, or transcriptions are provided (in this turn or the next):
1. Parse ALL provided items into a valid JSON array adhering strictly to the schema below.
2. Maintain complete factual accuracy. Do NOT omit case studies, data points, constitutional articles, or diagrams.
3. Map every item to the official 4-layer syllabus hierarchy:
   • paper: MUST be strictly one of: 'GS1' | 'GS2' | 'GS3' | 'GS4' | 'Essay' | 'Optional'
   • subject: Standard uppercase subject name (e.g. 'GEOGRAPHY', 'POLITY', 'ETHICS', 'ANTHROPOLOGY')
   • section_group / sectionGroup: Core syllabus theme or module
   • microtopic / microTopic: Specific micro-topic
   • subtopic / subTopic: Sub-theme (Stop here for GS1-GS4)
   • nanotopic: 5th layer (ONLY for Optional subjects; leave empty "" or null for GS)
4. Escape all JSON string values properly (e.g. "\n" for newlines, '\"' for inner quotes).
5. Output ONLY a valid JSON array inside a single \`\`\`json code block. No explanations before or after.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️ HUB-SPECIFIC CONVERSION DIRECTIVES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${specificInstructions}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 MANDATORY JSON OUTPUT SCHEMA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Output a JSON array matching this structure:
${outputSchemaExample}
`;

export const hubRegistry: HubConfig[] = [
  // 1. Data & Facts
  {
    id: 'mains_data_facts',
    displayName: 'Data & Facts',
    targetTable: 'mains_data_facts',
    uniqueKeyFn: (item: any) => `${item.parameter || ''}||${item.card_title || ''}||${item.content_markdown || ''}`,
    formFields: [
      { name: 'parameter', label: 'Parameter / Headline', type: 'text', required: true },
      { name: 'card_title', label: 'Card Title / Metric', type: 'text', required: true },
      { name: 'content_markdown', label: 'Content (Markdown & HTML Hierarchy)', type: 'markdown', required: true },
      { name: 'paper', label: 'GS Paper', type: 'select', required: true, options: ['GS1', 'GS2', 'GS3', 'GS4', 'Essay', 'Optional'] },
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'section_group', label: 'Section Group', type: 'text', required: true },
      { name: 'source', label: 'Source', type: 'text', required: false }
    ],
    aiPromptTemplate: buildHubPrompt(
      'Data & Facts',
      `• Convert facts, reports, indices, and economic metrics into structured cards.
• "parameter" and "card_title" MUST have the exact same string value.
• Data & Facts hierarchy ends at Section Group (do not generate microtopic/subtopic/nanotopic).
• To preserve nested formatting in the card renderer, "content_markdown" MUST use HTML comments and '<br>' breaks:
  - Theme: '<!-- Theme: [Theme Name] --><br><b><u>[Theme Name]</u></b><br>- **[Parameter/Headline]:** [Data details]<br>'
  - Sub-Theme (8 &nbsp; spaces): '<!-- Sub-Theme: [Sub-Theme Name] --><br>• <b><u>[Sub-Theme Name]</u></b><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- **[Parameter/Headline]:** [Data details]<br>'
  - Sub-Sub-Theme (16 &nbsp; spaces): '<!-- Sub-Sub-Theme: [Name] --><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;▪ <b><u>[Name]</u></b><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- **[Parameter/Headline]:** [Data details]<br>'`,
      `[
  {
    "parameter": "Global Hunger Index 2024",
    "card_title": "Global Hunger Index 2024",
    "content_markdown": "<!-- Theme: Food Security & Nutrition --><br><b><u>Food Security & Nutrition</u></b><br>- **Global Hunger Index 2024:** India ranked 105th out of 127 countries with a score of 27.3 (Serious category).<br><!-- Sub-Theme: Key Indicators --><br>• <b><u>Key Indicators</u></b><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- **Child Wasting:** 18.7% (highest globally).<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- **Child Stunting:** 35.5%.<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- **Under-5 Mortality:** 2.9%.",
    "paper": "GS2",
    "subject": "SOCIAL JUSTICE",
    "section_group": "Issues Relating to Poverty & Hunger",
    "source": "Concern Worldwide & Welthungerhilfe"
  }
]`
    )
  },

  // 2. Intro & Conclusion
  {
    id: 'mains_intro_conclusions',
    displayName: 'Intro & Conclusion',
    targetTable: 'mains_intro_conclusions',
    uniqueKeyFn: (item: any) => `${item.card_title || ''}||${item.body || ''}`,
    formFields: [
      { name: 'card_title', label: 'Card Title / Theme', type: 'text', required: true },
      { name: 'body', label: 'Content Body (Markdown)', type: 'markdown', required: true },
      { name: 'paper', label: 'GS Paper', type: 'select', required: true, options: ['GS1', 'GS2', 'GS3', 'GS4', 'Essay', 'Optional'] },
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'section_group', label: 'Section Group', type: 'text', required: true },
      { name: 'microtopic', label: 'Microtopic', type: 'text', required: false },
      { name: 'subtopic', label: 'Subtopic', type: 'text', required: false },
      { name: 'nanotopic', label: 'Nanotopic (5th layer - Optional only)', type: 'text', required: false }
    ],
    aiPromptTemplate: buildHubPrompt(
      'Intro & Conclusion',
      `• Convert introductions, definitions, constitutional backings, and conclusion way-forwards into high-yield cards.
• Structure "body" with clear markdown headers:
  ### Introduction
  - Core definition, constitutional article, or historical context.
  ### Key Examples / Data
  - Essential committee recommendations, court verdicts, or statistics.
  ### Conclusion / Way Forward
  - Forward-looking vision, SDGs, or national policy target.
• Optional top quote: Start with blockquote: '> **"Quote text..." — Author**'`,
      `[
  {
    "card_title": "Cooperative Federalism in India",
    "body": "> **\"The Constitution of India creates not a league of states, but a union of states.\" — Dr. B.R. Ambedkar**\n\n### Introduction\nCooperative federalism envisions a collaborative relationship between Union and States (Article 1, Article 263 Inter-State Council).\n\n### Key Dimensions\n- **GST Council (Art 279A):** Institutionalized consensus-based fiscal federalism.\n- **NITI Aayog 'Team India':** Replaced top-down planning with state-driven development.\n\n### Conclusion / Way Forward\nStrengthening cooperative federalism requires revitalizing the Inter-State Council and ensuring timely devolution of 16th Finance Commission grants.",
    "paper": "GS2",
    "subject": "POLITY & GOVERNANCE",
    "section_group": "Functions & Responsibilities of the Union and States",
    "microtopic": "Federal Structure & Devolution of Powers",
    "subtopic": "Cooperative and Competitive Federalism",
    "nanotopic": ""
  }
]`
    )
  },

  // 3. Quotes & Anecdotes
  {
    id: 'mains_essay_value_add',
    displayName: 'Quotes & Anecdotes',
    targetTable: 'mains_essay_value_add',
    uniqueKeyFn: (item: any) => `${item.title || ''}||${item.content || ''}||${item.microtopic || ''}`,
    formFields: [
      { name: 'title', label: 'Author / Persona', type: 'text', required: true },
      { name: 'content', label: 'Quote / Anecdote Text', type: 'markdown', required: true },
      { name: 'author', label: 'Author Name', type: 'text', required: false },
      { name: 'usage_guide', label: 'Usage / Application Guide', type: 'text', required: false },
      { name: 'entry_type', label: 'Type (quote / anecdote)', type: 'select', required: true, options: ['quote', 'anecdote'] },
      { name: 'paper', label: 'GS Paper', type: 'select', required: true, options: ['Essay', 'GS1', 'GS2', 'GS3', 'GS4', 'Optional'] },
      { name: 'subject', label: 'Subject / Theme Group', type: 'text', required: true },
      { name: 'section_group', label: 'Section Group', type: 'text', required: true },
      { name: 'microtopic', label: 'Microtopic / Theme', type: 'text', required: false },
      { name: 'subtopic', label: 'Subtopic', type: 'text', required: false },
      { name: 'nanotopic', label: 'Nanotopic (5th layer - Optional only)', type: 'text', required: false }
    ],
    aiPromptTemplate: buildHubPrompt(
      'Quotes & Anecdotes',
      `• Convert philosophical quotes and real-world anecdotes for Essay and GS papers.
• Set "entry_type" to either "quote" or "anecdote".
• "category" field MUST be duplicate of "microtopic".
• For quotes: Put exact quote in "content" and explain where in an essay or GS answer to apply it in "usage_guide".
• For anecdotes: Write a punchy 100-150 word narrative illustrating an inspiring moral, administrative, or societal event.`,
      `[
  {
    "title": "Mahatma Gandhi",
    "content": "“The Earth provides enough to satisfy every man's needs, but not every man's greed.”",
    "author": "Mahatma Gandhi",
    "usage_guide": "Use in Essay or GS3 Environment/Economics when discussing sustainable development, climate ethics, and consumerism.",
    "entry_type": "quote",
    "paper": "Essay",
    "subject": "ESSAY & ETHICS VALUE ADD",
    "section_group": "Environment, Sustainability & Human Greed",
    "microtopic": "Environmental Ethics",
    "category": "Environmental Ethics",
    "subtopic": "Sustainable Resource Use",
    "nanotopic": ""
  }
]`
    )
  },

  // 4. Ethics: Keyword
  {
    id: 'mains_ethics_keyword',
    displayName: 'Ethics: Keyword (Definitions)',
    targetTable: 'mains_ethics_value_add',
    uniqueKeyFn: (item: any) => `${item.title || ''}||${item.content_markdown || ''}`,
    formFields: [
      { name: 'title', label: 'Term / Concept / Card Title', type: 'text', required: true },
      { name: 'content_markdown', label: 'Definition, Explanation & Examples (Markdown)', type: 'markdown', required: true },
      { name: 'paper', label: 'GS Paper', type: 'select', required: true, options: ['GS4'] },
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'section_group', label: 'Section Group', type: 'text', required: true },
      { name: 'microtopic', label: 'Microtopic', type: 'text', required: false },
      { name: 'subtopic', label: 'Subtopic', type: 'text', required: false }
    ],
    aiPromptTemplate: buildHubPrompt(
      'Ethics: Keyword Definitions',
      `• Convert GS4 ethical terms, Nolan principles, foundational values, and behavioral concepts.
• "paper" is always "GS4", "subject" is "ETHICS, INTEGRITY & APTITUDE".
• Structure "content_markdown" with:
  - **Meaning**: Concise definition.
  - **Key Attributes**: Essential components.
  - **Administrative Example**: Real-life civil service context or case law.
• "pyqs" array: Include relevant exam years (e.g. ["2023", "2019"]).`,
      `[
  {
    "title": "Probity in Governance",
    "content_markdown": "- **Meaning**: Probity is strict adherence to moral and ethical values like honesty, integrity, and uprightness in official conduct.\n- **Key Attributes**: Non-corruptibility, active transparency, and public trust preservation.\n- **Administrative Example**: A district collector recusing themselves from an infrastructure tender where a distant relative has bid, upholding complete institutional probity.",
    "paper": "GS4",
    "subject": "ETHICS, INTEGRITY & APTITUDE",
    "section_group": "Probity in Governance",
    "microtopic": "Concept of Public Service & Philosophical Basis",
    "subtopic": "Information Sharing and Transparency",
    "pyqs": ["2022", "2018"]
  }
]`
    )
  },

  // 5. Ethics: Diagram
  {
    id: 'mains_ethics_diagram',
    displayName: 'Ethics: Diagram (Presentation)',
    targetTable: 'mains_ethics_value_add',
    uniqueKeyFn: (item: any) => `${item.title || ''}||${item.content_markdown || ''}`,
    formFields: [
      { name: 'title', label: 'Diagram / Model Title', type: 'text', required: true },
      { name: 'content_markdown', label: 'Diagram Description & Explanation (Markdown)', type: 'markdown', required: true },
      { name: 'diagram_image_path', label: 'Diagram Image CDN URL', type: 'text', required: false },
      { name: 'paper', label: 'GS Paper', type: 'select', required: true, options: ['GS4'] },
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'section_group', label: 'Section Group', type: 'text', required: true },
      { name: 'microtopic', label: 'Microtopic', type: 'text', required: false },
      { name: 'subtopic', label: 'Subtopic', type: 'text', required: false }
    ],
    aiPromptTemplate: buildHubPrompt(
      'Ethics: Diagram & Models',
      `• Convert visual models, flowcharts, concentric circles, and matrices for GS4 ethics presentation.
• Structure "content_markdown" with:
  ### Visual Structure
  [Step-by-step description of how an aspirant can draw this in the exam booklet]
  ### Conceptual Explanation
  [How to substantiate this model in mains answers]`,
      `[
  {
    "title": "Concentric Circles of Moral Motivation",
    "content_markdown": "### Visual Structure\nDraw 3 concentric circles from inside out:\n1. **Inner Core**: Personal Values & Conscience.\n2. **Middle Layer**: Professional / Institutional Code of Ethics.\n3. **Outer Ring**: Legal & Constitutional Mandates.\n\n### Conceptual Explanation\nDemonstrates how internal conscience must align with external statutory regulations to prevent moral dissonance in public administration.",
    "diagram_image_path": "",
    "paper": "GS4",
    "subject": "ETHICS, INTEGRITY & APTITUDE",
    "section_group": "Human Values & Lessons from Leaders",
    "microtopic": "Role of Family, Society and Educational Institutions",
    "subtopic": "Inculcating Values",
    "pyqs": ["2021"]
  }
]`
    )
  },

  // 6. Ethics: Dimension
  {
    id: 'mains_ethics_dimension',
    displayName: 'Ethics: Dimension (Multidimensionality)',
    targetTable: 'mains_ethics_value_add',
    uniqueKeyFn: (item: any) => `${item.title || ''}||${item.content_markdown || ''}`,
    formFields: [
      { name: 'title', label: 'Dimension Card Title', type: 'text', required: true },
      { name: 'content_markdown', label: 'List of Dimensions (Markdown Bullets)', type: 'markdown', required: true },
      { name: 'paper', label: 'GS Paper', type: 'select', required: true, options: ['GS4'] },
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'section_group', label: 'Section Group', type: 'text', required: true },
      { name: 'microtopic', label: 'Microtopic', type: 'text', required: false },
      { name: 'subtopic', label: 'Subtopic', type: 'text', required: false }
    ],
    aiPromptTemplate: buildHubPrompt(
      'Ethics: Dimensions',
      `• Convert 360-degree ethical multidimensionality cards into structured format.
• Structure "content_markdown" using these exact markdown headers:
  ### PYQs
  - **[Year]** Question prompt...
  ### Quotes
  - "Quote text..." — **Author**
  ### Ethical Terms & Dimensions
  - **Term**: Definition and relevance.
  ### Civilisational Wisdom / Leaders
  - **Example**: Indian heritage or global thinker insight.
  ### Exemplary Civil Servants
  - **Officer Name**: Concrete public action.`,
      `[
  {
    "title": "Voice of Conscience & Moral Agency",
    "content_markdown": "### PYQs\n- **2020**: What does 'Voice of Conscience' mean to you in the context of official duty?\n\n### Quotes\n- \"There is a higher court than courts of justice and that is the court of conscience.\" — **Mahatma Gandhi**\n\n### Ethical Terms & Dimensions\n- **Moral Dissonance**: Conflict between personal ethics and unlawful official orders.\n- **Crisis of Conscience**: State of acute inner dilemma when duty collides with moral beliefs.\n\n### Civilisational Wisdom / Leaders\n- **Socrates**: Preferred hemlock poison over abandoning his philosophical conscience.\n\n### Exemplary Civil Servants\n- **Satyendra Dubey**: Whistleblower on highway corruption, giving his life for moral conscience.",
    "paper": "GS4",
    "subject": "ETHICS, INTEGRITY & APTITUDE",
    "section_group": "Ethics in Public Administration",
    "microtopic": "Ethical Concerns and Dilemmas in Government",
    "subtopic": "Conscience as a Source of Ethical Guidance",
    "pyqs": ["2020", "2016"]
  }
]`
    )
  },

  // 7. Ethics: Comparison
  {
    id: 'mains_ethics_comparison',
    displayName: 'Ethics: Comparison (Differences)',
    targetTable: 'mains_ethics_value_add',
    uniqueKeyFn: (item: any) => `${item.title || ''}||${item.content_markdown || ''}`,
    formFields: [
      { name: 'title', label: 'Comparison Title', type: 'text', required: true },
      { name: 'content_markdown', label: 'Comparison Table (Markdown Table)', type: 'markdown', required: true },
      { name: 'paper', label: 'GS Paper', type: 'select', required: true, options: ['GS4'] },
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'section_group', label: 'Section Group', type: 'text', required: true },
      { name: 'microtopic', label: 'Microtopic', type: 'text', required: false },
      { name: 'subtopic', label: 'Subtopic', type: 'text', required: false }
    ],
    aiPromptTemplate: buildHubPrompt(
      'Ethics: Comparisons',
      `• Convert concept vs concept differences into clean Markdown tables.
• Structure "content_markdown" with:
  Brief conceptual distinction paragraph, followed by a markdown table comparing definition, origin, scope, and examples, and concluding with indicative PYQs.`,
      `[
  {
    "title": "Attitude vs Value",
    "content_markdown": "While both attitudes and values guide human behavior, attitudes are specific evaluations of targets, whereas values are fundamental enduring principles.\n\n### Comparative Analysis\n| Parameter | Attitude | Value |\n| :--- | :--- | :--- |\n| **Nature** | Specific evaluation towards a person/object | Core enduring conviction of right vs wrong |\n| **Permanence** | Can change with new information/experience | Highly enduring, shaped early by culture/family |\n| **Scope** | Narrow (e.g. attitude towards digitization) | Broad (e.g. honesty, equality) |\n| **Example** | Positive attitude toward e-governance | Deep value of transparency |\n\n### Indicative PYQs\n- **2023**: Differentiate between Attitude and Aptitude with suitable administrative examples.",
    "paper": "GS4",
    "subject": "ETHICS, INTEGRITY & APTITUDE",
    "section_group": "Attitude: Content, Structure, Function",
    "microtopic": "Moral and Political Attitudes",
    "subtopic": "Social Influence and Persuasion",
    "pyqs": ["2023", "2016"]
  }
]`
    )
  },

  // 8. Ethics: Innovation / Case Studies
  {
    id: 'mains_ethics_innovation',
    displayName: 'Ethics: Case Study / Innovation',
    targetTable: 'mains_ethics_value_add',
    uniqueKeyFn: (item: any) => `${item.title || ''}||${item.content_markdown || ''}`,
    formFields: [
      { name: 'title', label: 'Initiative / Case Title', type: 'text', required: true },
      { name: 'officer_name', label: 'Officer Name', type: 'text', required: true },
      { name: 'initiative', label: 'Initiative Name', type: 'text', required: true },
      { name: 'impact', label: 'Impact / Result Description', type: 'text', required: true },
      { name: 'core_values', label: 'Core Values Demonstrated', type: 'text', required: true },
      { name: 'content_markdown', label: 'Detailed Case Summary (Markdown)', type: 'markdown', required: true },
      { name: 'paper', label: 'GS Paper', type: 'select', required: true, options: ['GS4'] },
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'section_group', label: 'Section Group', type: 'text', required: true },
      { name: 'microtopic', label: 'Microtopic', type: 'text', required: false },
      { name: 'subtopic', label: 'Subtopic', type: 'text', required: false }
    ],
    aiPromptTemplate: buildHubPrompt(
      'Ethics: Innovations & Case Studies',
      `• Convert real-world administrative innovations and civil servant case studies.
• "title" MUST follow the format: "[officer_name] - [initiative]".
• Extract officer_name, initiative, impact, and core_values accurately.`,
      `[
  {
    "title": "Armstrong Pame (IAS) - People's Road Project",
    "officer_name": "Armstrong Pame (IAS, Manipur)",
    "initiative": "Built 100 km 'People's Road' via community mobilization",
    "impact": "Crowdfunded ₹40 lakh with zero government funds, connecting remote Manipur villages to Assam.",
    "core_values": "Empathy, Community Participation, Dedication to Public Duty",
    "content_markdown": "**Officer**: Armstrong Pame (IAS, Manipur)\n**Initiative**: Built 100 km 'People's Road' through public participation\n**Impact**: Connected remote tribal villages to hospitals and schools\n**Core Values**: Empathy, Resourcefulness, Service orientation\n**Application**: Quote in GS4 Case Studies on administrative leadership and frugal innovation.",
    "paper": "GS4",
    "subject": "ETHICS, INTEGRITY & APTITUDE",
    "section_group": "Probity in Governance",
    "microtopic": "Citizen's Charters, Work Culture, Quality of Service Delivery",
    "subtopic": "Utilization of Public Funds & Frugal Innovation",
    "pyqs": []
  }
]`
    )
  },

  // 9. Ethics: PYQ Quote
  {
    id: 'mains_ethics_pyq_quote',
    displayName: 'Ethics: PYQ Quote',
    targetTable: 'mains_ethics_value_add',
    uniqueKeyFn: (item: any) => `${item.title || ''}||${item.content_markdown || ''}`,
    formFields: [
      { name: 'title', label: 'Quote Heading / Topic', type: 'text', required: true },
      { name: 'author', label: 'Quote Author', type: 'text', required: true },
      { name: 'content_markdown', label: 'Quote Analysis & Relevance (Markdown)', type: 'markdown', required: true },
      { name: 'paper', label: 'GS Paper', type: 'select', required: true, options: ['GS4'] },
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'section_group', label: 'Section Group', type: 'text', required: true },
      { name: 'microtopic', label: 'Microtopic', type: 'text', required: false },
      { name: 'subtopic', label: 'Subtopic', type: 'text', required: false }
    ],
    aiPromptTemplate: buildHubPrompt(
      'Ethics: PYQ Quotes',
      `• Convert past UPSC GS4 philosophical quote questions and their analytical breakdowns.
• Structure "content_markdown" with:
  ### Quote
  > "[Exact quote text]" — Author
  ### Administrative Relevance
  [Detailed explanation of how this quote applies to public service]
  ### Concrete Example
  [Practical administrative example or governance case]`,
      `[
  {
    "title": "A.P.J. Abdul Kalam on Corruption-Free Society",
    "author": "Dr. A.P.J. Abdul Kalam",
    "content_markdown": "### Quote\n> \"If a country is to be corruption free and become a nation of beautiful minds, I strongly feel there are three key societal members who can make a difference. They are father, mother and teacher.\" — Dr. A.P.J. Abdul Kalam\n\n### Administrative Relevance\nEmphasizes foundational value socialization over mere punitive legal enforcement in curbing administrative malpractices.\n\n### Concrete Example\nEarly moral education in Japanese schools emphasizing civic cleanliness and communal integrity.",
    "paper": "GS4",
    "subject": "ETHICS, INTEGRITY & APTITUDE",
    "section_group": "Human Values & Lessons from Leaders",
    "microtopic": "Role of Family, Society and Educational Institutions",
    "subtopic": "Inculcating Values",
    "pyqs": ["2022"]
  }
]`
    )
  },

  // 10. Ethics: Situation
  {
    id: 'mains_ethics_situation',
    displayName: 'Ethics: Situational Analysis',
    targetTable: 'mains_ethics_value_add',
    uniqueKeyFn: (item: any) => `${item.title || ''}||${item.content_markdown || ''}`,
    formFields: [
      { name: 'title', label: 'Situation Scenario Title', type: 'text', required: true },
      { name: 'content_markdown', label: 'Scenario Description, Stakeholders & Dilemmas (Markdown)', type: 'markdown', required: true },
      { name: 'paper', label: 'GS Paper', type: 'select', required: true, options: ['GS4'] },
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'section_group', label: 'Section Group', type: 'text', required: true },
      { name: 'microtopic', label: 'Microtopic', type: 'text', required: false },
      { name: 'subtopic', label: 'Subtopic', type: 'text', required: false }
    ],
    aiPromptTemplate: buildHubPrompt(
      'Ethics: Situations & Dilemmas',
      `• Convert GS4 case scenarios, stakeholder analyses, and conflict resolutions.
• Structure "content_markdown" with:
  ### Case Scenario
  [Brief description of facts and setting]
  ### Stakeholders Involved
  - [Primary and secondary stakeholders]
  ### Ethical Dilemmas
  - [Dilemma 1: Public duty vs Personal pressure]
  - [Dilemma 2: Procedural compliance vs Compassionate discretion]
  ### Recommended Course of Action
  [Step-by-step resolution upholding constitutional values]`,
      `[
  {
    "title": "Encroachment Clearance near Slum School during Board Exams",
    "content_markdown": "### Case Scenario\nA municipal commissioner receives a high court order to clear illegal encroachments along a drainage canal, but the drive coincides with class 10 board exams for 200 underprivileged students.\n\n### Stakeholders Involved\n- Municipal administration (duty to follow court order)\n- Slum children & families (right to education & shelter)\n- High Court (judicial mandate)\n\n### Ethical Dilemmas\n- Strict legal compliance vs Humanitarian empathy.\n\n### Recommended Course of Action\nSeek an urgent 2-week stay from the court citing child welfare, arrange temporary exam transit shelters, and execute planned resettlement immediately after exams.",
    "paper": "GS4",
    "subject": "ETHICS, INTEGRITY & APTITUDE",
    "section_group": "Ethics in Public Administration",
    "microtopic": "Ethical Concerns and Dilemmas in Government",
    "subtopic": "Laws, Rules, Regulations and Conscience",
    "pyqs": ["2023"]
  }
]`
    )
  },

  // 11. Mnemonics
  {
    id: 'mains_mnemonics',
    displayName: 'Mnemonics',
    targetTable: 'mains_mnemonics',
    uniqueKeyFn: (item: any) => `${item.mnemonic_keyword || ''}||${item.mnemonic_number_title || ''}||${item.explanation_examples || ''}`,
    formFields: [
      { name: 'mnemonic_keyword', label: 'Mnemonic Keyword (Acronym)', type: 'text', required: true },
      { name: 'mnemonic_number_title', label: 'Formula / Card Title', type: 'text', required: true },
      { name: 'formula_expansion', label: 'Formula Expansion (JSON Array)', type: 'markdown', required: true },
      { name: 'explanation_examples', label: 'Explanation & Examples', type: 'markdown', required: true },
      { name: 'paper', label: 'GS Paper', type: 'select', required: true, options: ['GS1', 'GS2', 'GS3', 'GS4', 'Essay', 'Optional'] },
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'section_group', label: 'Section Group', type: 'text', required: true },
      { name: 'microtopic', label: 'Microtopic', type: 'text', required: false },
      { name: 'subtopic', label: 'Subtopic', type: 'text', required: false },
      { name: 'nanotopic', label: 'Nanotopic (5th layer - Optional only)', type: 'text', required: false }
    ],
    aiPromptTemplate: buildHubPrompt(
      'Mnemonics',
      `• Convert answer-recall formulas, acronyms, and cognitive memory pegs.
• "mnemonic_keyword": Uppercase acronym (e.g. "PANCHAMRIT").
• "formula_expansion": JSON array of letter breakdowns: [{"letter": "P", "meaning": "...", "detail": ""}].
• "explanation_examples": Bullet points explaining each component with administrative examples.`,
      `[
  {
    "mnemonic_keyword": "PANCHAMRIT",
    "mnemonic_number_title": "India's 5 Climate Commitments (COP26)",
    "formula_expansion": [
      { "letter": "500 GW", "meaning": "Non-fossil energy capacity by 2030", "detail": "" },
      { "letter": "50%", "meaning": "Energy requirements from renewables by 2030", "detail": "" },
      { "letter": "1 Bn Ton", "meaning": "Carbon emissions reduction by 2030", "detail": "" },
      { "letter": "45%", "meaning": "Carbon intensity reduction of GDP by 2030", "detail": "" },
      { "letter": "Net Zero", "meaning": "Net Zero carbon emissions target by 2070", "detail": "" }
    ],
    "explanation_examples": "- ❖ **500 GW Non-Fossil:** Rapid solar and wind rollout via PM-KUSUM and Ultra Mega Solar Parks.\n- ❖ **50% Renewables:** Hybrid power plants and battery storage systems.\n- ❖ **1 Billion Ton Reduction:** Energy efficiency through PAT scheme and EV adoption.\n- ❖ **45% Carbon Intensity:** Decoupling economic growth from emissions.\n- ❖ **Net Zero by 2070:** Green Hydrogen Mission and nuclear expansion.",
    "paper": "GS3",
    "subject": "ENVIRONMENT & DISASTER MANAGEMENT",
    "section_group": "Conservation, Environmental Pollution & Degradation",
    "microtopic": "Climate Change & Global Agreements",
    "subtopic": "India's Nationally Determined Contributions (NDCs)",
    "nanotopic": ""
  }
]`
    )
  },

  // 12. Frameworks
  {
    id: 'mains_frameworks',
    displayName: 'Frameworks',
    targetTable: 'mains_frameworks',
    uniqueKeyFn: (item: any) => `${item.framework_name || ''}||${item.breakdown_markdown || ''}`,
    formFields: [
      { name: 'framework_name', label: 'Framework Name', type: 'text', required: true },
      { name: 'breakdown_markdown', label: 'Breakdown / Steps (Markdown)', type: 'markdown', required: true },
      { name: 'diagram_image_path', label: 'Diagram CDN URL', type: 'text', required: false }
    ],
    aiPromptTemplate: buildHubPrompt(
      'Answer Frameworks',
      `• Convert 360-degree answer-writing templates, multi-dimensional models, and matrices (e.g. PESTLE, 3R, P-P-P).
• Map up to 3 hierarchy paths using JSON arrays: ["paper", "subject", "section", "micro", "sub"].`,
      `[
  {
    "framework_name": "PESTLE Governance Analysis Framework",
    "breakdown_markdown": "## PESTLE Analysis for UPSC Mains\n\n### Framework Breakdown\n- **P → Political:** Policy stability, federal alignment, legislative support.\n- **E → Economic:** Fiscal viability, GDP impact, job creation.\n- **S → Social:** Equity, vulnerable groups, demographic dividend.\n- **T → Technological:** Digital inclusion, cybersecurity, automation.\n- **L → Legal:** Constitutional backing, court precedents, statutory safeguards.\n- **E → Environmental:** Ecological sustainability, carbon footprint, EIA compliance.",
    "diagram_image_path": "",
    "hierarchy_1_path": ["GS2", "POLITY & GOVERNANCE", "Governance & Public Policy", "Development Processes", "Policy Formulation"],
    "hierarchy_2_path": ["GS3", "INDIAN ECONOMY", "Planning & Resource Mobilization", "Growth & Development", "Inclusive Growth"],
    "hierarchy_3_path": null
  }
]`
    )
  },

  // 13. Mains Question Bank
  {
    id: 'mains_questions',
    displayName: 'Question Bank',
    targetTable: 'mains_questions',
    uniqueKeyFn: (item: any) => item.id || `${item.questionText || ''}||${item.year || ''}`,
    formFields: [
      { name: 'questionText', label: 'Question Text', type: 'markdown', required: true },
      { name: 'marks', label: 'Marks', type: 'text', required: true },
      { name: 'year', label: 'Exam Year', type: 'text', required: true },
      { name: 'paper', label: 'GS Paper', type: 'select', required: true, options: ['GS1', 'GS2', 'GS3', 'GS4', 'Essay', 'Optional'] },
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'sectionGroup', label: 'Section Group', type: 'text', required: true },
      { name: 'microTopic', label: 'Microtopic', type: 'text', required: false },
      { name: 'subTopic', label: 'Subtopic', type: 'text', required: false },
      { name: 'is_pyq', label: 'Is PYQ?', type: 'boolean', required: true },
      { name: 'nanotopic', label: 'Nanotopic (5th layer - Optional only)', type: 'text', required: false },
      { name: 'macrotag', label: 'Macro Tag (Cognitive tag)', type: 'text', required: false },
      { name: 'microtag', label: 'Micro Tag (Directives)', type: 'text', required: false }
    ],
    aiPromptTemplate: buildHubPrompt(
      'Mains Question Bank',
      `• Convert UPSC Mains questions and multi-coaching model answers into structured JSON.
• 'hierarchy_path' must be a JSON array: ["<paper>", "<subject>", "<sectionGroup>", "<microTopic>", "<subTopic>"].
• Each answer inside 'answers' MUST start with a top markdown Approach summary table:
  | **Approach:** <br>• **Introduction:** [Context/Definition] <br>• **Body:** [Main arguments & dimensions] <br>• **Conclusion:** [Way forward/SDGs] |
  | --- |
  followed by ### Introduction, ### Body / Main Arguments, and ### Conclusion headers.
• 'marks' should be a number (10, 15, or 20) and 'year' should be an integer (e.g. 2024).`,
      `[
  {
    "questionText": "Explain briefly the ecological and economic benefits of solar energy generation in India with suitable examples.",
    "marks": 10,
    "year": 2024,
    "paper": "GS1",
    "subject": "GEOGRAPHY",
    "sectionGroup": "Economic & Resource Geography",
    "microTopic": "Distribution of key Natural Resources",
    "subTopic": "Energy Resources",
    "nanotopic": "",
    "macrotag": "Analytical, Applied",
    "microtag": "Explain, India",
    "hierarchy_path": [
      "GS1",
      "GEOGRAPHY",
      "Economic & Resource Geography",
      "Distribution of key Natural Resources",
      "Energy Resources"
    ],
    "source_attribution_label": "CSE Mains 2024",
    "is_pyq": true,
    "exam_info": {
      "isPyq": true,
      "is_ncert": false,
      "exam": "Mains",
      "group": "UPSC CSE",
      "year": 2024,
      "is_upsc_cse": true,
      "stage": "mains",
      "paper": "mains_gs1"
    },
    "answers": [
      {
        "institute": "Vision IAS",
        "answerText": "| **Approach:** <br>• **Introduction:** India's renewable energy targets (500 GW by 2030, PM-Surya Ghar). <br>• **Body:** Analyze ecological benefits (emissions, water conservation) and economic benefits (job creation, import bill reduction). <br>• **Conclusion:** Pathway to Net Zero 2070 and energy sovereignty. |\n| --- |\n\n### Introduction\nIndia stands as the world's 3rd largest solar power producer, driven by initiatives like the National Solar Mission and PM-Surya Ghar Muft Bijli Yojana.\n\n### Ecological Benefits\n- **Carbon Abatement:** Every 1 GW of solar power displaces ~1.4 million tonnes of CO2 emissions annually.\n- **Water Conservation:** Requires 90% less operational water compared to conventional thermal power plants.\n- **Land Utilization:** Productive use of wastelands through floating solar plants (e.g. Ramagundam 100 MW).\n\n### Economic Benefits\n- **Forex Savings:** Curtails reliance on thermal coal and fossil fuel imports.\n- **Green Employment:** Created over 3.5 lakh decentralized jobs in installation, operations, and panel manufacturing.\n- **Rural Energy Access:** PM-KUSUM solarizing agricultural feeders and boosting farmer income.\n\n### Conclusion\nSolar energy serves as the cornerstone of India's Panchamrit climate pledge and energy security vision."
      }
    ]
  }
]`
    )
  },

  // 14. Topper Copies
  {
    id: 'topper_copies',
    displayName: 'Topper Copies',
    targetTable: 'mains_questions',
    uniqueKeyFn: (item: any) => item.id || `${item.questionText || ''}||${item.topper_name || ''}||${item.year || ''}`,
    formFields: [
      { name: 'questionText', label: 'Question Prompt', type: 'markdown', required: true },
      { name: 'topper_name', label: 'Topper Name & AIR', type: 'text', required: true },
      { name: 'air_rank', label: 'AIR Rank', type: 'text', required: true },
      { name: 'year', label: 'Exam Year', type: 'text', required: true },
      { name: 'marks', label: 'Marks', type: 'text', required: true },
      { name: 'paper', label: 'GS / Optional Paper', type: 'select', required: true, options: ['GS1', 'GS2', 'GS3', 'GS4', 'Essay', 'Optional'] },
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'sectionGroup', label: 'Section Group', type: 'text', required: true },
      { name: 'microTopic', label: 'Microtopic', type: 'text', required: false },
      { name: 'subTopic', label: 'Subtopic', type: 'text', required: false },
      { name: 'nanotopic', label: 'Nanotopic (5th layer - Optional only)', type: 'text', required: false },
      { name: 'pages', label: 'Cloudflare R2 Page URLs (Markdown images or array)', type: 'markdown', required: true }
    ],
    aiPromptTemplate: buildHubPrompt(
      'Topper Copies',
      `• Convert handwritten UPSC Topper Copies with Cloudflare R2 scan links.
• Preserve visual diagrams, maps, flowcharts, and handwriting layout as multi-page image URLs inside 'answers'.
• "source_attribution_label" must clearly mention Topper Name and AIR (e.g. "Shakti Dubey (AIR 1 - 2024)").`,
      `[
  {
    "id": "topper-gs1-geo-q1",
    "questionText": "How does the theory of plate tectonics help in explaining the differences in the formation of the Himalayas and Andes mountains?",
    "marks": 10,
    "year": 2024,
    "paper": "GS1",
    "subject": "GEOGRAPHY",
    "sectionGroup": "Physical Geography & Geophysical Phenomena",
    "microTopic": "Salient Features of World Physical Geography",
    "subTopic": "Geomorphology & Plate Tectonics",
    "nanotopic": "",
    "macrotag": "Analytical, Comparative",
    "microtag": "How does, explain differences",
    "hierarchy_path": [
      "GS1",
      "GEOGRAPHY",
      "Physical Geography & Geophysical Phenomena",
      "Salient Features of World Physical Geography",
      "Geomorphology & Plate Tectonics"
    ],
    "source_attribution_label": "Shakti Dubey (AIR 1 - 2024)",
    "is_pyq": false,
    "exam_info": {
      "isPyq": false,
      "is_ncert": false,
      "exam": "Mains",
      "group": "Topper Copies",
      "year": 2024,
      "is_upsc_cse": false,
      "stage": "mains",
      "paper": "mains_gs1",
      "is_topper_copy": true,
      "topper": "Shakti Dubey",
      "air": "1"
    },
    "answers": [
      {
        "institute": "Topper Copies",
        "topper": "Shakti Dubey",
        "air": "1",
        "is_topper": true,
        "answerText": "![](https://pub-cfb8b9095d7d4914990dbb6f73afeb92.r2.dev/topper_copies/gs1/geography/pages/p006.jpg)\n\n![](https://pub-cfb8b9095d7d4914990dbb6f73afeb92.r2.dev/topper_copies/gs1/geography/pages/p007.jpg)",
        "page_urls": [
          "https://pub-cfb8b9095d7d4914990dbb6f73afeb92.r2.dev/topper_copies/gs1/geography/pages/p006.jpg",
          "https://pub-cfb8b9095d7d4914990dbb6f73afeb92.r2.dev/topper_copies/gs1/geography/pages/p007.jpg"
        ]
      }
    ]
  }
]`
    )
  },

  // 15. Prelims PYQs / MCQs
  {
    id: 'prelims_questions',
    displayName: 'Prelims PYQs / MCQs',
    targetTable: 'questions',
    uniqueKeyFn: (item: any) => item.id || `${item.questionText || item.question_text || ''}||${item.exam_year || item.year || ''}`,
    formFields: [
      { name: 'questionText', label: 'Question Text', type: 'markdown', required: true },
      { name: 'option_a', label: 'Option A', type: 'text', required: true },
      { name: 'option_b', label: 'Option B', type: 'text', required: true },
      { name: 'option_c', label: 'Option C', type: 'text', required: true },
      { name: 'option_d', label: 'Option D', type: 'text', required: true },
      { name: 'correctAnswer', label: 'Correct Answer (a/b/c/d)', type: 'select', required: true, options: ['a', 'b', 'c', 'd'] },
      { name: 'explanationMarkdown', label: 'Detailed Explanation', type: 'markdown', required: true },
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'sectionGroup', label: 'Section Group', type: 'text', required: true },
      { name: 'microTopic', label: 'Microtopic', type: 'text', required: false },
      { name: 'year', label: 'Exam Year', type: 'text', required: true },
      { name: 'is_pyq', label: 'Is PYQ?', type: 'boolean', required: true }
    ],
    aiPromptTemplate: buildHubPrompt(
      'Prelims PYQs & MCQs',
      `• Convert 4-option UPSC Prelims MCQs and past year questions.
• "options" MUST be an object with keys "a", "b", "c", "d".
• "correctAnswer" MUST be strictly one lowercase letter: "a" | "b" | "c" | "d".
• "explanationMarkdown" MUST start with '**Exp) Option X is the correct answer.**' followed by '### Detailed Breakdown' explaining each statement/option individually.`,
      `[
  {
    "questionText": "Consider the following statements :\n1. Statement-I : The atmosphere is heated more by incoming solar radiation than by terrestrial radiation.\n2. Statement-II : Carbon dioxide and other greenhouse gases in the atmosphere are good absorbers of long wave radiation.\nWhich one of the following is correct in respect of the above statements?",
    "options": {
      "a": "Both Statement-I and Statement-II are correct and Statement-II explains Statement-I",
      "b": "Both Statement-I and Statement-II are correct, but Statement-II does not explain Statement-I",
      "c": "Statement-I is correct, but Statement-II is incorrect",
      "d": "Statement-I is incorrect, but Statement-II is correct"
    },
    "correctAnswer": "d",
    "explanationMarkdown": "**Exp) Option d is the correct answer.**\n\n### Detailed Breakdown\n- **Statement-I is incorrect:** The earth's atmosphere is primarily heated from below by long-wave terrestrial radiation emitted by the Earth, not directly by incoming short-wave solar insolation.\n- **Statement-II is correct:** Greenhouse gases (like CO2, water vapor, and methane) are transparent to incoming short-wave solar radiation but absorb outgoing long-wave infrared terrestrial radiation, causing the greenhouse effect.",
    "subject": "GEOGRAPHY",
    "sectionGroup": "Physical Geography - Climatology",
    "microTopic": "Solar Radiation, Heat Balance & Temperature",
    "year": 2024,
    "is_pyq": true,
    "source_attribution_label": "CSE Prelims 2024",
    "exam_info": {
      "isPyq": true,
      "is_ncert": false,
      "exam": "Prelims",
      "group": "UPSC CSE",
      "year": 2024,
      "is_upsc_cse": true,
      "stage": "prelims",
      "paper": "pre_gs1"
    }
  }
]`
    )
  }
];
