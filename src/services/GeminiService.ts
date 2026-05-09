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
  { id: 'gemini-1.5-flash',        label: 'Flash 1.5',    sub: 'Fastest · universally supported' },
  { id: 'gemini-1.5-pro',          label: 'Pro 1.5',      sub: 'Smartest · best quality' },
  { id: 'gemini-2.0-flash',        label: 'Flash 2.0',    sub: 'Fast · next-gen standard' },
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

export const DEFAULT_MODEL = 'gemini-1.5-flash';

export const OPENROUTER_API_KEY_STORAGE = 'openrouter_api_key';
export const OPENROUTER_MODEL_KEY = 'openrouter_model';
export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';

export const OPENROUTER_MODELS = [
  { id: 'openrouter/free',                    label: 'Auto (Free Router)', sub: 'Best available free model' },
  { id: 'deepseek/deepseek-r1:free',          label: 'DeepSeek R1',        sub: 'Best reasoning · free' },
  { id: 'qwen/qwen3-235b-a22b:free',          label: 'Qwen3 235B',         sub: 'Best quality · free preview' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B', sub: 'Reliable · free' },
] as const;

// Filters Gemini can infer from query intent
export type AIInferredFilters = {
  subject?:      string;   // e.g. 'History', 'Geography', 'Polity'
  stage?:        string;   // 'Prelims' | 'Mains'
  pyqFilter?:    string;   // 'PYQ Only' | 'Non-PYQ'
  examCategory?: string;   // 'UPSC' | 'Allied' | 'Others'
  ncertFilter?:  string;   // 'NCERT Only'
  specificYear?: string;   // e.g. '2019' or '2019,2020'
};

export type AISearchResult = {
  keywords: string[];
  filters: AIInferredFilters;
};

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

Return a JSON object with exactly two keys: "keywords" and "filters".

"keywords": an array of 12-18 specific topic/concept words and phrases that UPSC questions on this topic would contain.
STRICT RULES for keywords:
- Include: related concepts, proper nouns, synonyms, associated geography, historical figures, acts/articles
- DO NOT include: years, exam names (UPSC/CSE/IAS/SSC), exam stages (Prelims/Mains), subject names (History/Polity/Geography), or institute names
- If the query mentions "2019 UPSC History", keywords should be ONLY the history concepts, NOT "2019", "UPSC", or "History"
- Example: for "2019 UPSC polity emergency provisions", keywords = ["emergency provisions","article 352","president's rule","national emergency","fundamental rights suspension"] NOT ["2019","UPSC","polity","prelims"]

"filters": an object with ONLY the filters you are CONFIDENT about from the query. Omit any filter you are not sure about — do NOT guess. Use exactly these values:
  subject: one of: "History", "Geography", "Polity", "Economy", "Environment", "Science & Technology", "Art & Culture", "International Relations", "Agriculture", "Social Issues" (omit if unclear or multi-subject)
  stage: "Prelims" or "Mains" (only if explicitly mentioned or strongly implied)
  pyqFilter: "PYQ Only" if query mentions "pyq", "previous year", "upsc asked", or a specific year. "Non-PYQ" if query mentions "test series", "practice", "mock". Omit otherwise.
  examCategory: "UPSC" if query mentions "upsc", "cse", "ias". "Allied" if mentions "allied", "state pcs", "capf". Omit otherwise.
  ncertFilter: "NCERT Only" if query mentions "ncert" or "class 6" through "class 12". Omit otherwise.
  specificYear: a year string like "2019" or comma-separated "2019,2020" if a specific year is mentioned. Omit otherwise.

CRITICAL: Years, exam names, and subject names belong ONLY in "filters", NEVER in "keywords".

Return ONLY raw JSON. No explanation, no markdown fences. Example:
{"keywords":["emergency provisions","article 352","national emergency"],"filters":{"subject":"Polity","pyqFilter":"PYQ Only","examCategory":"UPSC","specificYear":"2019"}}`,
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
    const savedModel = await AsyncStorage.getItem(PROMPT_KEYS.model);
    const isValid = GEMINI_MODELS.some(m => m.id === savedModel);
    model = isValid ? savedModel! : DEFAULT_MODEL;
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

async function callOpenRouter(prompt: string, maxTokens = 600): Promise<string> {
  let key = '';
  try { key = (await AsyncStorage.getItem(OPENROUTER_API_KEY_STORAGE)) || ''; } catch {}
  // Fallback to Emergent LLM key from env
  if (!key) key = process.env.EXPO_PUBLIC_EMERGENT_LLM_KEY || '';
  if (!key) throw new Error('No OpenRouter/Emergent API key. Go to Settings → AI Settings.');

  let model = DEFAULT_OPENROUTER_MODEL;
  try { model = (await AsyncStorage.getItem(OPENROUTER_MODEL_KEY)) || DEFAULT_OPENROUTER_MODEL; } catch {}

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': 'com.upsc.app',
      'X-Title': 'UPSC Prep App',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: maxTokens,
    }),
  });

  if (res.status === 429) throw new Error('429: OpenRouter rate limit. Try again in a minute.');
  if (!res.ok) { const err = await res.text(); throw new Error(`OpenRouter error ${res.status}: ${err}`); }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from OpenRouter');
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
  if (provider === 'openrouter') {
    return callOpenRouter(prompt, maxTokens);
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

export async function aiExpandSearchQuery(userQuery: string): Promise<AISearchResult> {
  const template = await getPrompt('search');
  const prompt = template.replace('{{query}}', userQuery);
  const raw = await callAI(prompt, 300);
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Handle old format gracefully (plain array) — treat as keywords only
    if (Array.isArray(parsed)) {
      return { keywords: parsed.filter((s: any) => typeof s === 'string'), filters: {} };
    }

    const keywords: string[] = Array.isArray(parsed.keywords)
      ? parsed.keywords.filter((s: any) => typeof s === 'string')
      : [];

    const filters: AIInferredFilters = {};
    const f = parsed.filters || {};

    const validSubjects = ['History', 'Geography', 'Polity', 'Economy',
      'Environment', 'Science & Technology', 'Art & Culture',
      'International Relations', 'Agriculture', 'Social Issues'];

    if (f.subject && validSubjects.includes(f.subject)) filters.subject = f.subject;
    if (f.stage === 'Prelims' || f.stage === 'Mains') filters.stage = f.stage;
    if (f.pyqFilter === 'PYQ Only' || f.pyqFilter === 'Non-PYQ') filters.pyqFilter = f.pyqFilter;
    if (f.examCategory === 'UPSC' || f.examCategory === 'Allied' || f.examCategory === 'Others') filters.examCategory = f.examCategory;
    if (f.ncertFilter === 'NCERT Only') filters.ncertFilter = f.ncertFilter;
    if (typeof f.specificYear === 'string' && /^\d{4}(,\d{4})*$/.test(f.specificYear)) filters.specificYear = f.specificYear;

    return { keywords, filters };

  } catch {
    // Fallback: treat whole response as comma-separated keyword list
    const keywords = raw.replace(/[\[\]"]/g, '').split(',').map((s: string) => s.trim()).filter(Boolean);
    return { keywords, filters: {} };
  }
}

// ══════════════════════════════════════════════════════════════════
// PHASE 2 ADDITION: Multi-turn conversation history support
// ══════════════════════════════════════════════════════════════════

/**
 * Generate AI response with full conversation history (multi-turn chat).
 * Used by AIExplanationChat component.
 * Tries backend /api/ai/chat first (uses Emergent LLM key), then falls back to direct API calls.
 */
export async function generateWithHistory(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  questionContext?: {
    question: string;
    options: string[];
    correct_answer: string;
    institute_explanations?: string;
  }
): Promise<string> {
  const systemPrompt = `You are an expert UPSC coach helping a student understand exam questions.
${questionContext ? `
QUESTION: ${questionContext.question}
OPTIONS: ${questionContext.options.join(', ')}
CORRECT ANSWER: ${questionContext.correct_answer}
${questionContext.institute_explanations ? `CONTEXT: ${questionContext.institute_explanations.slice(0, 800)}` : ''}
` : ''}
Be concise, accurate, and helpful. Always relate answers to UPSC preparation.`;

  // Try backend proxy first (uses Emergent LLM key)
  try {
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
    if (backendUrl) {
      const res = await fetch(`${backendUrl}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          system_prompt: systemPrompt,
          model: 'gemini-1.5-flash',
          max_tokens: 800,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.content) return data.content;
      }
    }
  } catch {}

  // Fallback to direct API call using user's saved keys
  let provider = 'gemini';
  try {
    provider = (await AsyncStorage.getItem(AI_PROVIDER_KEY)) || 'gemini';
  } catch {}

  try {
    if (provider === 'groq') {
      return await generateGroqWithHistory(messages, systemPrompt);
    }
    if (provider === 'openrouter') {
      return await generateOpenRouterWithHistory(messages, systemPrompt);
    }
    return await generateGeminiWithHistory(messages, systemPrompt);
  } catch (error) {
    console.error('Error generating with history:', error);
    throw error;
  }
}

