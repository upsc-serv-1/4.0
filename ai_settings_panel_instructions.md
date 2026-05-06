# AI PROMPT SETTINGS PANEL — Build Instructions
# For: emergent.sh AI agent
# File to edit: app/profile.tsx + src/services/GeminiService.ts

---

## WHAT WE ARE BUILDING

A new "AI SETTINGS" section in `app/profile.tsx` (the existing settings/profile screen).

It contains 3 expandable text boxes — one for each Gemini prompt:
1. **Explain Prompt** — used by "AI EXPLAIN" button in quiz engine
2. **Summarize Prompt** — used by "✨ SUMMARIZE" button
3. **Search Prompt** — used by AI Search tab

The user can read, edit, and save each prompt directly from the app.
Prompts are stored in `AsyncStorage` (already imported in profile.tsx).
`GeminiService.ts` reads from AsyncStorage before every API call, falling back
to the default prompt if the user hasn't customized it.

---

## STEP 1 — Add prompt storage keys and defaults to GeminiService.ts

**File:** `src/services/GeminiService.ts`

Add at the top of the file, after imports:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys — same keys used in profile settings panel
export const PROMPT_KEYS = {
  explain:   'ai_prompt_explain',
  summarize: 'ai_prompt_summarize',
  search:    'ai_prompt_search',
} as const;

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
```

**Then update each of the 3 functions to use `getPrompt()` and `{{placeholders}}`:**

```typescript
// Replace aiExplainQuestion:
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

// Replace aiSummarizeExplanation:
export async function aiSummarizeExplanation(explanationText: string): Promise<string> {
  const template = await getPrompt('summarize');
  const prompt = template.replace('{{explanation}}', explanationText.slice(0, 2000));
  return callGemini(prompt, 300);
}

// Replace aiExpandSearchQuery:
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
```

---

## STEP 2 — Add the AI Settings panel to profile.tsx

**File:** `app/profile.tsx`

### 2a. Add imports (add to existing import block at top)

```typescript
import { Brain, Sparkles, Search, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react-native';
import { PROMPT_KEYS, DEFAULT_PROMPTS } from '../src/services/GeminiService';
```

(`AsyncStorage` is already imported in this file.)

### 2b. Add state variables (near other useState declarations, around line 100)

```typescript
// AI Prompt settings
const [geminiKey, setGeminiKey] = useState('');
const [explainPrompt, setExplainPrompt]     = useState('');
const [summarizePrompt, setSummarizePrompt] = useState('');
const [searchPrompt, setSearchPrompt]       = useState('');
const [expandedPrompt, setExpandedPrompt]   = useState<'explain' | 'summarize' | 'search' | null>(null);
const [promptSaving, setPromptSaving]       = useState(false);
const [promptSaved, setPromptSaved]         = useState(false);
```

### 2c. Add load effect (inside the existing `useEffect` that loads settings, or add a new one)

```typescript
// Load AI settings
useEffect(() => {
  (async () => {
    const [key, ep, sp, srp] = await Promise.all([
      AsyncStorage.getItem('gemini_api_key'),
      AsyncStorage.getItem(PROMPT_KEYS.explain),
      AsyncStorage.getItem(PROMPT_KEYS.summarize),
      AsyncStorage.getItem(PROMPT_KEYS.search),
    ]);
    setGeminiKey(key || '');
    setExplainPrompt(ep || DEFAULT_PROMPTS.explain);
    setSummarizePrompt(sp || DEFAULT_PROMPTS.summarize);
    setSearchPrompt(srp || DEFAULT_PROMPTS.search);
  })();
}, []);
```

### 2d. Add save handler

```typescript
const saveAiSettings = async () => {
  setPromptSaving(true);
  try {
    await Promise.all([
      AsyncStorage.setItem('gemini_api_key', geminiKey.trim()),
      AsyncStorage.setItem(PROMPT_KEYS.explain,    explainPrompt.trim()   || DEFAULT_PROMPTS.explain),
      AsyncStorage.setItem(PROMPT_KEYS.summarize,  summarizePrompt.trim() || DEFAULT_PROMPTS.summarize),
      AsyncStorage.setItem(PROMPT_KEYS.search,     searchPrompt.trim()    || DEFAULT_PROMPTS.search),
    ]);
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2500);
  } catch (e: any) {
    Alert.alert('Save failed', e?.message || '');
  } finally {
    setPromptSaving(false);
  }
};

