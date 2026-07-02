import { ValueAdditionItem } from './mainsMockData';
import { normalizePaper } from './mainsConsolidatedLoader';
export { ValueAdditionItem };



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

// Helper to parse Markdown comparison tables
const parseComparisonPoints = (text: string): { criteria: string; termA: string; termB: string }[] => {
  if (!text) return [];
  const lines = text.split('\n');
  const points: { criteria: string; termA: string; termB: string }[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || trimmed.includes('---') || trimmed.toLowerCase().includes('criteria') || trimmed.toLowerCase().includes('basis') || trimmed.toLowerCase().includes('aspect')) {
      continue;
    }
    const parts = trimmed.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      points.push({
        criteria: parts[0],
        termA: parts[1],
        termB: parts[2]
      });
    }
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

// Map real items to ValueAdditionItem interface
const mappedDataFacts: ValueAdditionItem[] = dataFacts.map((item, idx) => ({
  id: `va-df-${idx}`,
  category: 'data_facts',
  paper: normalizePaper(item.paper),
  subject: item.subject,
  sectionGroup: item.section_group,
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
  subject: item.subject,
  sectionGroup: item.section_group,
  microtopic: item.microtopic,
  subtopic: item.subtopic,
  title: item.card_title,
  introduction: item.introduction || undefined,
  conclusion: item.conclusion || undefined,
  quoteText: item.quote_text || undefined,
  author: item.quote_author || undefined,
  examples: item.examples || undefined,
  source: 'Ready-made Intro/Conclusion',
  rawContent: [item.quote_text || '', item.introduction || '', item.examples || '', item.conclusion || ''].filter(Boolean).join('\n\n')
}));

const mappedEssayValueAdd: ValueAdditionItem[] = essayValueAdd.map((item, idx) => ({
  id: `va-es-${idx}`,
  category: 'quotes',
  paper: normalizePaper(item.paper),
  subject: item.subject,
  sectionGroup: item.section_group,
  microtopic: item.microtopic,
  title: item.title,
  quoteText: item.content,
  author: item.category || 'Essay Theme',
  usageGuide: `Category: ${item.category}`,
  source: 'Essay Value Add',
  rawContent: item.content
}));

const mappedMnemonics: ValueAdditionItem[] = mnemonics.map((item, idx) => ({
  id: `va-mn-${idx}`,
  category: 'mnemonics',
  paper: normalizePaper(item.paper),
  subject: item.subject,
  sectionGroup: item.section_group,
  microtopic: item.microtopic,
  subtopic: item.subtopic,
  title: item.mnemonic_number_title,
  mnemonicKeyword: item.mnemonic_keyword,
  mnemonicExpansion: item.formula_expansion,
  context: item.explanation_examples,
  source: 'Memory Mnemonics',
  rawContent: item.explanation_examples
}));

const mappedFrameworks: ValueAdditionItem[] = frameworks.map((item, idx) => ({
  id: `va-fw-${idx}`,
  category: 'frameworks',
  title: item.framework_name,
  frameworkBoxes: parseFrameworkBoxes(item.breakdown_markdown),
  frameworkGuide: item.breakdown_markdown,
  source: 'Writing Frameworks',
  rawContent: item.breakdown_markdown,
  diagramImagePath: item.diagram_image_path
}));

const mappedEthics: ValueAdditionItem[] = ethicsValueAdd.map((item, idx) => {
  let ethicsType: any = 'keyword';
  if (item.ethics_type === 'diagram') ethicsType = 'diagram';
  else if (item.ethics_type === 'dimension') ethicsType = 'dimension';
  else if (item.ethics_type === 'comparison') ethicsType = 'comparison';
  else if (item.ethics_type === 'innovation') ethicsType = 'innovation';
  else if (item.ethics_type === 'pyq_quote') ethicsType = 'pyq_quote';
  else if (item.ethics_type === 'situation') ethicsType = 'innovation'; // Map situations under innovations

  return {
    id: `va-et-${idx}`,
    category: 'ethics',
    paper: normalizePaper(item.paper),
    subject: item.subject,
    sectionGroup: item.section_group,
    microtopic: item.microtopic,
    subtopic: item.subtopic,
    title: item.title,
    ethicsType,
    ethicsData: {
      diagramType: item.title,
      diagramDescription: item.content_markdown,
      dimensionsList: parseDimensions(item.content_markdown),
      comparisonPoints: parseComparisonPoints(item.content_markdown),
      officerName: item.officer_name || undefined,
      initiative: item.initiative || undefined,
      impact: item.impact || undefined,
      values: item.core_values || undefined,
      keywordDefinition: item.content_markdown,
      keywordExample: item.content_markdown
    },
    source: 'Ethics Hub',
    rawContent: item.content_markdown,
    diagramImagePath: item.diagram_image_path
  };
});

export const mainsConsolidatedValueAdd: ValueAdditionItem[] = [
  ...mappedDataFacts,
  ...mappedIntroConclusions,
  ...mappedEssayValueAdd,
  ...mappedMnemonics,
  ...mappedFrameworks,
  ...mappedEthics
];

import { supabase } from '../lib/supabase';

