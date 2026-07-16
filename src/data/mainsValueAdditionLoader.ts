import { ValueAdditionItem } from './mainsMockData';
import { normalizePaper, normalizeSubject } from './mainsConsolidatedLoader';
export { ValueAdditionItem };

const cleanHierarchyString = (str: any, defaultVal: string = ''): string => {
  if (!str) return defaultVal;
  return String(str).replace(/\*/g, '').trim();
};

const getNanotopic = (item: any): string => {
  if (!item) return '';
  if (item.nanotopic) return cleanHierarchyString(item.nanotopic);
  if (item.nanoTopic) return cleanHierarchyString(item.nanoTopic);
  if (item.nano_topic) return cleanHierarchyString(item.nano_topic);
  if (Array.isArray(item.hierarchy_path) && item.hierarchy_path.length >= 6) {
    return cleanHierarchyString(item.hierarchy_path[5]);
  }
  return '';
};

const getMicrotopic = (item: any): string => {
  if (!item) return '';
  const mt = cleanHierarchyString(item.microtopic || item.micro_topic || item.microTopic);
  if (mt) return mt;
  if (Array.isArray(item.hierarchy_path) && item.hierarchy_path.length >= 4) {
    return cleanHierarchyString(item.hierarchy_path[3]);
  }
  return '';
};

const getSubtopic = (item: any): string => {
  if (!item) return '';
  const st = cleanHierarchyString(item.subtopic || item.sub_topic || item.subTopic);
  if (st) return st;
  if (Array.isArray(item.hierarchy_path) && item.hierarchy_path.length >= 5) {
    return cleanHierarchyString(item.hierarchy_path[4]);
  }
  return '';
};



// Helper to parse framework lines like "- **Political**: ..." into frameworkBoxes structure
const parseFrameworkBoxes = (text: string): { label: string; description: string }[] => {
  if (!text) return [];
  const lines = text.split('\n');
  const boxes: { label: string; description: string }[] = [];
  for (const line of lines) {
    const m = line.trim().match(/^[-*]\s*\*\*(.*?)\*\*:\s*(.*)$/);
    if (m) {
      boxes.push({ label: m[1], description: m[2] });
    } else {
      const m2 = line.trim().match(/^[-*]\s*\*(.*?)\*:\s*(.*)$/);
      if (m2) {
        boxes.push({ label: m2[1], description: m2[2] });
      }
    }
  }
  return boxes.length > 0 ? boxes : [{ label: 'Details', description: text }];
};

// Helper to parse list items for ethics dimensions
const parseDimensions = (text: string): string[] => {
  if (!text) return [];
  return text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('[') && !line.startsWith('|'))
    .map(line => line.replace(/^[-*\d\.\s]+/, ''));
};

// Helper to pre-process markdown tables by merging multi-line rows (caused by cell newlines) into single rows
const preprocessMarkdownTable = (text: string): string => {
  if (!text) return '';
  const lines = text.split('\n');
  const processedLines: string[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('|')) {
      inTable = true;
      processedLines.push(line);
    } else if (inTable) {
      // Check if we hit a blank line followed by a heading/metadata (table finished)
      if (trimmed === '' && i + 1 < lines.length && (lines[i+1].trim().startsWith('#') || lines[i+1].trim() === '')) {
        inTable = false;
        processedLines.push(line);
      } else if (trimmed.startsWith('#') || trimmed.startsWith('---') || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        inTable = false;
        processedLines.push(line);
      } else if (trimmed !== '') {
        // Multi-line table cell contents, merge it with the last row using <br> instead of newline
        const lastIdx = processedLines.length - 1;
        if (lastIdx >= 0) {
          processedLines[lastIdx] = processedLines[lastIdx] + ' <br> ' + line;
        } else {
          processedLines.push(line);
        }
      } else {
        processedLines.push(line);
      }
    } else {
      processedLines.push(line);
    }
  }
  return processedLines.join('\n');
};

// Helper to extract the dynamic column headers from the markdown table header row
const parseComparisonHeaders = (text: string): { col1: string; col2: string; col3: string } => {
  if (!text) return { col1: 'Aspect', col2: 'Term A', col3: 'Term B' };
  const preprocessed = preprocessMarkdownTable(text);
  const lines = preprocessed.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || trimmed.includes('---') || trimmed.includes(':---')) continue;
    const parts = trimmed.split('|').map(p => p.trim().replace(/\*\*/g, '')).filter(Boolean);
    if (parts.length >= 3) {
      // The header row is the first non-separator row that starts with |
      return { col1: parts[0], col2: parts[1], col3: parts[2] };
    }
  }
  return { col1: 'Aspect', col2: 'Term A', col3: 'Term B' };
};