const resetPrompt = async (key: 'explain' | 'summarize' | 'search') => {
  await AsyncStorage.removeItem(PROMPT_KEYS[key]);
  if (key === 'explain')    setExplainPrompt(DEFAULT_PROMPTS.explain);
  if (key === 'summarize')  setSummarizePrompt(DEFAULT_PROMPTS.summarize);
  if (key === 'search')     setSearchPrompt(DEFAULT_PROMPTS.search);
};
```

### 2e. Add the JSX panel

**Find this line in profile.tsx JSX** (around line 291):
```tsx
<Text style={[styles.small, { color: colors.textTertiary, marginTop: 24, marginBottom: 12 }]}>DATA & OFFLINE</Text>
```

**Insert the entire AI Settings panel BEFORE that line:**

```tsx
{/* ── AI SETTINGS SECTION ──────────────────────────────── */}
<Text style={[styles.small, { color: colors.textTertiary, marginTop: 24, marginBottom: 12 }]}>
  AI SETTINGS
</Text>
<View style={[styles.settingsGroup, { backgroundColor: colors.surface + '50', borderColor: colors.border }]}>

  {/* Gemini API Key row */}
  <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <Brain size={18} color="#7c3aed" />
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
        Gemini API Key
      </Text>
    </View>
    <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 8 }}>
      Free key from aistudio.google.com → Get API key
    </Text>
    <TextInput
      value={geminiKey}
      onChangeText={setGeminiKey}
      placeholder="Paste your AIzaSy... key here"
      placeholderTextColor={colors.textTertiary}
      secureTextEntry={true}
      autoCorrect={false}
      autoCapitalize="none"
      style={{
        backgroundColor: colors.bg,
        borderWidth: 1, borderColor: colors.border,
        borderRadius: 10, padding: 10,
        fontSize: 13, color: colors.textPrimary,
        fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
      }}
      testID="ai-settings-api-key"
    />
  </View>

  {/* Prompt rows — one for each of the 3 prompts */}
  {(
    [
      {
        key:         'explain' as const,
        label:       'Explain Prompt',
        sub:         'Used by AI EXPLAIN button on each question',
        icon:        <Brain size={16} color="#7c3aed" />,
        value:       explainPrompt,
        setter:      setExplainPrompt,
        placeholder: '{{question}}, {{options}}, {{correct_answer}} are the available variables',
      },
      {
        key:         'summarize' as const,
        label:       'Summarize Prompt',
        sub:         'Used by ✨ SUMMARIZE INTO BULLETS button',
        icon:        <Sparkles size={16} color="#f59e0b" />,
        value:       summarizePrompt,
        setter:      setSummarizePrompt,
        placeholder: '{{explanation}} is the available variable',
      },
      {
        key:         'search' as const,
        label:       'Search Prompt',
        sub:         'Used by AI Search tab to expand your query',
        icon:        <Search size={16} color={colors.primary} />,
        value:       searchPrompt,
        setter:      setSearchPrompt,
        placeholder: '{{query}} is the available variable',
      },
    ] as const
  ).map((item, idx, arr) => (
    <View
      key={item.key}
      style={idx < arr.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : {}}
    >
      {/* Collapsed header row — tap to expand */}
      <TouchableOpacity
        onPress={() => setExpandedPrompt(expandedPrompt === item.key ? null : item.key)}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}
        testID={`ai-prompt-row-${item.key}`}
      >
        {item.icon}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
            {item.label}
          </Text>
          <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 1 }}>
            {item.sub}
          </Text>
        </View>
        {expandedPrompt === item.key
          ? <ChevronUp size={16} color={colors.textTertiary} />
          : <ChevronDown size={16} color={colors.textTertiary} />
        }
      </TouchableOpacity>

      {/* Expanded editor */}
      {expandedPrompt === item.key && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
          <Text style={{ fontSize: 10, color: colors.textTertiary, marginBottom: 6, fontWeight: '700' }}>
            AVAILABLE VARIABLES: {item.placeholder}
          </Text>
          <TextInput
            value={item.value}
            onChangeText={item.setter}
            multiline
            numberOfLines={10}
            textAlignVertical="top"
            autoCorrect={false}
            autoCapitalize="none"
            style={{
              backgroundColor: colors.bg,
              borderWidth: 1, borderColor: colors.border,
              borderRadius: 10, padding: 12,
              fontSize: 12, color: colors.textPrimary,
              lineHeight: 18, minHeight: 180,
              fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
            }}
            testID={`ai-prompt-editor-${item.key}`}
          />
          {/* Reset to default button */}
          <TouchableOpacity
            onPress={() => resetPrompt(item.key)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}
            testID={`ai-prompt-reset-${item.key}`}
          >
            <RotateCcw size={12} color={colors.textTertiary} />
            <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '700' }}>
              Reset to default
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  ))}
</View>

