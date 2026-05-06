import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys — same keys used in profile settings panel
export const PROMPT_KEYS = {
  explain:   'ai_prompt_explain',
  summarize: 'ai_prompt_summarize',
  search:    'ai_prompt_search',
  model:     'ai_gemini_model',
} as const;

export const GEMINI_KEY_STORAGE_KEYS = [
  'gemini_api_key',    // slot 1 (existing, unchanged for backward compat)
  'gemini_api_key_2',  // slot 2
  'gemini_api_key_3',  // slot 3
  'gemini_api_key_4',  // slot 4
] as const;

export const GEMINI_ACTIVE_KEY_INDEX = 'gemini_active_key_index'; // '0' | '1' | '2' | '3'

export const GEMINI_MODELS = [
  { id: 'gemini-2.0-flash',        label: 'Flash 2.0',    sub: 'Fast · recommended' },
  { id: 'gemini-2.0-flash-lite',   label: 'Flash 2.0 Lite', sub: 'Fastest · cheapest' },
  { id: 'gemini-2.5-flash-preview-05-20', label: 'Flash 2.5', sub: 'Smartest · best quality' },
] as const;

export const AI_PROVIDER_KEY = 'ai_provider'; // 'gemini' | 'groq'
export const GROQ_API_KEY_STORAGE = 'groq_api_key';

export const GROQ_MODELS = [
  { id: 'llama-3.3-70b-versatile',    label: 'Llama 3.3 70B',  sub: 'Best quality · 14400 req/day free' },
  { id: 'llama-3.1-8b-instant',       label: 'Llama 3.1 8B',   sub: 'Fastest · highest limits' },
  { id: 'mixtral-8x7b-32768',         label: 'Mixtral 8x7B',   sub: 'Good balance · free' },
] as const;

export const GROQ_KEY_STORAGE_KEYS = [
  'groq_api_key',
  'groq_api_key_2',
  'groq_api_key_3',
  'groq_api_key_4',
] as const;

export const GROQ_ACTIVE_KEY_INDEX = 'groq_active_key_index';
export const GROQ_MODEL_KEY = 'groq_model';
export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

export const DEFAULT_MODEL = 'gemini-2.0-flash';

// Default prompts — used when user has not customised
export const DEFAULT_PROMPTS = {
  explain: `You are an expert UPSC coach. A student is studying this question.

QUESTION:
{{question}}

OPTIONS:
{{options}}

CORRECT ANSWER (official, must be respected): {{correct_answer}}

INSTITUTE EXPLANATIONS (if any — read all and merge the strongest reasoning into one best answer; do NOT contradict the official correct answer above):
{{institute_explanations}}

Your task — write a complete study note with these exact sections:

✅ CORRECT ANSWER
State the correct option and explain WHY it is correct in 2-3 sentences with key facts.

📚 OPTION-BY-OPTION BREAKDOWN
For each option (A, B, C, D) — even wrong ones — write 2-3 sentences explaining what
that concept/person/place actually is, as if writing a mini encyclopedia entry.
A student reading this should be able to answer any future UPSC question about it.
Wrap important names, dates, or terms in **bold**. You may use __underline__ for the
single most exam-critical fact in each option.

🎯 EXAMINER'S ANGLE
One sentence: why did UPSC ask this? What theme or syllabus area does it test?

Keep the total under 450 words. Do not add any preamble or closing remarks.
Do not mention "the institute explanations said…" — silently merge them.`,

  summarize: `You are a UPSC study coach making detailed revision notes.

Read this explanation and extract exactly 6 to 8 bullet points.
Rules:
- Each bullet must be 15 to 25 words
- Pack specific facts: names, dates, years, articles, sections, places, numbers
- Wrap the single most important word or phrase in each bullet with **bold**
- Where useful, mark a key term with __underline__ for stronger emphasis
- Return ONLY the bullet points, nothing else, no preamble, no closing remarks
- Format each as: • **Key term** — concrete fact-rich explanation with at least one specific detail

EXPLANATION:
{{explanation}}`,

  search: `You are a UPSC question bank search assistant.

A student typed this search query: "{{query}}"

Generate a list of 12-18 specific keywords and phrases that UPSC questions on this
topic would contain. Include: related concepts, proper nouns, synonyms, associated
geography, historical figures, acts/articles, years if relevant.

Return ONLY a JSON array of strings. Example: ["keyword1", "keyword2", "phrase 3"]
No explanation, no markdown fences, just the raw JSON array.`,
};

// Helper — reads user's saved prompt or falls back to default
async function getPrompt(key: keyof typeof PROMPT_KEYS): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(PROMPT_KEYS[key]);
    return saved?.trim() || DEFAULT_PROMPTS[key];
  } catch {
    return DEFAULT_PROMPTS[key];
  }
}

// Helper — builds the Gemini Flash endpoint URL using the user's saved API key,
// falling back to the EXPO_PUBLIC_GEMINI_API_KEY env var if no key is saved.
async function getFlashUrl(): Promise<string> {
  let activeIndex = 0;
  let model: string = DEFAULT_MODEL;
  try {
    const idx = await AsyncStorage.getItem(GEMINI_ACTIVE_KEY_INDEX);
    activeIndex = idx ? parseInt(idx, 10) : 0;
    model = (await AsyncStorage.getItem(PROMPT_KEYS.model)) || DEFAULT_MODEL;
  } catch {}

  const storageKey = GEMINI_KEY_STORAGE_KEYS[activeIndex] ?? GEMINI_KEY_STORAGE_KEYS[0];
  let key = '';
  try {
    key = (await AsyncStorage.getItem(storageKey)) || '';
  } catch {}

  if (!key) key = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
  if (!key) throw new Error('No Gemini API key found. Go to Settings → AI Settings and paste your key.');

  return `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${key}`;
}