// Helper to extract non-table content (intro paragraph + PYQs) from comparison markdown
const parseComparisonNonTableContent = (text: string): string => {
  if (!text) return '';
  const preprocessed = preprocessMarkdownTable(text);
  const lines = preprocessed.split('\n');
  const nonTableLines: string[] = [];
  let inTable = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|')) {
      inTable = true;
      continue;
    }
    if (inTable && !trimmed.startsWith('|')) {
      inTable = false;
    }
    // Skip metadata lines like [Subject: ...]
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) continue;
    // Skip diagram image lines (already shown separately)
    if (trimmed.startsWith('![')) continue;
    // Skip section headings that are just "### Aspect Comparison Table"
    if (trimmed.toLowerCase().includes('comparison table')) continue;
    nonTableLines.push(line);
  }
  return nonTableLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

// Helper to parse Markdown comparison tables
const parseComparisonPoints = (text: string): { criteria: string; termA: string; termB: string }[] => {
  if (!text) return [];
  const preprocessed = preprocessMarkdownTable(text);
  const lines = preprocessed.split('\n');
  const points: { criteria: string; termA: string; termB: string }[] = [];
  let headerRowIndex = -1;
  let separatorRowIndex = -1;
  
  // First, identify the positions of the header and separator rows to skip them properly
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed.startsWith('|')) continue;
    if (trimmed.includes(':---') || trimmed.includes('---')) {
      separatorRowIndex = i;
      continue;
    }
    if (headerRowIndex === -1) {
      headerRowIndex = i;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (i === headerRowIndex || i === separatorRowIndex) continue;
    const trimmed = lines[i].trim();
    if (!trimmed.startsWith('|')) continue;
    
    const parts = trimmed.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length < 3) continue;
    
    points.push({
      criteria: parts[0],
      termA: parts[1],
      termB: parts[2]
    });
  }
  return points;
};

// Load JSON data
let dataFacts: any[] = [];
let introConclusions: any[] = [];
let essayValueAdd: any[] = [];
let mnemonics: any[] = [];
let frameworks: any[] = [];
let ethicsValueAdd: any[] = [];
let localKeywords: any[] = [];
let localCaseStudies: any[] = [];
let localJudgments: any[] = [];

try {
  dataFacts = require('../../mains json files/mains_data_facts.json') || [];
} catch (e) {
  console.log('[VALoader] data facts json failed to load:', e);
}

try {
  introConclusions = require('../../mains json files/mains_intro_conclusions.json') || [];
} catch (e) {
  console.log('[VALoader] intro conclusions json failed to load:', e);
}

try {
  essayValueAdd = require('../../mains json files/mains_essay_value_add.json') || [];
} catch (e) {
  console.log('[VALoader] essay value add json failed to load:', e);
}

try {
  mnemonics = require('../../mains json files/mains_mnemonics.json') || [];
} catch (e) {
  console.log('[VALoader] mnemonics json failed to load:', e);
}

try {
  frameworks = require('../../mains json files/mains_frameworks.json') || [];
} catch (e) {
  console.log('[VALoader] frameworks json failed to load:', e);
}

try {
  ethicsValueAdd = require('../../mains json files/mains_ethics_value_add.json') || [];
} catch (e) {
  console.log('[VALoader] ethics value add json failed to load:', e);
}

try {
  localKeywords = require('../../mains json files/mains_keywords.json') || [];
} catch (e) {
  console.log('[VALoader] keywords json failed to load:', e);
}

try {
  localCaseStudies = require('../../mains json files/mains_case_studies.json') || [];
} catch (e) {
  console.log('[VALoader] case studies json failed to load:', e);
}

try {
  localJudgments = require('../../mains json files/mains_sc_judgments.json') || [];
} catch (e) {
  console.log('[VALoader] sc judgments json failed to load:', e);
}


// Map real items to ValueAdditionItem interface
const mappedDataFacts: ValueAdditionItem[] = dataFacts.map((item, idx) => ({
  id: `va-df-${idx}`,
  category: 'data_facts',
  paper: normalizePaper(item.paper),
  subject: normalizeSubject(cleanHierarchyString(item.subject)),
  sectionGroup: cleanHierarchyString(item.section_group),
  microtopic: getMicrotopic(item),
  subtopic: getSubtopic(item),
  nanotopic: getNanotopic(item),
  title: `${item.parameter} - ${item.card_title}`,
  metric: item.card_title,
  context: item.content_markdown,
  source: item.source || 'Sunya IAS / Official Data',
  rawContent: item.content_markdown
}));

const mappedIntroConclusions: ValueAdditionItem[] = introConclusions.map((item, idx) => ({
  id: `va-ic-${idx}`,
  category: 'intro_conclusion',
  paper: normalizePaper(item.paper),
  subject: normalizeSubject(cleanHierarchyString(item.subject)),
  sectionGroup: cleanHierarchyString(item.section_group),
  microtopic: getMicrotopic(item),
  subtopic: getSubtopic(item),
  nanotopic: getNanotopic(item),
  title: item.card_title,
  introduction: item.body || undefined,
  conclusion: undefined,
  quoteText: undefined,
  author: undefined,
  examples: undefined,
  data_points: undefined,
  source: 'Ready-made Intro/Conclusion',
  rawContent: item.body || ''
}));