async function generateGeminiWithHistory(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string
): Promise<string> {
  const url = await getFlashUrl();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })),
      generationConfig: { temperature: 0.4, maxOutputTokens: 800, topP: 0.85 },
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

async function generateGroqWithHistory(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string
): Promise<string> {
  let activeIndex = 0;
  try {
    const idx = await AsyncStorage.getItem(GROQ_ACTIVE_KEY_INDEX);
    activeIndex = idx ? parseInt(idx, 10) : 0;
  } catch {}

  const storageKey = GROQ_KEY_STORAGE_KEYS[activeIndex] ?? GROQ_KEY_STORAGE_KEYS[0];
  let key = '';
  try { key = (await AsyncStorage.getItem(storageKey)) || ''; } catch {}
  if (!key) throw new Error('No Groq API key found. Go to Settings → AI Settings.');

  let model = DEFAULT_GROQ_MODEL;
  try { model = (await AsyncStorage.getItem(GROQ_MODEL_KEY)) || DEFAULT_GROQ_MODEL; } catch {}

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.4,
      max_tokens: 800,
    }),
  });

  if (res.status === 429) throw new Error('429: Groq rate limit. Switch key in AI Settings.');
  if (!res.ok) { const err = await res.text(); throw new Error(`Groq error ${res.status}: ${err}`); }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from Groq');
  return text.trim();
}

