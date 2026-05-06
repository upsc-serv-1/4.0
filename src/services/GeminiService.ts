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
  { id: 'gemini-2.0-flash-lite',           label: 'Flash Lite', sub: 'Fastest · highest free quota' },
  { id: 'gemini-2.0-flash',                label: 'Flash 2',    sub: 'Recommended · fast + smart' },
  { id: 'gemini-2.5-flash-preview-04-17',  label: 'Flash 2.5',  sub: 'Smartest free model' },
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

export const DEFAULT_MODEL = 'gemini-2.0-flash-lite';

// Default prompts — used when user has not customised
export const DEFAULT_PROMPTS = {
  explain: `You are an expert UPSC coach. A student is studying this question.

QUESTION:
{{question}}

OPTIONS:
{{options}}

CORRECT ANSWER: {{correct_answer}}

Your task — write a complete study note with these exact sections:

✅ CORRECT ANSWER
State the correct option and explain WHY it is correct in 2-3 sentences with key facts.

📚 OPTION-BY-OPTION BREAKDOWN
For each option (A, B, C, D) — even wrong ones — write 2-3 sentences explaining what
that concept/person/place actually is, as if writing a mini encyclopedia entry.
A student reading this should be able to answer any future UPSC question about it.
Wrap important names, dates, or terms in **bold**.

🎯 EXAMINER'S ANGLE
One sentence: why did UPSC ask this? What theme or syllabus area does it test?

Keep the total under 400 words. Do not add any preamble or closing remarks.`,

  summarize: `You are a UPSC study coach making concise revision notes.

Read this explanation and extract exactly 5 bullet points.
Rules:
- Each bullet must be under 18 words
- Wrap the single most important word or phrase in each bullet with **bold**
- Return ONLY the 5 bullet points, nothing else, no preamble
- Format each as: • **Key term** — brief explanation

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

export async function aiExplainQuestion(
  questionText: string,
  options: Record<string, string>,
  correctAnswer: string,
): Promise<string> {
  const optionLines = Object.entries(options)
    .map(([k, v]) => `${k}) ${v}`)
    .join('\n');

  const template = await getPrompt('explain');
  const prompt = template
    .replace('{{question}}', questionText)
    .replace('{{options}}', optionLines)
    .replace('{{correct_answer}}', correctAnswer.toUpperCase());

  return callAI(prompt, 700);
}

export async function aiSummarizeExplanation(explanationText: string): Promise<string> {
  const template = await getPrompt('summarize');
  const prompt = template.replace('{{explanation}}', explanationText.slice(0, 2000));
  return callAI(prompt, 300);
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