const mappedEssayValueAdd: ValueAdditionItem[] = essayValueAdd.map((item, idx) => ({
  id: `va-es-${idx}`,
  category: 'quotes',
  paper: normalizePaper(item.paper),
  subject: normalizeSubject(cleanHierarchyString(item.subject)),
  sectionGroup: cleanHierarchyString(item.section_group),
  microtopic: getMicrotopic(item),
  subtopic: getSubtopic(item),
  nanotopic: getNanotopic(item),
  title: item.title,
  quoteText: item.content,
  author: item.author || undefined,
  usageGuide: item.usage_guide || undefined,
  source: 'Essay Value Add',
  rawContent: item.content,
  entry_type: item.category === 'Connecting Words' ? 'connecting_words' : (item.entry_type || 'quote'),
}));

const mappedMnemonics: ValueAdditionItem[] = mnemonics.map((item, idx) => ({
  id: `va-mn-${idx}`,
  category: 'mnemonics',
  paper: normalizePaper(item.paper),
  subject: normalizeSubject(cleanHierarchyString(item.subject)),
  sectionGroup: cleanHierarchyString(item.section_group),
  microtopic: getMicrotopic(item),
  subtopic: getSubtopic(item),
  nanotopic: getNanotopic(item),
  title: item.mnemonic_number_title,
  mnemonicKeyword: item.mnemonic_keyword,
  mnemonicExpansion: item.formula_expansion,
  context: item.explanation_examples,
  source: 'Memory Mnemonics',
  rawContent: item.explanation_examples
}));

const mappedFrameworks: ValueAdditionItem[] = frameworks.map((item, idx) => {
  const cleanPath = (p: any) => Array.isArray(p) ? p.map(val => cleanHierarchyString(val)) : null;
  return {
    id: `va-fw-${idx}`,
    category: 'frameworks',
    title: item.framework_name,
    frameworkBoxes: parseFrameworkBoxes(item.breakdown_markdown),
    frameworkGuide: item.breakdown_markdown,
    source: 'Writing Frameworks',
    rawContent: item.breakdown_markdown,
    diagramImagePath: item.diagram_image_path,
    hierarchies: Array.isArray(item.hierarchies) ? item.hierarchies.map((h: any) => h ? {
      paper: cleanHierarchyString(h.paper),
      subject: normalizeSubject(cleanHierarchyString(h.subject)),
      sectionGroup: cleanHierarchyString(h.sectionGroup || h.section_group),
      microtopic: cleanHierarchyString(h.microtopic),
      subtopic: cleanHierarchyString(h.subtopic),
    } : h) : [],
    hierarchy_1_path: cleanPath(item.hierarchy_1_path),
    hierarchy_2_path: cleanPath(item.hierarchy_2_path),
    hierarchy_3_path: cleanPath(item.hierarchy_3_path),
    hierarchy_4_path: cleanPath(item.hierarchy_4_path),
    hierarchy_5_path: cleanPath(item.hierarchy_5_path)
  };
});

