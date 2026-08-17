import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

mains_path = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\app\mains.tsx"

with open(mains_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Fix list_item rule in getMarkdownRules so ordered list item numbers (1., 2., 3., 4.) ALWAYS display
old_list_item = """  list_item: (node: any, children: any, parentNodes: any) => {
    const isOrdered = parentNodes[parentNodes.length - 1]?.type === 'ordered_list';
    const listParents = parentNodes.filter((n: any) => n.type === 'bullet_list' || n.type === 'ordered_list');
    const depth = listParents.length;

    const bulletSymbols = ['•', '◦', '▪', '–'];
    const isOrderedList = parentNodes[parentNodes.length - 1]?.type === 'ordered_list';
    let bulletSymbol = bulletSymbols[Math.min(Math.max(depth - 1, 0), bulletSymbols.length - 1)];
    if (isOrderedList) {
      const idx = node.index !== undefined ? node.index + 1 : 1;
      bulletSymbol = `${idx}.`;
    }
    const indent = Math.max(0, depth - 1) * 14;
    const textColor = colors.textPrimary || (isDark ? '#f3f4f6' : '#111827');

    if (isOrdered) {
      const index = node.index !== undefined ? node.index + 1 : 1;
      return (
        <View key={node.key} style={{ flexDirection: 'row', alignItems: 'flex-start', marginVertical: 2, marginLeft: indent }}>
          <Text style={{ width: 22, fontSize: 13.5, lineHeight: 21, fontWeight: '700', color: textColor }}>
            {index}.
          </Text>
          <View style={{ flex: 1 }}>{children}</View>
        </View>
      );
    }

    return (
      <View key={node.key} style={{ flexDirection: 'row', alignItems: 'flex-start', marginVertical: 2, marginLeft: indent }}>
        <Text style={{ width: 16, fontSize: depth === 2 ? 14 : 11, lineHeight: 21, fontWeight: depth === 1 ? '900' : '700', color: textColor, textAlign: 'center' }}>
          {bulletSymbol}
        </Text>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  },"""

new_list_item = """  list_item: (node: any, children: any, parentNodes: any = []) => {
    const listParents = (parentNodes || []).filter((n: any) => n && (n.type === 'bullet_list' || n.type === 'ordered_list'));
    const depth = Math.max(1, listParents.length);
    const lastParent = listParents[listParents.length - 1];
    const isOrdered = lastParent?.type === 'ordered_list' || node?.index !== undefined;

    const indent = Math.max(0, depth - 1) * 14;
    const textColor = colors.textPrimary || (isDark ? '#f3f4f6' : '#111827');

    if (isOrdered) {
      const index = node.index !== undefined ? node.index + 1 : (node.attributes?.index ?? 1);
      return (
        <View key={node.key} style={{ flexDirection: 'row', alignItems: 'flex-start', marginVertical: 2.5, marginLeft: indent }}>
          <Text style={{ width: 24, fontSize: 13.5, lineHeight: 21, fontWeight: '700', color: textColor }}>
            {index}.
          </Text>
          <View style={{ flex: 1 }}>{children}</View>
        </View>
      );
    }

    const bulletSymbols = ['•', '◦', '▪', '–'];
    const bulletSymbol = bulletSymbols[Math.min(depth - 1, bulletSymbols.length - 1)];

    return (
      <View key={node.key} style={{ flexDirection: 'row', alignItems: 'flex-start', marginVertical: 2.5, marginLeft: indent }}>
        <Text style={{ width: 18, fontSize: depth === 2 ? 14 : 11, lineHeight: 21, fontWeight: depth === 1 ? '900' : '700', color: textColor, textAlign: 'center' }}>
          {bulletSymbol}
        </Text>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  },"""

if old_list_item in content:
    content = content.replace(old_list_item, new_list_item, 1)

# 2. Add Yellow Keyword Highlight style when keyBoxMode === 'boxed'
old_mark_replacement = """  // Replace <mark class="key-box"> tags cleanly without introducing monospace code backticks
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

new_mark_replacement = """  // Replace <mark class="key-box"> tags cleanly
  if (cleaned) {
    if (keyBoxMode === 'bold') {
      cleaned = cleaned.replace(/<mark\\s+class=["']key-box["']>(.*?)<\\/mark>/gi, '**$1**');
      cleaned = cleaned.replace(/<mark[^>]*>(.*?)<\\/mark>/gi, '**$1**');
    } else {
      // Boxed Mode: Wrap in highlighted mark syntax for yellow box
      cleaned = cleaned.replace(/<mark\\s+class=["']key-box["']>(.*?)<\\/mark>/gi, '<mark>$1</mark>');
    }
  }"""

if old_mark_replacement in content:
    content = content.replace(old_mark_replacement, new_mark_replacement, 1)

# 3. Add mark rule in getMarkdownRules for yellow keyword box highlight
old_mark_rule = """  html_inline: (node: any) => {"""
new_mark_rule = """  mark: (node: any, children: any) => (
    <View
      key={node.key}
      style={{
        backgroundColor: isDark ? 'rgba(234, 179, 8, 0.25)' : '#fef08a',
        borderWidth: 1,
        borderColor: isDark ? '#eab308' : '#ca8a04',
        borderRadius: 3,
        paddingHorizontal: 4,
        paddingVertical: 1,
        marginHorizontal: 2,
        alignSelf: 'inline',
        display: 'inline-flex'
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#fef08a' : '#854d0e' }}>
        {children}
      </Text>
    </View>
  ),
  html_inline: (node: any) => {"""

if old_mark_rule in content and "mark: (node: any" not in content:
    content = content.replace(old_mark_rule, new_mark_rule, 1)

with open(mains_path, "w", encoding="utf-8") as f:
    f.write(content)

print("[SUCCESS] Updated app/mains.tsx with fixed ordered lists and yellow keyword box highlights!")