async function generateOpenRouterWithHistory(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string
): Promise<string> {
  let key = '';
  try { key = (await AsyncStorage.getItem(OPENROUTER_API_KEY_STORAGE)) || ''; } catch {}
  if (!key) throw new Error('No OpenRouter API key. Go to Settings → AI Settings.');

  let model = DEFAULT_OPENROUTER_MODEL;
  try { model = (await AsyncStorage.getItem(OPENROUTER_MODEL_KEY)) || DEFAULT_OPENROUTER_MODEL; } catch {}

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': 'com.upsc.app',
      'X-Title': 'UPSC Prep App',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.4,
      max_tokens: 800,
    }),
  });

  if (res.status === 429) throw new Error('429: OpenRouter rate limit.');
  if (!res.ok) { const err = await res.text(); throw new Error(`OpenRouter error ${res.status}: ${err}`); }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from OpenRouter');
  return text.trim();
}

// ══════════════════════════════════════════════════════════════════

/**
 * General doubt clearing for a question context.
 */
export async function aiAskDoubt(
  userQuestion: string,
  context: {
    question?: string;
    options?: string;
    explanation?: string;
  }
): Promise<string> {
  const prompt = `You are an expert UPSC mentor helping a student with a specific doubt.

CONTEXT:
${context.question ? `Question: ${context.question}` : ''}
${context.options ? `Options: ${context.options}` : ''}
${context.explanation ? `Current Explanation: ${context.explanation}` : ''}

STUDENT'S DOUBT:
"${userQuestion}"

Your task: Answer the student's doubt precisely and accurately in the context of UPSC preparation. 
- Be concise but fact-rich.
- If the doubt is about a specific term in the context, explain it clearly.
- Keep the tone encouraging and academic.
- Return ONLY the answer text, no preamble.`;

  return callAI(prompt, 800);
}