const mappedEthics: ValueAdditionItem[] = ethicsValueAdd.flatMap((item, idx) => {
  let ethicsType: any = 'keyword';
  let subject = normalizeSubject(cleanHierarchyString(item.subject, 'ETHICS, INTEGRITY & APTITUDE'));
  let title = item.title;
  let author = item.author || undefined;

  if (item.ethics_type === 'diagram') ethicsType = 'diagram';
  else if (item.ethics_type === 'dimension') ethicsType = 'dimension';
  else if (item.ethics_type === 'comparison') ethicsType = 'comparison';
  else if (item.ethics_type === 'innovation') ethicsType = 'innovation';
  else if (item.ethics_type === 'pyq_quote') ethicsType = 'pyq_quote';
  else if (item.ethics_type === 'situation') {
    ethicsType = 'situation';
  }

  if (item.ethics_type === 'situation' && item.content_markdown) {
    const lines = item.content_markdown.split('\n');
    let themeValue = '';
    let situationType = '';
    const cleanLines = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('**ID**:') || trimmed.startsWith('ID:')) {
        continue;
      }
      if (trimmed.startsWith('**Theme**:') || trimmed.startsWith('Theme:')) {
        themeValue = trimmed.replace(/^\s*\*\*Theme\*\*:\s*/i, '').replace(/^\s*Theme:\s*/i, '').trim();
      }
      if (trimmed.startsWith('**Situation Type**:') || trimmed.startsWith('Situation Type:')) {
        situationType = trimmed.replace(/^\s*\*\*Situation\s+Type\*\*:\s*/i, '').replace(/^\s*Situation\s+Type:\s*/i, '').trim();
      }
      cleanLines.push(line);
    }
    if (situationType && themeValue) {
      title = `${situationType} (${themeValue})`;
    } else if (situationType) {
      title = situationType;
    } else if (themeValue) {
      title = themeValue;
    }
    item.content_markdown = cleanLines.filter(l => !l.trim().startsWith('**ID**:') && !l.trim().startsWith('ID:')).join('\n');
  }

  if (item.ethics_type === 'pyq_quote' && item.content_markdown) {
    const lines = item.content_markdown.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('>') && (trimmed.includes('—') || trimmed.includes('-'))) {
        const match = trimmed.match(/>\s*[-—]\s*(?:\*\*Attributed to:\*\*|\*\*Author:\*\*|Attributed to:|Author:)?\s*\*\*([^*]+)\*\*\s*(?:\*\(([^)]+)\)\*|\(([^)]+)\))/i);
        if (match) {
          const authorName = match[1].trim();
          const themeDesc = (match[2] || match[3] || '').trim();
          if (themeDesc) {
            title = themeDesc;
          }
          author = authorName;
        }
      }
    }
  }

  if (item.title === 'khemka ethical rules' && item.content_markdown) {
    const parts = item.content_markdown.split(/\n---+\s*\n/);
    const rulesList: ValueAdditionItem[] = [];
    let ruleIdx = 1;
    for (const part of parts) {
      const trimmedPart = part.trim();
      if (!trimmedPart) continue;
      if (trimmedPart.startsWith('# Khemka Sir\'s') && !trimmedPart.includes('### Rule')) {
        continue;
      }
      const titleMatch = trimmedPart.match(/###\s*(Rule\s+\d+:\s*[^\n]+)/i);
      const ruleTitle = titleMatch ? titleMatch[1].trim() : `Rule ${ruleIdx}`;
      const cleanContent = trimmedPart.replace(/###\s*Rule\s+\d+:\s*[^\n]+/i, '').trim();

      rulesList.push({
        id: `va-et-${idx}-rule-${ruleIdx}`,
        category: 'ethics',
        paper: normalizePaper(item.paper),
        subject: normalizeSubject(cleanHierarchyString(item.subject, 'ETHICS, INTEGRITY & APTITUDE')),
        sectionGroup: cleanHierarchyString(item.section_group),
        microtopic: getMicrotopic(item),
        subtopic: getSubtopic(item),
        title: ruleTitle,
        ethicsType: 'keyword',
        ethicsData: {
          diagramType: ruleTitle,
          diagramDescription: cleanContent,
          dimensionsList: [],
          comparisonPoints: [],
          columnHeaders: { col1: 'Aspect', col2: 'Term A', col3: 'Term B' },
          comparisonNonTableContent: '',
          keywordDefinition: cleanContent,
          keywordExample: ''
        },
        source: 'Ethics Hub',
        rawContent: cleanContent,
        diagramImagePath: undefined
      });
      ruleIdx++;
    }
    return rulesList;
  }

  return [{
    id: `va-et-${idx}`,
    category: item.core_values === 'general_keyword' ? 'keywords_hub' : item.core_values === 'case_study' ? 'case_studies_hub' : item.core_values === 'judgment' ? 'sc_judgments_hub' : 'ethics',
    paper: normalizePaper(item.paper),
    subject: subject,
    sectionGroup: cleanHierarchyString(item.section_group),
    microtopic: getMicrotopic(item),
    subtopic: getSubtopic(item),
    title: title,
    author: author,
    ethicsType,
    core_values: item.core_values || undefined,
    ethicsData: {
      diagramType: item.title,
      diagramDescription: item.content_markdown,
      dimensionsList: parseDimensions(item.content_markdown),
      comparisonPoints: parseComparisonPoints(item.content_markdown),
      columnHeaders: parseComparisonHeaders(item.content_markdown),
      comparisonNonTableContent: parseComparisonNonTableContent(item.content_markdown),
      officerName: item.officer_name || undefined,
      initiative: item.initiative || undefined,
      impact: item.impact || undefined,
      values: item.core_values || undefined,
      keywordDefinition: item.content_markdown,
      keywordExample: item.content_markdown,
      diagramsList: item.ethicsData?.diagramsList || []
    },
    source: 'Ethics Hub',
    rawContent: item.content_markdown,
    diagramImagePath: item.diagram_image_path
  }];
});

