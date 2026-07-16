export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'markdown' | 'select' | 'boolean';
  required: boolean;
  options?: string[]; // For 'select' type
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
// CRITICAL HIERARCHY RULE (prepended to every prompt):
// You MUST take the exact values for paper, subject, section_group, microtopic,
// subtopic, and optional nanotopic (5th layer if present in hierarchy file)
// STRICTLY from the uploaded UPSC/Optional syllabus hierarchy file.
// Do NOT deviate from the hierarchy file by even a single word or spelling.
// If you are unsure of the exact hierarchy path, leave the optional fields blank
// rather than guessing.
//
// AI BEHAVIOUR INSTRUCTION:
// When this prompt is shared with you, do NOT generate JSON immediately.
// Reply with: "Understood. Please provide the notes or content you want me
// convert into JSON." — then wait for the user's input before generating.
// ────────────────────────────────────────────────────────────────────────────────

const HIERARCHY_RULE = `
⚠️ CRITICAL INPUT INSTRUCTION & HIERARCHY RULE:
You will be provided with two separate inputs:
1. The Syllabus Hierarchy Reference wrapped in <SYLLABUS_HIERARCHY>...</SYLLABUS_HIERARCHY> tags.
2. The Notes/Content to convert wrapped in <NOTES_CONTENT>...</NOTES_CONTENT> tags.

Your task is to convert the notes in <NOTES_CONTENT> into cards, mapping each card's hierarchy fields STRICTLY to their exact counterparts defined in <SYLLABUS_HIERARCHY>.
- Do NOT deviate from the hierarchy reference by even a single letter or word.
- For optional subjects (like Anthropology):
  * "paper" MUST be exactly "Optional" (Do NOT output "Paper I" or "Paper II" in the "paper" field, as the app only accepts select values: 'GS1', 'GS2', 'GS3', 'GS4', 'Essay', 'Optional').
  * "section_group" MUST contain the paper identifier, e.g. "Paper I" or "Paper II".
  * "microtopic" contains the unit name (e.g. "Unit 6 - Anthropological Theories").
  * "subtopic" contains the numbered subtopic (e.g. "6(a) Classical evolutionism" or "12.1 Core Applications").
  * "nanotopic" contains the specific bullet theme (e.g. "Tylor" or "Anthropology of sports").

⚠️ DYNAMIC HIERARCHY DEPTH RULES:
- Never generate hierarchy fields that do not exist or are not supported by the specific Content Hub's JSON schema structure.
- If a Content Hub's schema only goes up to Section Group (e.g., Data & Facts), do NOT generate "microtopic", "subtopic", or "nanotopic" fields at all (for both GS and Optional subjects).
- If a Content Hub's schema naturally extends to Sub Topic:
  * For GS content (GS1/GS2/GS3/GS4/Essay) -> Stop at "subtopic". Do NOT generate "nanotopic".
  * For Optional content -> Generate the 5th layer "nanotopic" as well, since Optional taxonomy extends one level deeper.
- If unsure or if a level is missing in <SYLLABUS_HIERARCHY>, leave that field blank rather than guessing.

📌 FIRST-RESPONSE INSTRUCTION (DO NOT GENERATE JSON YET):
When you receive this system prompt, reply with EXACTLY this text to guide the user:
"Understood. Please provide the inputs in the following format so I can map them accurately:

<SYLLABUS_HIERARCHY>
[Paste your syllabus hierarchy file here]
</SYLLABUS_HIERARCHY>

<NOTES_CONTENT>
[Paste your notes or content to convert here]
</NOTES_CONTENT>"

Wait for the user to provide the inputs in that format before generating the JSON array.`;

