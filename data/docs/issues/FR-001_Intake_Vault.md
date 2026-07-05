# [FR-001] Intake Vault (Smart Paste Box)

## Labels
`MUS`, `enhancement`, `intake`

## User Story
As a clinical researcher, I want to paste raw text containing an AI-generated JSON structure into a single textarea box, so that the application extracts the JSON block, parses the keys, and auto-populates the medical form fields without crashing if there is extra conversational text, comments, or formatting errors.

## Proposed Solution

### Overview
We will create a component `IntakeVault` containing a large textarea box and an "Auto-Fill Form" button. The component will process the input using a robust parsing utility (`src/utils/parser.ts`) to extract the valid JSON and update the parent form's state.

### Implementation Flow
1. Create a regex-based parser that isolates text inside curly braces `{ ... }` to handle cases where Gemini or ChatGPT prefixes or suffixes the JSON with conversational text.
2. Strip markdown code fences (e.g., ` ```json ` and ` ``` `).
3. Try standard `JSON.parse`.
4. If it fails, run secondary sanitization (e.g., replacing smart curly quotes with normal double quotes, resolving common trailing commas, or stripping line-level comment lines).
5. Normalize the JSON keys (e.g., convert camelCase or PascalCase to snake_case) and map them to the clinical proforma fields.
6. Trigger a callback that updates the React state of the parent form.
7. Display a success toast showing the number of successfully mapped fields, or a descriptive warning toast if parsing failed completely.

### Technical Approach

```typescript
// src/utils/parser.ts
export function extractAndParseJSON(inputText: string): Record<string, any> | null {
  try {
    // 1. Clean markdown code blocks
    let cleaned = inputText.replace(/```json/gi, '').replace(/```/g, '').trim();

    // 2. Extract string between first '{' and last '}'
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    // 3. Attempt parse
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Standard JSON parse failed, trying fallback sanitization...", error);
    try {
      // Fallback: Replace curly quotes and try parsing
      let sanitized = inputText
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"') // Curly quotes
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'"); // Curly single quotes
        
      const firstBrace = sanitized.indexOf('{');
      const lastBrace = sanitized.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        sanitized = sanitized.slice(firstBrace, lastBrace + 1);
      }
      return JSON.parse(sanitized);
    } catch (fallbackError) {
      console.error("Fallback parsing failed", fallbackError);
      return null;
    }
  }
}
```

## Acceptance Criteria
- [ ] Textarea accepts large text blocks (up to 50KB).
- [ ] Text containing code blocks (e.g., ` ```json { "patient_name": "Rita" } ``` `) is successfully parsed.
- [ ] Conversational introductions (e.g., "Here is the JSON structure you requested: { ... } Hope this helps!") are ignored and JSON is extracted.
- [ ] Mapped keys are merged into the form state. Unmapped or unrecognized keys are ignored silently.
- [ ] A success toast reports the number of fields filled.
- [ ] The app does not crash or throw unhandled exceptions if the pasted text is not valid JSON.