const offlineMappedKeywords: ValueAdditionItem[] = localKeywords.map((item, idx) => ({
  id: item.id || `va-kw-${idx}`,
  category: 'keywords_hub',
  paper: normalizePaper(item.paper),
  subject: normalizeSubject(cleanHierarchyString(item.subject)),
  sectionGroup: cleanHierarchyString(item.section_group),
  microtopic: getMicrotopic(item),
  subtopic: getSubtopic(item),
  title: item.title,
  ethicsType: 'keyword' as any,
  core_values: 'general_keyword',
  ethicsData: {
    keywordDefinition: item.content_markdown,
    keywordExample: item.content_markdown,
    diagramType: item.title,
    diagramDescription: item.content_markdown,
    dimensionsList: [],
    comparisonPoints: [],
    columnHeaders: { col1: 'Aspect', col2: 'Term A', col3: 'Term B' },
    comparisonNonTableContent: '',
    diagramsList: []
  },
  source: 'Keywords Hub',
  rawContent: item.content_markdown
}));

const offlineMappedCaseStudies: ValueAdditionItem[] = localCaseStudies.map((item, idx) => ({
  id: item.id || `va-cs-${idx}`,
  category: 'case_studies_hub',
  paper: normalizePaper(item.paper),
  subject: normalizeSubject(cleanHierarchyString(item.subject)),
  sectionGroup: cleanHierarchyString(item.section_group),
  microtopic: getMicrotopic(item),
  subtopic: getSubtopic(item),
  title: item.title,
  ethicsType: 'keyword' as any,
  core_values: 'case_study',
  ethicsData: {
    keywordDefinition: item.content_markdown,
    keywordExample: item.content_markdown,
    diagramType: item.title,
    diagramDescription: item.content_markdown,
    dimensionsList: [],
    comparisonPoints: [],
    columnHeaders: { col1: 'Aspect', col2: 'Term A', col3: 'Term B' },
    comparisonNonTableContent: '',
    diagramsList: []
  },
  source: 'Case Studies Hub',
  rawContent: item.content_markdown
}));

const offlineMappedJudgments: ValueAdditionItem[] = localJudgments.map((item, idx) => ({
  id: item.id || `va-jd-${idx}`,
  category: 'sc_judgments_hub',
  paper: normalizePaper(item.paper),
  subject: normalizeSubject(cleanHierarchyString(item.subject)),
  sectionGroup: cleanHierarchyString(item.section_group),
  microtopic: getMicrotopic(item),
  subtopic: getSubtopic(item),
  title: item.title,
  ethicsType: 'keyword' as any,
  core_values: 'judgment',
  ethicsData: {
    keywordDefinition: item.content_markdown,
    keywordExample: item.content_markdown,
    diagramType: item.title,
    diagramDescription: item.content_markdown,
    dimensionsList: [],
    comparisonPoints: [],
    columnHeaders: { col1: 'Aspect', col2: 'Term A', col3: 'Term B' },
    comparisonNonTableContent: '',
    diagramsList: []
  },
  source: 'SC Judgments Hub',
  rawContent: item.content_markdown
}));

export const mainsConsolidatedValueAdd: ValueAdditionItem[] = [
  ...mappedDataFacts,
  ...mappedIntroConclusions,
  ...mappedEssayValueAdd,
  ...mappedMnemonics,
  ...mappedFrameworks,
  ...mappedEthics,
  ...offlineMappedKeywords,
  ...offlineMappedCaseStudies,
  ...offlineMappedJudgments
];

import { supabase } from '../lib/supabase';

// Helper to fetch all rows page-by-page to bypass PostgREST's 1000-row cap
async function fetchAllRows(tableName: string): Promise<{ data: any[]; error: any }> {
  let allData: any[] = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + step - 1);
    
    if (error) {
      return { data: [], error };
    }
    if (!data || data.length === 0) {
      break;
    }
    const publishedData = data.filter((row: any) => row.status === undefined || row.status === 'published');
    allData = [...allData, ...publishedData];
    if (data.length < step) {
      break;
    }
    from += step;
  }
  return { data: allData, error: null };
}