export const hubRegistry: HubConfig[] = [
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
    aiPromptTemplate: `You are an expert UPSC Mains content creator.
${HIERARCHY_RULE}

Generate a JSON array of value additions for "Data & Facts".
⚠️ Data & Facts hierarchy ends at Section Group. Do NOT generate microtopic, subtopic, or nanotopic.
⚠️ The "parameter" and "card_title" fields MUST have the exact same string value (representing the core theme/metric name of the card).

To preserve the bullet and theme hierarchy in the card renderer, you MUST construct "content_markdown" using the following strict HTML comment structures and indents:
1. **Newlines**: Use '<br>' instead of standard newlines '\\n' to separate lines inside the string.
2. **Themes**: Every card starts with:
   '<!-- Theme: [Theme Name] --><br><b><u>[Theme Name]</u></b><br>- **[Parameter/Headline]:** [Data details]<br>'
3. **Sub-Themes** (Organize sub-concepts under the main theme using exactly 8 non-breaking spaces '&nbsp;' for indents):
   '<!-- Sub-Theme: [Sub-Theme Name] --><br>• <b><u>[Sub-Theme Name]</u></b><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- **[Parameter/Headline]:** [Data details]<br>'
4. **Sub-Sub-Themes** (Nested concepts, only if necessary, using exactly 8 '&nbsp;' for the header and 16 '&nbsp;' for bullets):
   '<!-- Sub-Sub-Theme: [Sub-Sub-Theme Name] --><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;▪ <b><u>[Sub-Sub-Theme Name]</u></b><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- **[Parameter/Headline]:** [Data details]<br>'

Output JSON schema:
{
  "parameter": "Identical value to card_title (e.g. Climate Risk Index 2025)",
  "card_title": "Identical value to parameter (e.g. Climate Risk Index 2025)",
  "content_markdown": "[Strict HTML & Bullet hierarchy string containing <br> and &nbsp; indents]",
  "paper": "Exact paper from syllabus hierarchy",
  "subject": "Exact subject from syllabus hierarchy",
  "section_group": "Exact section_group from syllabus hierarchy",
  "source": "Source citation (optional)"
}`
  },
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
    aiPromptTemplate: `You are an expert UPSC Mains content creator.
${HIERARCHY_RULE}

Generate a JSON array of Introductions & Conclusions.
⚠️ Hierarchy Depth Rules:
- GS (GS1/GS2/GS3/GS4/Essay) -> Stop at "subtopic". Do NOT generate "nanotopic".
- Optional -> Generate "nanotopic" as well (5th layer).

To preserve layout parsing, you must structure the "body" string exactly using one of the following methods:
Method A (Markdown Headings):
"### Introduction\\n- Bullet points...\\n### Key Examples\\n- Bullet points...\\n### Conclusion / Way Forward\\n- Bullet points..."

Quotes (Optional at top of card):
Start the block with a quote using blockquote syntax:
'> **"Quote text..." – Author**'

Output JSON schema:
{
  "card_title": "Short title describing the topic",
  "body": "[Markdown content formatted with clear headings and blockquotes if a quote exists]",
  "paper": "Exact value from syllabus hierarchy",
  "subject": "Exact subject from syllabus hierarchy",
  "section_group": "Exact section_group from syllabus hierarchy",
  "microtopic": "Exact microtopic from syllabus hierarchy (optional)",
  "subtopic": "Exact subtopic from syllabus hierarchy (optional)",
  "nanotopic": "Exact nanotopic / 5th layer from syllabus hierarchy if present (ONLY for Optional papers; leave blank or omit for GS)"
}`
  },
  {
    id: 'mains_essay_value_add',
    displayName: 'Quotes & Anecdotes',
    targetTable: 'mains_essay_value_add',
    uniqueKeyFn: (item: any) => `${item.title || ''}||${item.content || ''}||${item.microtopic || ''}`,
    formFields: [
      { name: 'title', label: 'Author / Persona', type: 'text', required: true },
      { name: 'content', label: 'Quote / Anecdote Text', type: 'markdown', required: true },
      { name: 'author', label: 'Author Name (if different)', type: 'text', required: false },
      { name: 'usage_guide', label: 'Usage / Application Guide', type: 'text', required: false },
      { name: 'entry_type', label: 'Type', type: 'select', required: true, options: ['quote', 'anecdote'] },
      { name: 'paper', label: 'GS Paper', type: 'select', required: true, options: ['Essay', 'GS1', 'GS2', 'GS3', 'GS4', 'Optional'] },
      { name: 'subject', label: 'Subject / Theme Group', type: 'text', required: true },
      { name: 'section_group', label: 'Section Group', type: 'text', required: true },
      { name: 'microtopic', label: 'Microtopic / Theme', type: 'text', required: false },
      { name: 'subtopic', label: 'Subtopic', type: 'text', required: false },
      { name: 'nanotopic', label: 'Nanotopic (5th layer - Optional only)', type: 'text', required: false }
    ],
    aiPromptTemplate: `You are an expert content creator for the UPSC Essay and General Studies.
${HIERARCHY_RULE}

Generate a JSON array of Quotes & Anecdotes.
⚠️ Hierarchy Depth Rules:
- GS -> Stop at "subtopic". Do NOT generate "nanotopic".
- Optional -> Generate "nanotopic" as well (5th layer).
⚠️ The "category" field is a duplicate of "microtopic" and MUST be set to the exact same value.

Strictly distinguish between the two types:
1. **Quote**:
   - "entry_type": "quote"
   - "content": Must contain the quote wrapped in smart quotes “...”
   - "author" / "title": The name of the philosopher/author.
2. **Anecdote**:
   - "entry_type": "anecdote"
   - "content": A short story narrative (100–150 words).
   - "title": The name of the main subject/person of the anecdote.

Output JSON schema:
{
  "title": "Author/Persona name",
  "content": "Quote text or Anecdote narrative",
  "author": "Author name",
  "usage_guide": "Instructions on where to apply",
  "entry_type": "quote or anecdote",
  "paper": "Exact value from syllabus hierarchy",
  "subject": "Exact subject from syllabus hierarchy",
  "section_group": "Exact section_group from syllabus hierarchy",
  "microtopic": "Exact microtopic from syllabus hierarchy (optional)",
  "category": "Exact same value as microtopic (e.g. The Evolving Self)",
  "subtopic": "Exact subtopic from syllabus hierarchy (optional)",
  "nanotopic": "Exact nanotopic / 5th layer from syllabus hierarchy if present (ONLY for Optional papers; leave blank or omit for GS)"
}`
  },
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
    aiPromptTemplate: `You are an expert UPSC GS4 Ethics content creator.
${HIERARCHY_RULE}

Generate a JSON array of Ethics Keyword Definitions.
⚠️ GS4 Ethics hierarchy stops at Subtopic. Do NOT generate nanotopic.

Each object must fit the following schema:
{
  "title": "Exact Term/Concept Name (e.g. Integrity, Objectivity, Empathy, Moral Compass)",
  "content_markdown": "- **Meaning**: [Short clear definition of the keyword]\\n- **Example**: [A concrete administrative example or case illustrating this value]",
  "paper": "GS4",
  "subject": "ETHICS, INTEGRITY & APTITUDE",
  "section_group": "Exact section_group from syllabus hierarchy",
  "microtopic": "Exact microtopic from syllabus hierarchy (optional)",
  "subtopic": "Exact subtopic from syllabus hierarchy (optional)",
  "pyqs": []
}`
  },
  {
    id: 'mains_ethics_diagram',
    displayName: 'Ethics: Diagram (Presentation)',
    targetTable: 'mains_ethics_value_add',
    uniqueKeyFn: (item: any) => `${item.title || ''}||${item.content_markdown || ''}`,
    formFields: [
      { name: 'title', label: 'Diagram / Model Title', type: 'text', required: true },
      { name: 'content_markdown', label: 'Diagram Description & Explanation (Markdown)', type: 'markdown', required: true },
      { name: 'diagram_image_path', label: 'Diagram Image CDN URL (if uploaded)', type: 'text', required: false },
      { name: 'paper', label: 'GS Paper', type: 'select', required: true, options: ['GS4'] },
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'section_group', label: 'Section Group', type: 'text', required: true },
      { name: 'microtopic', label: 'Microtopic', type: 'text', required: false },
      { name: 'subtopic', label: 'Subtopic', type: 'text', required: false }
    ],
    aiPromptTemplate: `You are an expert UPSC GS4 Ethics content creator.
${HIERARCHY_RULE}

Generate a JSON array of Ethics Diagrams/Presentation Models.
⚠️ GS4 Ethics hierarchy stops at Subtopic. Do NOT generate nanotopic.

Each object must fit the following schema:
{
  "title": "Title of the Diagram/Model (e.g. Concentric Circles of Values)",
  "content_markdown": "### Visual Structure\\n[Describe how to draw it]\\n### Explanation\\n[How to explain the diagram in a mains answer]",
  "diagram_image_path": "CDN URL if you have one, otherwise leave blank or null",
  "paper": "GS4",
  "subject": "ETHICS, INTEGRITY & APTITUDE",
  "section_group": "Exact section_group from syllabus hierarchy",
  "microtopic": "Exact microtopic from syllabus hierarchy (optional)",
  "subtopic": "Exact subtopic from syllabus hierarchy (optional)",
  "pyqs": []
}`
  },
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
    aiPromptTemplate: `You are an expert UPSC GS4 Ethics content creator.
${HIERARCHY_RULE}

Generate a JSON array of Ethics Dimension cards.
⚠️ GS4 Ethics hierarchy stops at Subtopic. Do NOT generate nanotopic.
⚠️ The top-level "pyqs" field must be an array of strings representing the years of the PYQs listed.

Structure "content_markdown" using these exact markdown headers:
### PYQs
- **[Year]** Question text...
### Quotes
- "Quote text..." - **Author**
### Ethical Terms
- **Term name**: definition and significance
### Indian Civilisational Wisdom
- **Example**: short narrative showing moral conscience
### Examples
- **Nelson Mandela**: short descriptive example
### Civil Servants
- **Satyendra Dubey**: brief detail of how this officer showed this value

Each object must fit the following schema:
{
  "title": "Title of the Dimension Card (e.g. Conscience)",
  "content_markdown": "[Rich Markdown content containing all headings listed above]",
  "paper": "GS4",
  "subject": "ETHICS, INTEGRITY & APTITUDE",
  "section_group": "Exact section_group from syllabus hierarchy",
  "microtopic": "Exact microtopic from syllabus hierarchy (optional)",
  "subtopic": "Exact subtopic from syllabus hierarchy (optional)",
  "pyqs": ["2020", "2016"]
}`
  },
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
    aiPromptTemplate: `You are an expert UPSC GS4 Ethics content creator.
${HIERARCHY_RULE}

Generate a JSON array of Ethics Comparison tables.
⚠️ GS4 Ethics hierarchy stops at Subtopic. Do NOT generate nanotopic.
⚠️ The top-level "pyqs" field must be an array of strings containing the years of the PYQs listed.

Each object must fit the following schema:
{
  "title": "Comparison Title (e.g. Attitude vs Value)",
  "content_markdown": "[Brief intro paragraph explaining the main difference]\\n\\n### Aspect Comparison Table\\n\\n| Aspect | Term A | Term B |\\n| :--- | :--- | :--- |\\n| **Definition** | Detail A | Detail B |\\n| **Origin** | Detail A | Detail B |\\n| **Examples** | Detail A | Detail B |\\n\\n### PYQs\\n- **[Year]** Distinguish between...",
  "paper": "GS4",
  "subject": "ETHICS, INTEGRITY & APTITUDE",
  "section_group": "Exact section_group from syllabus hierarchy",
  "microtopic": "Exact microtopic from syllabus hierarchy (optional)",
  "subtopic": "Exact subtopic from syllabus hierarchy (optional)",
  "pyqs": ["2023", "2016"]
}`
  },
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
    aiPromptTemplate: `You are an expert UPSC GS4 Ethics content creator.
${HIERARCHY_RULE}

Generate a JSON array of Ethics Innovations/Officer Case Studies.
⚠️ GS4 Ethics hierarchy stops at Subtopic. Do NOT generate nanotopic.
⚠️ The "title" field must ALWAYS follow the exact format: "[officer_name] - [initiative]".
⚠️ The top-level "pyqs" field must be an array of strings representing the years of the PYQs listed.

Each object must fit the following schema:
{
  "title": "Armstrong Pame (IAS, Manipur) - Built 'People's Road'",
  "officer_name": "Armstrong Pame (IAS, Manipur)",
  "initiative": "Built 'People's Road'-100 km road in Manipur",
  "impact": "Online crowdfunding (₹40 lakh donations) within 7 months, connecting Manipur to Assam",
  "core_values": "Community Ownership, Integrity, Dedication to Duty",
  "content_markdown": "**Officer**: Armstrong Pame (IAS, Manipur)\\n**Initiative**: Built 'People's Road'-100 km road in Manipur\\n**Impact**: Online crowdfunding (₹40 lakh donations) within 7 months, connecting Manipur to Assam\\n**Values**: Community Ownership, Integrity, Dedication to Duty\\n**Indicative PYQs**: None",
  "paper": "GS4",
  "subject": "ETHICS, INTEGRITY & APTITUDE",
  "section_group": "Exact section_group from syllabus hierarchy",
  "microtopic": "Exact microtopic from syllabus hierarchy (optional)",
  "subtopic": "Exact subtopic from syllabus hierarchy (optional)",
  "pyqs": []
}`
  },
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
    aiPromptTemplate: `You are an expert UPSC GS4 Ethics content creator.
${HIERARCHY_RULE}

Generate a JSON array of Ethics PYQ Quote explanations.
⚠️ GS4 Ethics hierarchy stops at Subtopic. Do NOT generate nanotopic.
⚠️ The top-level "pyqs" field must be an array of strings representing the years of the PYQs listed.

Each object must fit the following schema:
{
  "title": "Short descriptive quote context (e.g. Swami Vivekananda on Selfless Service)",
  "author": "Swami Vivekananda",
  "content_markdown": "### Quote\\n> \\"[Exact quote text]\\" — Swami Vivekananda\\n### Administrative Relevance\\n[Explain how this quote applies to public service]\\n### Practical Example\\n[A short administrative example illustrating the concept]",
  "paper": "GS4",
  "subject": "ETHICS, INTEGRITY & APTITUDE",
  "section_group": "Exact section_group from syllabus hierarchy",
  "microtopic": "Exact microtopic from syllabus hierarchy (optional)",
  "subtopic": "Exact subtopic from syllabus hierarchy (optional)",
  "pyqs": ["2018"]
}`
  },
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
    aiPromptTemplate: `You are an expert UPSC GS4 Ethics content creator.
${HIERARCHY_RULE}

Generate a JSON array of Ethics Situation scenario analyses.
⚠️ GS4 Ethics hierarchy stops at Subtopic. Do NOT generate nanotopic.
⚠️ The top-level "pyqs" field must be an array of strings representing the years of the PYQs listed.

Each object must fit the following schema:
{
  "title": "Short scenario title (e.g. Whistleblowing in Drug Trial)",
  "content_markdown": "### Case Scenario\\n[Describe the situation and facts]\\n### Stakeholders involved\\n- [List stakeholders]\\n### Ethical Dilemmas\\n- [Dilemma A vs Dilemma B]\\n### Options Available & Course of Action\\n[Outline options and the best way forward]",
  "paper": "GS4",
  "subject": "ETHICS, INTEGRITY & APTITUDE",
  "section_group": "Exact section_group from syllabus hierarchy",
  "microtopic": "Exact microtopic from syllabus hierarchy (optional)",
  "subtopic": "Exact subtopic from syllabus hierarchy (optional)",
  "core_values": "Human dignity & duty to protect override the private matter framing.",
  "pyqs": ["2016"]
}`
  },
  {
    id: 'mains_mnemonics',
    displayName: 'Mnemonics',
    targetTable: 'mains_mnemonics',
    uniqueKeyFn: (item: any) => `${item.mnemonic_keyword || ''}||${item.mnemonic_number_title || ''}||${item.explanation_examples || ''}`,
    formFields: [
      { name: 'mnemonic_keyword', label: 'Mnemonic Keyword', type: 'text', required: true },
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
    aiPromptTemplate: `You are an expert UPSC Mains content creator.
${HIERARCHY_RULE}

Generate a JSON array of Mnemonics.
⚠️ Hierarchy Depth Rules:
- GS -> Stop at "subtopic". Do NOT generate "nanotopic".
- Optional -> Generate "nanotopic" as well (5th layer).

Each object must fit the following schema:
{
  "mnemonic_keyword": "Acronym in uppercase (e.g. SMART)",
  "mnemonic_number_title": "Descriptive title of the mnemonic",
  "formula_expansion": [
    { "letter": "S", "meaning": "Specific", "detail": "" },
    { "letter": "M", "meaning": "Measurable", "detail": "" }
  ],
  "explanation_examples": "- ❖ **S - Specific**\\n    - • **Explanation:** Detailed definition...\\n    - • **Example:** Administration case...\\n- ❖ **M - Measurable**\\n    - • **Explanation:** Detailed definition...\\n    - • **Example:** Case study...",
  "paper": "Exact value from syllabus hierarchy",
  "subject": "Exact subject from syllabus hierarchy",
  "section_group": "Exact section_group from syllabus hierarchy",
  "microtopic": "Exact microtopic from syllabus hierarchy (optional)",
  "subtopic": "Exact subtopic from syllabus hierarchy (optional)",
  "nanotopic": "Exact nanotopic / 5th layer from syllabus hierarchy if present (ONLY for Optional papers; leave blank or omit for GS)"
}`
  },
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
    aiPromptTemplate: `You are an expert UPSC Mains content creator.
${HIERARCHY_RULE}

Generate a JSON array of Answer Writing Frameworks.
⚠️ Map up to three valid hierarchy paths matching the uploaded syllabus hierarchy reference.

Each object must fit the following schema:
{
  "framework_name": "Name of the framework (e.g. WOMENIST Framework)",
  "breakdown_markdown": "## [Framework Name]: [Short description]\\n\\n### Diagram: [Framework Name]\\n![[Framework Name]]([diagram_image_path])\\n\\n### Framework Breakdown\\n- **W → Workforce Participation**:\\n  - IT/BPO/gig work\\n  - Remote jobs",
  "diagram_image_path": "Cloudflare CDN image URL if a diagram exists (optional)",
  "hierarchy_1_path": ["GS1", "SOCIETY", "Social Dynamics", "Effects of globalization", "Globalisation"],
  "hierarchy_2_path": ["GS1", "SOCIETY", "Gender & Demographics", "Role of women", "Women concerns"],
  "hierarchy_3_path": null
}`
  },
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
      { name: 'nanotopic', label: 'Nanotopic (5th layer - Optional only)', type: 'text', required: false }
    ],
    aiPromptTemplate: `You are an expert UPSC Mains Question Bank creator.
${HIERARCHY_RULE}

Generate a JSON object representing a UPSC Mains Question and its coaching answers.
⚠️ Hierarchy Depth Rules:
- GS (GS1/GS2/GS3/GS4/Essay) -> Stop at "subTopic". Do NOT generate "nanotopic".
- Optional -> Generate "nanotopic" as well (5th layer).

The JSON object must match this schema:
{
  "questionText": "Full text of the question",
  "marks": 10,
  "year": 2024,
  "paper": "Exact value from syllabus hierarchy (GS1/GS2/GS3/GS4/Essay/Optional)",
  "subject": "Exact subject from syllabus hierarchy",
  "sectionGroup": "Exact section group from syllabus hierarchy",
  "microTopic": "Exact microtopic from syllabus hierarchy (optional)",
  "subTopic": "Exact subtopic from syllabus hierarchy (optional)",
  "is_pyq": true,
  "nanotopic": "Exact nanotopic / 5th layer from syllabus hierarchy if present (ONLY for Optional papers; leave blank or omit for GS)",
  "answers": [
    {
      "institute": "Vision IAS or Sunya IAS or PWOnlyIAS or Superkalam",
      "answerText": "### Introduction\\n[Intro text in bullets]\\n\\n### Body\\n[Key points with bold sub-headers]\\n\\n### Conclusion\\n[Concluding bullets]"
    }
  ]
}`
  }
];