async function callGemini(prompt: string, maxTokens = 600): Promise<string> {
  const url = await getFlashUrl();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens, topP: 0.8 },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text.trim();
}

async function callGroq(prompt: string, maxTokens = 600): Promise<string> {
  // Get active Groq key
  let activeIndex = 0;
  try {
    const idx = await AsyncStorage.getItem(GROQ_ACTIVE_KEY_INDEX);
    activeIndex = idx ? parseInt(idx, 10) : 0;
  } catch {}

  const storageKey = GROQ_KEY_STORAGE_KEYS[activeIndex] ?? GROQ_KEY_STORAGE_KEYS[0];
  let key = '';
  try {
    key = (await AsyncStorage.getItem(storageKey)) || '';
  } catch {}

  if (!key) throw new Error('No Groq API key found. Go to Settings → AI Settings and paste your Groq key.');

  // Get selected Groq model
  let model = DEFAULT_GROQ_MODEL;
  try {
    model = (await AsyncStorage.getItem(GROQ_MODEL_KEY)) || DEFAULT_GROQ_MODEL;
  } catch {}

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: maxTokens,
    }),
  });

  if (res.status === 429) {
    throw new Error('429: Groq quota exceeded. Switch to another key in Settings → AI Settings.');
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from Groq');
  return text.trim();
}

async function callAI(prompt: string, maxTokens = 600): Promise<string> {
  let provider = 'gemini';
  try {
    provider = (await AsyncStorage.getItem(AI_PROVIDER_KEY)) || 'gemini';
  } catch {}

  if (provider === 'groq') {
    return callGroq(prompt, maxTokens);
  }
  return callGemini(prompt, maxTokens);
}

export type InstituteExplanation = {
  source: string;
  program?: string;
  text: string;
  answer?: string;
};

export async function aiExplainQuestion(
  questionText: string,
  options: Record<string, string>,
  correctAnswer: string,
  instituteExplanations?: InstituteExplanation[],
): Promise<string> {
  const optionLines = Object.entries(options)
    .map(([k, v]) => `${k}) ${v}`)
    .join('\n');

  // Render institute explanations as a simple labelled block. Cap each entry
  // at 1500 chars so a single noisy source can't blow the prompt budget.
  const explBlock = (instituteExplanations || [])
    .filter((e) => e && (e.text || '').trim())
    .map((e, i) => {
      const meta = [e.source, e.program].filter(Boolean).join(' · ');
      const ans  = e.answer ? ` (marked answer: ${e.answer})` : '';
      const body = String(e.text).slice(0, 1500);
      return `[${i + 1}] ${meta}${ans}\n${body}`;
    })
    .join('\n\n');

  const template = await getPrompt('explain');
  const prompt = template
    .replace('{{question}}', questionText)
    .replace('{{options}}', optionLines)
    .replace('{{correct_answer}}', correctAnswer.toUpperCase())
    .replace(
      '{{institute_explanations}}',
      explBlock || '(none — write the explanation purely from your own knowledge)',
    );

  return callAI(prompt, 800);
}

/**
 * Regenerate or transform an existing AI answer based on a user instruction
 * (e.g. "shorten to 3 lines", "add more facts about Article 370"). Used by
 * the "🤖 Improve with AI" button inside the Modify & Save edit panel.
 */
export async function aiImproveAnswer(
  customInstruction: string,
  currentAnswerText: string,
  questionText: string,
  instituteExplanations?: InstituteExplanation[],
): Promise<string> {
  const explBlock = (instituteExplanations || [])
    .filter((e) => e && (e.text || '').trim())
    .map((e, i) => {
      const meta = [e.source, e.program].filter(Boolean).join(' · ');
      return `[${i + 1}] ${meta}\n${String(e.text).slice(0, 1200)}`;
    })
    .join('\n\n');

  const prompt = `You are an expert UPSC coach refining a study note.

ORIGINAL QUESTION:
${questionText}

INSTITUTE EXPLANATIONS (context only, may be empty):
${explBlock || '(none)'}

CURRENT ANSWER (the student's saved text — preserve correct facts, only adjust per the instruction):
${currentAnswerText}

USER INSTRUCTION:
${customInstruction}

Rewrite the answer to satisfy the instruction. Keep the same section markers
(✅ CORRECT ANSWER, 📚 OPTION-BY-OPTION BREAKDOWN, 🎯 EXAMINER'S ANGLE) if
they already exist. Use **bold** for key terms and __underline__ for the
single most exam-critical fact. Return ONLY the rewritten answer text — no
preamble, no commentary about what you changed.`;

  return callAI(prompt, 900);
}

export async function aiSummarizeExplanation(explanationText: string): Promise<string> {
  const template = await getPrompt('summarize');
  const prompt = template.replace('{{explanation}}', explanationText.slice(0, 2000));
  // Bumped from 300 → 600 to fit 6-8 detailed bullets (15-25 words each).
  return callAI(prompt, 600);
}

export async function aiExpandSearchQuery(userQuery: string): Promise<string[]> {
  const template = await getPrompt('search');
  const prompt = template.replace('{{query}}', userQuery);
  const raw = await callAI(prompt, 200);
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === 'string');
  } catch {
    return raw.replace(/[\[\]"]/g, '').split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}
