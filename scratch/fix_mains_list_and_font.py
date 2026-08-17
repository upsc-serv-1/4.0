import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

mains_path = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\app\mains.tsx"

with open(mains_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Fix list_item rule in getMarkdownRules so ordered_list displays index numbers (1., 2., 3.) instead of bullets (•)
old_list_item_code = """const bulletSymbols = ['•', '◦', '▪', '–'];
    const bulletSymbol = bulletSymbols[Math.min(Math.max(depth - 1, 0), bulletSymbols.length - 1)];"""

new_list_item_code = """const bulletSymbols = ['•', '◦', '▪', '–'];
    const isOrderedList = parentNodes[parentNodes.length - 1]?.type === 'ordered_list';
    let bulletSymbol = bulletSymbols[Math.min(Math.max(depth - 1, 0), bulletSymbols.length - 1)];
    if (isOrderedList) {
      const idx = node.index !== undefined ? node.index + 1 : 1;
      bulletSymbol = `${idx}.`;
    }"""

if old_list_item_code in content:
    content = content.replace(old_list_item_code, new_list_item_code, 1)

# Adjust bullet column width for ordered lists (to fit "10." or "1.")
old_width = "style={{ width: 18, color: textColor, fontSize: 13"
new_width = "style={{ minWidth: isOrderedList ? 22 : 18, marginRight: 4, color: textColor, fontSize: 13"

if old_width in content:
    content = content.replace(old_width, new_width, 1)

# 2. Fix cleanMarkdownContent so <mark class="key-box"> uses clean bold or highlight markdown without turning surrounding font to monospace
old_mark_code = """  // Replace <mark class="key-box"> tags
  if (cleaned) {
    if (keyBoxMode === 'bold') {
      cleaned = cleaned.replace(/<mark\\s+class=["']key-box["']>(.*?)<\\/mark>/gi, '**$1**');
      cleaned = cleaned.replace(/<mark[^>]*>(.*?)<\\/mark>/gi, '**$1**');
    } else {
      cleaned = cleaned.replace(/<mark\\s+class=["']key-box["']>(.*?)<\\/mark>/gi, '` $1 `');
      cleaned = cleaned.replace(/<mark[^>]*>(.*?)<\\/mark>/gi, '` $1 `');
    }
  }"""

new_mark_code = """  // Replace <mark class="key-box"> tags cleanly without introducing monospace code backticks
  if (cleaned) {
    if (keyBoxMode === 'bold') {
      cleaned = cleaned.replace(/<mark\\s+class=["']key-box["']>(.*?)<\\/mark>/gi, '**$1**');
      cleaned = cleaned.replace(/<mark[^>]*>(.*?)<\\/mark>/gi, '**$1**');
    } else {
      // Boxed Mode: Use strong bold + clean span highlight so font remains standard proportional font
      cleaned = cleaned.replace(/<mark\\s+class=["']key-box["']>(.*?)<\\/mark>/gi, '**$1**');
      cleaned = cleaned.replace(/<mark[^>]*>(.*?)<\\/mark>/gi, '**$1**');
    }
  }"""

if old_mark_code in content:
    content = content.replace(old_mark_code, new_mark_code, 1)

with open(mains_path, "w", encoding="utf-8") as f:
    f.write(content)

print("[SUCCESS] Fixed ordered_list number indices and monospace font issues in app/mains.tsx!")