{/* Save all AI settings button */}
<TouchableOpacity
  onPress={saveAiSettings}
  disabled={promptSaving}
  style={{
    marginTop: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
    backgroundColor: promptSaved ? '#22c55e' : '#7c3aed',
    opacity: promptSaving ? 0.6 : 1,
  }}
  testID="ai-settings-save"
>
  {promptSaving
    ? <ActivityIndicator size="small" color="#fff" />
    : <Brain size={16} color="#fff" />
  }
  <Text style={{ fontSize: 14, fontWeight: '900', color: '#fff' }}>
    {promptSaved ? '✓ Saved!' : 'Save AI Settings'}
  </Text>
</TouchableOpacity>
```

---

## STEP 3 — Make GeminiService read the API key from AsyncStorage

**File:** `src/services/GeminiService.ts`

Replace the static key line with a dynamic read:

```typescript
// OLD (delete this):
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const FLASH_URL = `...?key=${GEMINI_API_KEY}`;

// NEW:
async function getFlashUrl(): Promise<string> {
  let key = '';
  try {
    key = (await AsyncStorage.getItem('gemini_api_key')) || '';
  } catch {}
  if (!key) key = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
  if (!key) throw new Error('No Gemini API key found. Go to Settings → AI Settings and paste your key.');
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
}

// Update callGemini to use getFlashUrl():
async function callGemini(prompt: string, maxTokens = 600): Promise<string> {
  const url = await getFlashUrl();   // <-- replaces static FLASH_URL
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
```

---

## VERIFICATION CHECKLIST

- [ ] Profile screen shows "AI SETTINGS" section between SETTINGS and DATA & OFFLINE
- [ ] Gemini API Key field is masked (secureTextEntry) and accepts paste
- [ ] Three prompt rows appear, each collapsed by default
- [ ] Tapping a row expands/collapses the text editor
- [ ] The monospace text editor shows the full current prompt
- [ ] Variables hint is shown above each editor (e.g. "{{question}}, {{options}}, {{correct_answer}}")
- [ ] "Reset to default" button restores the original prompt text
- [ ] "Save AI Settings" button turns green briefly on success
- [ ] After saving, AI Explain in quiz engine uses the new custom prompt
- [ ] If API key field is empty and no env var set, AI buttons show a clear "Go to Settings → AI Settings" error

---

## NOTES FOR EMERGENT.SH

1. `AsyncStorage` is already imported in `app/profile.tsx` — do not add it again.
2. `Platform` is already imported in `profile.tsx` — used for the monospace font.
3. `ActivityIndicator` is already imported in `profile.tsx`.
4. `Alert` is already imported in `profile.tsx`.
5. The `Row` component already exists in `profile.tsx` — the AI section does NOT use
   `Row` because it needs expandable editors, not simple rows. Use the raw JSX above.
6. Do NOT remove the `.env` `EXPO_PUBLIC_GEMINI_API_KEY` support — it is the fallback
   when the user hasn't pasted a key in settings yet.