export async function fetchValueAdditionFromSupabase(): Promise<ValueAdditionItem[]> {
  const [
    dfRes,
    icRes,
    esRes,
    etRes,
    mnRes,
    fwRes
  ] = await Promise.all([
    supabase.from('mains_data_facts').select('*'),
    supabase.from('mains_intro_conclusions').select('*'),
    supabase.from('mains_essay_value_add').select('*'),
    supabase.from('mains_ethics_value_add').select('*'),
    supabase.from('mains_mnemonics').select('*'),
    supabase.from('mains_frameworks').select('*')
  ]);

  if (dfRes.error) throw dfRes.error;
  if (icRes.error) throw icRes.error;
  if (esRes.error) throw esRes.error;
  if (etRes.error) throw etRes.error;
  if (mnRes.error) throw mnRes.error;
  if (fwRes.error) throw fwRes.error;

  const mappedDataFacts: ValueAdditionItem[] = (dfRes.data || []).map((item, idx) => ({
    id: item.id || `va-df-${idx}`,
    category: 'data_facts',
    paper: normalizePaper(item.paper),
    subject: item.subject,
    sectionGroup: item.section_group,
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
    subject: item.subject,
    sectionGroup: item.section_group,
    microtopic: item.microtopic,
    subtopic: item.subtopic,
    title: item.card_title,
    introduction: item.introduction || undefined,
    conclusion: item.conclusion || undefined,
    quoteText: item.quote_text || undefined,
    author: item.quote_author || undefined,
    examples: item.examples || undefined,
    source: 'Ready-made Intro/Conclusion',
    rawContent: [item.quote_text || '', item.introduction || '', item.examples || '', item.conclusion || ''].filter(Boolean).join('\n\n')
  }));

  const mappedEssayValueAdd: ValueAdditionItem[] = (esRes.data || []).map((item, idx) => ({
    id: item.id || `va-es-${idx}`,
    category: 'quotes',
    paper: normalizePaper(item.paper),
    subject: item.subject,
    sectionGroup: item.section_group,
    microtopic: item.microtopic,
    title: item.title,
    quoteText: item.content,
    author: item.category || 'Essay Theme',
    usageGuide: item.usage_guide || `Category: ${item.category}`,
    source: 'Essay Value Add',
    rawContent: item.content
  }));

  const mappedMnemonics: ValueAdditionItem[] = (mnRes.data || []).map((item, idx) => ({
    id: item.id || `va-mn-${idx}`,
    category: 'mnemonics',
    paper: normalizePaper(item.paper),
    subject: item.subject,
    sectionGroup: item.section_group,
    microtopic: item.microtopic,
    subtopic: item.subtopic,
    title: item.mnemonic_number_title,
    mnemonicKeyword: item.mnemonic_keyword,
    mnemonicExpansion: item.formula_expansion,
    context: item.explanation_examples,
    source: 'Memory Mnemonics',
    rawContent: item.explanation_examples
  }));

  const mappedFrameworks: ValueAdditionItem[] = (fwRes.data || []).map((item, idx) => ({
    id: item.id || `va-fw-${idx}`,
    category: 'frameworks',
    title: item.framework_name,
    frameworkBoxes: parseFrameworkBoxes(item.breakdown_markdown),
    frameworkGuide: item.breakdown_markdown,
    source: 'Writing Frameworks',
    rawContent: item.breakdown_markdown,
    diagramImagePath: item.diagram_image_path
  }));

  const mappedEthics: ValueAdditionItem[] = (etRes.data || []).map((item, idx) => {
    let ethicsType: any = 'keyword';
    if (item.ethics_type === 'diagram') ethicsType = 'diagram';
    else if (item.ethics_type === 'dimension') ethicsType = 'dimension';
    else if (item.ethics_type === 'comparison') ethicsType = 'comparison';
    else if (item.ethics_type === 'innovation') ethicsType = 'innovation';
    else if (item.ethics_type === 'pyq_quote') ethicsType = 'pyq_quote';
    else if (item.ethics_type === 'situation') ethicsType = 'innovation';

    return {
      id: item.id || `va-et-${idx}`,
      category: 'ethics',
      paper: normalizePaper(item.paper),
      subject: item.subject,
      sectionGroup: item.section_group,
      microtopic: item.microtopic,
      subtopic: item.subtopic,
      title: item.title,
      ethicsType,
      ethicsData: {
        diagramType: item.title,
        diagramDescription: item.content_markdown,
        dimensionsList: parseDimensions(item.content_markdown),
        comparisonPoints: parseComparisonPoints(item.content_markdown),
        officerName: item.officer_name || undefined,
        initiative: item.initiative || undefined,
        impact: item.impact || undefined,
        values: item.core_values || undefined,
        keywordDefinition: item.content_markdown,
        keywordExample: item.content_markdown
      },
      source: 'Ethics Hub',
      rawContent: item.content_markdown,
      diagramImagePath: item.diagram_image_path
    };
  });

  return [
    ...mappedDataFacts,
    ...mappedIntroConclusions,
    ...mappedEssayValueAdd,
    ...mappedMnemonics,
    ...mappedFrameworks,
    ...mappedEthics
  ];
}

