import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys — same keys used in profile settings panel
export const PROMPT_KEYS = {
  explain:   'ai_prompt_explain',
  summarize: 'ai_prompt_summarize',
  search:    'ai_prompt_search',
  model:     'ai_gemini_model',
} as const;

export const GEMINI_MODELS = [
  { id: 'gemini-1.5-flash', label: 'Flash',   sub: 'Fast · 1500 req/day free' },
  { id: 'gemini-1.5-pro',   label: 'Pro',     sub: 'Smarter · 50 req/day free' },
  { id: 'gemini-2.0-flash', label: 'Flash 2', sub: 'Newest · experimental' },
] as const;

export const DEFAULT_MODEL = 'gemini-1.5-flash';

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
  let key = '';
  let model: string = DEFAULT_MODEL;
  try {
    key   = (await AsyncStorage.getItem('gemini_api_key')) || '';
    model = (await AsyncStorage.getItem(PROMPT_KEYS.model)) || DEFAULT_MODEL;
  } catch {}
  if (!key) key = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
  if (!key) throw new Error('No Gemini API key found. Go to Settings → AI Settings and paste your key.');
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
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

  return callGemini(prompt, 700);
}

export async function aiSummarizeExplanation(explanationText: string): Promise<string> {
  const template = await getPrompt('summarize');
  const prompt = template.replace('{{explanation}}', explanationText.slice(0, 2000));
  return callGemini(prompt, 300);
}

export async function aiExpandSearchQuery(userQuery: string): Promise<string[]> {
  const template = await getPrompt('search');
  const prompt = template.replace('{{query}}', userQuery);
  const raw = await callGemini(prompt, 200);
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === 'string');
  } catch {
    return raw.replace(/[\[\]"]/g, '').split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}
