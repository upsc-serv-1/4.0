# AI Enhancement Progress Tracker
## UPSC Prep App - Pilot Pro 1.0

**Last Updated:** May 8, 2026
**Branch:** Pilot-Pro-1.0

---

## ✅ COMPLETED STEPS

### Environment Setup
- [x] Cloned Pilot-Pro-1.0 branch from GitHub
- [x] Copied all app source files (app/, src/, assets/) into Emergent environment
- [x] Installed all required packages (supabase, MMKV, lucide, zustand, etc.)
- [x] Configured environment variables (Supabase URL, anon key, Emergent LLM key)
- [x] Set up git remote pointing to user's GitHub repo

---

## 🔄 IN PROGRESS

### Phase 1: Dynamic Prompt Management System
- [ ] Create Supabase SQL migration for new tables (prompt_templates, conversation_history, vitamin_versions, ai_settings)
- [ ] Implement AIPromptManager.ts service
- [ ] Wire AIPromptManager to existing codebase

### Phase 2: Enhanced GeminiService
- [ ] Add generateWithHistory() function (multi-turn chat)
- [ ] Add generateGeminiWithHistory(), generateGroqWithHistory(), generateOpenRouterWithHistory()
- [ ] Add PROMPT_TEMPLATES constants

### Phase 3: AIExplanationChat Component
- [ ] Create src/components/unified/AIExplanationChat.tsx
- [ ] Add quick action buttons (ELI5, Why Wrong, Concept, etc.)
- [ ] Add chat interface with message history
- [ ] Add vitamin save functionality with star rating
- [ ] Copy-to-clipboard support

### Phase 4: AI Settings Screen Enhancement
- [ ] Add Prompt Templates tab to existing ai-settings.tsx
- [ ] CRUD UI for templates (create, edit, delete)
- [ ] Category selector (quiz, notes, tags, analysis, syllabus)

### Phase 5: Integration Into All Tabs
- [ ] Quiz Tab: Wire AIExplanationChat into unified/arena.tsx and review/[aid].tsx
- [ ] Notes Tab: Add summarize and generate-questions buttons
- [ ] Tags Tab: Add explain-concept button
- [ ] Analysis Tab: Add performance insight button
- [ ] Syllabus Tab: Add study plan button

---

## ⏳ PENDING

- [ ] Supabase RLS policies for new tables
- [ ] Testing all AI flows end-to-end
- [ ] Vitamin multiversion UI
- [ ] Export vitamins as study guide

---

## 📋 SUPABASE TABLES TO CREATE

```sql
-- Run these in Supabase SQL editor

CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_name VARCHAR(100) NOT NULL,
  template_key VARCHAR(100) NOT NULL,
  button_label VARCHAR(50) NOT NULL,
  button_emoji VARCHAR(10),
  prompt_text TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, template_key)
);

CREATE TABLE conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id VARCHAR(100) NOT NULL,
  message_role VARCHAR(20) NOT NULL,
  message_content TEXT NOT NULL,
  template_used VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE vitamin_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id VARCHAR(100) NOT NULL,
  explanation_content TEXT NOT NULL,
  template_used VARCHAR(100),
  prompt_template_name VARCHAR(100),
  rating INT DEFAULT 0,
  tags TEXT[],
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_provider VARCHAR(50) DEFAULT 'gemini',
  gemini_model VARCHAR(100) DEFAULT 'gemini-2.0-flash',
  groq_model VARCHAR(100) DEFAULT 'llama-3.3-70b-versatile',
  enable_conversation_history BOOLEAN DEFAULT true,
  max_history_messages INT DEFAULT 10,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX idx_prompt_templates_user ON prompt_templates(user_id);
CREATE INDEX idx_conversation_history_user_question ON conversation_history(user_id, question_id);
CREATE INDEX idx_vitamin_versions_user_question ON vitamin_versions(user_id, question_id);

-- RLS Policies
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitamin_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their prompt templates" ON prompt_templates FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their conversations" ON conversation_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their vitamins" ON vitamin_versions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their ai settings" ON ai_settings FOR ALL USING (auth.uid() = user_id);
```

---

## 🔧 NEXT AGENT INSTRUCTIONS

If this session ends before completion, continue from here:

1. Check PROGRESS.md to see what's done
2. All source files are in /app/frontend/src/
3. App routes are in /app/frontend/app/
4. Supabase client is in /app/frontend/src/lib/supabase.ts
5. GeminiService is in /app/frontend/src/services/GeminiService.ts
6. Keys: EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY in /app/frontend/.env
7. Git remote: github.com/upsc-serv-1/4.0.git (branch: Pilot-Pro-1.0) — use PAT from user
8. Emergent LLM Key: stored in EXPO_PUBLIC_EMERGENT_LLM_KEY env var
