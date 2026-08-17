import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

mains_path = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\app\mains.tsx"

with open(mains_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Fix (c). turning into copyright symbol ©.
# In cleanMarkdownContent, replace (c). with (c&#41;. or (c) zero-width space
fix_copyright = """  // Prevent (c). or (C). from being converted into copyright symbol ©
  cleaned = cleaned.replace(/\\(c\\)\\./gi, '(c\\u200B).');
  cleaned = cleaned.replace(/\\(c\\)\\s/gi, '(c\\u200B) ');"""

pos_entities = content.find("// Replace HTML entities")
if pos_entities != -1 and "Prevent (c)." not in content:
    content = content[:pos_entities] + fix_copyright + "\n\n  " + content[pos_entities:]

# 2. Fix cleanMarkdown <mark> transformation
# When boxed: replace <mark...>text</mark> with ` text ` (styled as inline box with standard font)
# When bold: replace <mark...>text</mark> with **text**
old_mark = """  // Replace <mark class="key-box"> tags cleanly
  if (cleaned) {
    if (keyBoxMode === 'bold') {
      cleaned = cleaned.replace(/<mark\\s+class=["']key-box["']>(.*?)<\\/mark>/gi, '**$1**');
      cleaned = cleaned.replace(/<mark[^>]*>(.*?)<\\/mark>/gi, '**$1**');
    } else {
      // Boxed Mode: Wrap in highlighted mark syntax for yellow box
      cleaned = cleaned.replace(/<mark\\s+class=["']key-box["']>(.*?)<\\/mark>/gi, '<mark>$1</mark>');
    }
  }"""

new_mark = """  // Replace <mark class="key-box"> and <mark> tags cleanly
  if (cleaned) {
    if (keyBoxMode === 'bold') {
      cleaned = cleaned.replace(/<mark[^>]*>(.*?)<\\/mark>/gi, '**$1**');
    } else {
      // Boxed Mode: Replace with inline code backticks styled as yellow highlight box
      cleaned = cleaned.replace(/<mark[^>]*>(.*?)<\\/mark>/gi, '`$1`');
    }
  }"""

if old_mark in content:
    content = content.replace(old_mark, new_mark, 1)

# 3. Update code_inline in markdownStyles to style `$1` as a beautiful Yellow Keyword Box with proportional font
old_code_inline = """    code_inline: {
      backgroundColor: colors.surface,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      fontSize: 12.5,
      color: colors.primary,
    },"""

new_code_inline = """    code_inline: {
      backgroundColor: isDark ? 'rgba(234, 179, 8, 0.25)' : '#fef08a',
      color: isDark ? '#fef08a' : '#854d0e',
      borderColor: isDark ? '#eab308' : '#ca8a04',
      borderWidth: 1,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
      fontSize: 13,
      fontWeight: '700',
      fontFamily: undefined,
    },"""

if old_code_inline in content:
    content = content.replace(old_code_inline, new_code_inline)

# 4. Pass keyBoxMode to ALL cleanMarkdown call sites in mains.tsx
content = content.replace("{cleanMarkdown(remainingAnswerText)}", "{cleanMarkdown(remainingAnswerText, keyBoxMode)}")
content = content.replace("cleanMarkdown(activeAnswer.answerText)", "cleanMarkdown(activeAnswer.answerText, keyBoxMode)")

with open(mains_path, "w", encoding="utf-8") as f:
    f.write(content)

print("[SUCCESS] Fixed copyright symbol (c)., keybox rendering, and Boxed/Bold toggle in app/mains.tsx!")