export async function fetchValueAdditionFromSupabase(): Promise<ValueAdditionItem[]> {
  const [
    dfRes,
    icRes,
    esRes,
    etRes,
    mnRes,
    fwRes,
    kwRes,
    csRes,
    jdRes
  ] = await Promise.all([
    fetchAllRows('mains_data_facts'),
    fetchAllRows('mains_intro_conclusions'),
    fetchAllRows('mains_essay_value_add'),
    fetchAllRows('mains_ethics_value_add'),
    fetchAllRows('mains_mnemonics'),
    fetchAllRows('mains_frameworks'),
    fetchAllRows('mains_keywords'),
    fetchAllRows('mains_case_studies'),
    fetchAllRows('mains_sc_judgments')
  ]);

  if (dfRes.error) throw dfRes.error;
  if (icRes.error) throw icRes.error;
  if (esRes.error) throw esRes.error;
  if (etRes.error) throw etRes.error;
  if (mnRes.error) throw mnRes.error;
  if (fwRes.error) throw fwRes.error;
  if (kwRes.error) console.warn('mains_keywords fetch error:', kwRes.error);
  if (csRes.error) console.warn('mains_case_studies fetch error:', csRes.error);
  if (jdRes.error) console.warn('mains_sc_judgments fetch error:', jdRes.error);

  const mappedDataFacts: ValueAdditionItem[] = (dfRes.data || []).map((item, idx) => ({
    id: item.id || `va-df-${idx}`,
    category: 'data_facts',
    paper: normalizePaper(item.paper),
    subject: normalizeSubject(cleanHierarchyString(item.subject)),
    sectionGroup: cleanHierarchyString(item.section_group),
    microtopic: getMicrotopic(item),
    subtopic: getSubtopic(item),
    nanotopic: getNanotopic(item),
    title: `${item.parameter} - ${item.card_title}`,
    metric: item.card_title,
    context: item.content_markdown,
    source: item.source || 'Sunya IAS / Official Data',
    rawContent: item.content_markdown
  }));

  const mappedIntroConclusions: ValueAdditionItem[] = (icRes.data || []).map((item, idx) => ({
    id: item.id || `va-ic-${idx}`,
    category: 'intro_conclusion',
    paper: normalizePaper(item.paper),
    subject: normalizeSubject(cleanHierarchyString(item.subject)),
    sectionGroup: cleanHierarchyString(item.section_group),
    microtopic: getMicrotopic(item),
    subtopic: getSubtopic(item),
    nanotopic: getNanotopic(item),
    title: item.card_title,
    introduction: item.body || undefined,
    conclusion: undefined,
    quoteText: undefined,
    author: undefined,
    examples: undefined,
    data_points: undefined,
    source: 'Ready-made Intro/Conclusion',
    rawContent: item.body || ''
  }));

  const mappedEssayValueAdd: ValueAdditionItem[] = (esRes.data || []).map((item, idx) => ({
    id: item.id || `va-es-${idx}`,
    category: 'quotes',
    paper: normalizePaper(item.paper),
    subject: normalizeSubject(cleanHierarchyString(item.subject)),
    sectionGroup: cleanHierarchyString(item.section_group),
    microtopic: getMicrotopic(item),
    subtopic: getSubtopic(item),
    nanotopic: getNanotopic(item),
    title: item.title,
    quoteText: item.content,
    author: item.author || undefined,
    usageGuide: item.usage_guide || undefined,
    source: 'Essay Value Add',
    rawContent: item.content,
    entry_type: item.category === 'Connecting Words' ? 'connecting_words' : (item.entry_type || 'quote'),
  }));

  const mappedMnemonics: ValueAdditionItem[] = (mnRes.data || []).map((item, idx) => ({
    id: item.id || `va-mn-${idx}`,
    category: 'mnemonics',
    paper: normalizePaper(item.paper),
    subject: cleanHierarchyString(item.subject),
    sectionGroup: cleanHierarchyString(item.section_group),
    microtopic: getMicrotopic(item),
    subtopic: getSubtopic(item),
    nanotopic: getNanotopic(item),
    title: item.mnemonic_number_title,
    mnemonicKeyword: item.mnemonic_keyword,
    mnemonicExpansion: item.formula_expansion,
    context: item.explanation_examples,
    source: 'Memory Mnemonics',
    rawContent: item.explanation_examples
  }));

  const mappedFrameworks: ValueAdditionItem[] = (fwRes.data || []).map((item, idx) => {
    const cleanPath = (p: any) => Array.isArray(p) ? p.map(val => cleanHierarchyString(val)) : null;
    return {
      id: item.id || `va-fw-${idx}`,
      category: 'frameworks',
      title: item.framework_name,
      frameworkBoxes: parseFrameworkBoxes(item.breakdown_markdown),
      frameworkGuide: item.breakdown_markdown,
      source: 'Writing Frameworks',
      rawContent: item.breakdown_markdown,
      diagramImagePath: item.diagram_image_path,
      hierarchies: Array.isArray(item.hierarchies) ? item.hierarchies.map((h: any) => h ? {
        paper: cleanHierarchyString(h.paper),
        subject: cleanHierarchyString(h.subject),
        sectionGroup: cleanHierarchyString(h.sectionGroup || h.section_group),
        microtopic: cleanHierarchyString(h.microtopic),
        subtopic: cleanHierarchyString(h.subtopic),
        nanotopic: cleanHierarchyString(h.nanotopic || h.nanoTopic || h.nano_topic)
      } : h) : [],
      hierarchy_1_path: cleanPath(item.hierarchy_1_path),
      hierarchy_2_path: cleanPath(item.hierarchy_2_path),
      hierarchy_3_path: cleanPath(item.hierarchy_3_path),
      hierarchy_4_path: cleanPath(item.hierarchy_4_path),
      hierarchy_5_path: cleanPath(item.hierarchy_5_path)
    };
  });

  const mappedEthics: ValueAdditionItem[] = (etRes.data || []).flatMap((item, idx) => {
    let ethicsType: any = 'keyword';
    let subject = normalizeSubject(cleanHierarchyString(item.subject, 'ETHICS, INTEGRITY & APTITUDE'));
    let title = item.title;
    let author = item.author || undefined;

    if (item.ethics_type === 'diagram') ethicsType = 'diagram';
    else if (item.ethics_type === 'dimension') ethicsType = 'dimension';
    else if (item.ethics_type === 'comparison') ethicsType = 'comparison';
    else if (item.ethics_type === 'innovation') ethicsType = 'innovation';
    else if (item.ethics_type === 'pyq_quote') ethicsType = 'pyq_quote';
    else if (item.ethics_type === 'situation') {
      ethicsType = 'situation';
    }

    if (item.ethics_type === 'situation' && item.content_markdown) {
      const lines = item.content_markdown.split('\n');
      let themeValue = '';
      let situationType = '';
      const cleanLines = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('**ID**:') || trimmed.startsWith('ID:')) {
          continue;
        }
        if (trimmed.startsWith('**Theme**:') || trimmed.startsWith('Theme:')) {
          themeValue = trimmed.replace(/^\s*\*\*Theme\*\*:\s*/i, '').replace(/^\s*Theme:\s*/i, '').trim();
        }
        if (trimmed.startsWith('**Situation Type**:') || trimmed.startsWith('Situation Type:')) {
          situationType = trimmed.replace(/^\s*\*\*Situation\s+Type\*\*:\s*/i, '').replace(/^\s*Situation\s+Type:\s*/i, '').trim();
        }
        cleanLines.push(line);
      }
      if (situationType && themeValue) {
        title = `${situationType} (${themeValue})`;
      } else if (situationType) {
        title = situationType;
      } else if (themeValue) {
        title = themeValue;
      }
      item.content_markdown = cleanLines.filter(l => !l.trim().startsWith('**ID**:') && !l.trim().startsWith('ID:')).join('\n');
    }

    if (item.ethics_type === 'pyq_quote' && item.content_markdown) {
      const lines = item.content_markdown.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('>') && (trimmed.includes('—') || trimmed.includes('-'))) {
          const match = trimmed.match(/>\s*[-—]\s*(?:\*\*Attributed to:\*\*|\*\*Author:\*\*|Attributed to:|Author:)?\s*\*\*([^*]+)\*\*\s*(?:\*\(([^)]+)\)\*|\(([^)]+)\))/i);
          if (match) {
            const authorName = match[1].trim();
            const themeDesc = (match[2] || match[3] || '').trim();
            if (themeDesc) {
              title = themeDesc;
            }
            author = authorName;
          }
        }
      }
    }

    if (item.title === 'khemka ethical rules' && item.content_markdown) {
      const parts = item.content_markdown.split(/\n---+\s*\n/);
      const rulesList: ValueAdditionItem[] = [];
      let ruleIdx = 1;
      for (const part of parts) {
        const trimmedPart = part.trim();
        if (!trimmedPart) continue;
        if (trimmedPart.startsWith('# Khemka Sir\'s') && !trimmedPart.includes('### Rule')) {
          continue;
        }
        const titleMatch = trimmedPart.match(/###\s*(Rule\s+\d+:\s*[^\n]+)/i);
        const ruleTitle = titleMatch ? titleMatch[1].trim() : `Rule ${ruleIdx}`;
        const cleanContent = trimmedPart.replace(/###\s*Rule\s+\d+:\s*[^\n]+/i, '').trim();

        rulesList.push({
          id: `${item.id || `va-et-${idx}`}-rule-${ruleIdx}`,
          category: 'ethics',
          paper: normalizePaper(item.paper),
          subject: normalizeSubject(cleanHierarchyString(item.subject, 'ETHICS, INTEGRITY & APTITUDE')),
          sectionGroup: cleanHierarchyString(item.section_group),
          microtopic: getMicrotopic(item),
          subtopic: getSubtopic(item),
          nanotopic: getNanotopic(item),
          title: ruleTitle,
          ethicsType: 'keyword',
          ethicsData: {
            diagramType: ruleTitle,
            diagramDescription: cleanContent,
            dimensionsList: [],
            comparisonPoints: [],
            columnHeaders: { col1: 'Aspect', col2: 'Term A', col3: 'Term B' },
            comparisonNonTableContent: '',
            keywordDefinition: cleanContent,
            keywordExample: ''
          },
          source: 'Ethics Hub',
          rawContent: cleanContent,
          diagramImagePath: undefined
        });
        ruleIdx++;
      }
      return rulesList;
    }

    return [{
      id: item.id || `va-et-${idx}`,
      category: item.core_values === 'general_keyword' ? 'keywords_hub' : item.core_values === 'case_study' ? 'case_studies_hub' : item.core_values === 'judgment' ? 'sc_judgments_hub' : 'ethics',
      paper: normalizePaper(item.paper),
      subject: subject,
      sectionGroup: cleanHierarchyString(item.section_group),
      microtopic: getMicrotopic(item),
      subtopic: getSubtopic(item),
      nanotopic: getNanotopic(item),
      title: title,
      author: author,
      ethicsType,
      core_values: item.core_values || undefined,
      ethicsData: {
        diagramType: item.title,
        diagramDescription: item.content_markdown,
        dimensionsList: parseDimensions(item.content_markdown),
        comparisonPoints: parseComparisonPoints(item.content_markdown),
        columnHeaders: parseComparisonHeaders(item.content_markdown),
        comparisonNonTableContent: parseComparisonNonTableContent(item.content_markdown),
        officerName: item.officer_name || undefined,
        initiative: item.initiative || undefined,
        impact: item.impact || undefined,
        values: item.core_values || undefined,
        keywordDefinition: item.content_markdown,
        keywordExample: item.content_markdown,
        diagramsList: item.ethics_data?.diagramsList || []
      },
      source: 'Ethics Hub',
      rawContent: item.content_markdown,
      diagramImagePath: item.diagram_image_path
    }];
  });

  // Map Keywords from dedicated table
  const mappedKeywords: ValueAdditionItem[] = (kwRes.data || []).map((item, idx) => ({
    id: item.id || `va-kw-${idx}`,
    category: 'keywords_hub',
    paper: normalizePaper(item.paper),
    subject: normalizeSubject(cleanHierarchyString(item.subject)),
    sectionGroup: cleanHierarchyString(item.section_group),
    microtopic: getMicrotopic(item),
    subtopic: getSubtopic(item),
    title: item.title,
    ethicsType: 'keyword' as any,
    core_values: 'general_keyword',
    ethicsData: {
      keywordDefinition: item.content_markdown,
      keywordExample: item.content_markdown,
      diagramType: item.title,
      diagramDescription: item.content_markdown,
      dimensionsList: [],
      comparisonPoints: [],
      columnHeaders: { col1: 'Aspect', col2: 'Term A', col3: 'Term B' },
      comparisonNonTableContent: '',
      diagramsList: []
    },
    source: 'Keywords Hub',
    rawContent: item.content_markdown
  }));

  // Map Case Studies from dedicated table
  const mappedCaseStudies: ValueAdditionItem[] = (csRes.data || []).map((item, idx) => ({
    id: item.id || `va-cs-${idx}`,
    category: 'case_studies_hub',
    paper: normalizePaper(item.paper),
    subject: normalizeSubject(cleanHierarchyString(item.subject)),
    sectionGroup: cleanHierarchyString(item.section_group),
    microtopic: getMicrotopic(item),
    subtopic: getSubtopic(item),
    title: item.title,
    ethicsType: 'keyword' as any,
    core_values: 'case_study',
    ethicsData: {
      keywordDefinition: item.content_markdown,
      keywordExample: item.content_markdown,
      diagramType: item.title,
      diagramDescription: item.content_markdown,
      dimensionsList: [],
      comparisonPoints: [],
      columnHeaders: { col1: 'Aspect', col2: 'Term A', col3: 'Term B' },
      comparisonNonTableContent: '',
      diagramsList: []
    },
    source: 'Case Studies Hub',
    rawContent: item.content_markdown
  }));

  // Map SC Judgments from dedicated table
  const mappedJudgments: ValueAdditionItem[] = (jdRes.data || []).map((item, idx) => ({
    id: item.id || `va-jd-${idx}`,
    category: 'sc_judgments_hub',
    paper: normalizePaper(item.paper),
    subject: normalizeSubject(cleanHierarchyString(item.subject)),
    sectionGroup: cleanHierarchyString(item.section_group),
    microtopic: getMicrotopic(item),
    subtopic: getSubtopic(item),
    title: item.title,
    ethicsType: 'keyword' as any,
    core_values: 'judgment',
    ethicsData: {
      keywordDefinition: item.content_markdown,
      keywordExample: item.content_markdown,
      diagramType: item.title,
      diagramDescription: item.content_markdown,
      dimensionsList: [],
      comparisonPoints: [],
      columnHeaders: { col1: 'Aspect', col2: 'Term A', col3: 'Term B' },
      comparisonNonTableContent: '',
      diagramsList: []
    },
    source: 'SC Judgments Hub',
    rawContent: item.content_markdown
  }));

  return [
    ...mappedDataFacts,
    ...mappedIntroConclusions,
    ...mappedEssayValueAdd,
    ...mappedMnemonics,
    ...mappedFrameworks,
    ...mappedEthics,
    ...mappedKeywords,
    ...mappedCaseStudies,
    ...mappedJudgments
  ];
}

