# 🧠 UPSC Study App — AI Integration Testing Playbook

This playbook provides a detailed, step-by-step checklist to smoke-test and verify all **6 Phases of the AI Integration** directly on your iPad or testing device.

---

## 📋 Phase 1 & 4: Prompt Templates & Custom Buttons
* **Purpose**: Tests creating, saving, and editing custom AI prompt presets.
* **Steps**:
  1. Open the app and navigate to **AI Settings** (accessible from the sidebar or profile section).
  2. Scroll down to the **AI PROMPT TEMPLATES** section.
  3. Tap the **`+ Add`** button in the top right.
  4. Create a test button:
     * **Name**: `Quick Summary`
     * **Button Label**: `Summary`
     * **Emoji**: `📝`
     * **Prompt Text**: `Summarize {{question}} into 3 short bullet points.`
  5. Tap **`+ Save Template`**.
  6. **Expected Result**: The modal closes, and your new `📝 Summary` button immediately appears under the active category without any database errors.

---

## 📋 Phase 2: Multi-Model AI Provider Selector
* **Purpose**: Tests switching AI engines and API credentials dynamically.
* **Steps**:
  1. Go to **AI Settings**.
  2. Tap on the **AI Provider** dropdown and toggle between **Gemini**, **Groq**, and **OpenRouter**.
  3. Under **Model**, select a model preset (e.g., `gemini-2.0-flash` or `llama-3.3-70b-versatile`).
  4. Tap the **`Save AI Settings`** button at the bottom.
  5. **Expected Result**: The button displays a green **`✓ Saved!`** state, and the app adapts to the newly selected AI model.

---

## 📋 Phase 3: AI Explanation Chat ("Ask AI")
* **Purpose**: Tests rich chat dialogues, preset buttons, dynamic templates, and rating feedback on quiz questions.
* **Steps**:
  1. Go to the **Quiz** tab and attempt a question, or open an already completed quiz question.
  2. Under the explanation card, tap **`💬 Ask AI (ELI5 / Chat)`**.
  3. **Expected Result**: The AI chat overlay panel expands, showcasing your category quick-action buttons (including any custom ones you added).
  4. Tap the **`ELI5`** button.
     * **Expected Result**: The AI responds with a simplified, analogy-driven explanation.
  5. Type a follow-up question (e.g., *"give me an example of this"*) in the input bar and send it.
     * **Expected Result**: The AI replies seamlessly while retaining your previous conversation history (multi-turn conversation).
  6. Rate the answer by tapping **`4` or `5 stars`** on the feedback bar and click **`Save Vitamin`**.
     * **Expected Result**: A success indicator confirms that the explanation was saved to your "Vitamins" log in Supabase.

---

## 📋 Phase 5: Global AI Buttons Across All Screens
* **Purpose**: Tests specialized AI shortcuts tailored for different modules of the app.
* **Steps**:
  * **Screen A: Notes Editor** (`app/notes/editor.tsx`):
    * Create or open a note.
    * Tap the purple floating **`✨ AI` FAB button**.
    * **Expected Result**: Opens a menu offering to `Summarize`, `Generate Tags`, or `Ask questions` based on your note text.
  * **Screen B: Tags Screen** (`app/tags.tsx`):
    * Go to Tags, select any subject, and tap **`✨ Ask AI about this subject`**.
    * **Expected Result**: The AI returns a conceptual breakdown of that subject tag.
  * **Screen C: Analysis Screen** (`app/analyse.tsx`):
    * Go to the Analysis/Performance tab and tap **`📊 AI Performance Insights`**.
    * **Expected Result**: The AI reads your test scores and outlines weak areas to prioritize.
  * **Screen D: Syllabus Screen** (`app/tracker.tsx`):
    * In the Syllabus tracker, tap **`📅 AI Plan`** next to any topic.
    * **Expected Result**: The AI suggests a custom study schedule for that topic.

---

## 📋 Phase 6: Backend AI Proxy & Fast Resolver
* **Purpose**: Tests that requests run safely through your server's Universal LLM proxy keys when you don't enter custom keys.
* **Steps**:
  1. In **AI Settings**, temporarily delete your custom API keys so the text fields are blank.
  2. Tap **`Save AI Settings`**.
  3. Go to any quiz question and ask a question.
  4. **Expected Result**: The AI still answers successfully! This verifies that your secure backend LLM proxy is operational.

---

## 🔄 How to Reset Templates to Default
* **Purpose**: Restores default presets if your custom configurations become cluttered.
* **Steps**:
  1. In **AI Settings**, go to **AI Prompt Templates**.
  2. Tap the red **`Reset`** button.
  3. Confirm the action in the native dialog.
  4. **Expected Result**: Your custom template overrides for that category are deleted, and default buttons (like *ELI5*, *Why Wrong*, *Concept*) are restored.
