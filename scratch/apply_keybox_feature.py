import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

mains_path = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\app\mains.tsx"

with open(mains_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update cleanMarkdownContent to accept keyBoxMode and transform <mark class="key-box">
target_clean_func = "const cleanMarkdownContent = (text: string | undefined | null"
replacement_clean_func = "const cleanMarkdownContent = (text: string | undefined | null, keyBoxMode: 'boxed' | 'bold' = 'boxed'"

if target_clean_func in content:
    content = content.replace(target_clean_func, replacement_clean_func, 1)

# Add mark tag transformation inside cleanMarkdownContent
mark_transform_code = """  // Replace <mark class="key-box"> tags
  if (cleaned) {
    if (keyBoxMode === 'bold') {
      cleaned = cleaned.replace(/<mark\\s+class=["']key-box["']>(.*?)<\\/mark>/gi, '**$1**');
      cleaned = cleaned.replace(/<mark[^>]*>(.*?)<\\/mark>/gi, '**$1**');
    } else {
      cleaned = cleaned.replace(/<mark\\s+class=["']key-box["']>(.*?)<\\/mark>/gi, '` $1 `');
      cleaned = cleaned.replace(/<mark[^>]*>(.*?)<\\/mark>/gi, '` $1 `');
    }
  }"""

pos_entities = content.find("// Replace HTML entities")
if pos_entities != -1 and "Replace <mark class=\"key-box\">" not in content:
    content = content[:pos_entities] + mark_transform_code + "\n\n  " + content[pos_entities:]

# Update cleanMarkdown wrapper
target_clean_md = "const cleanMarkdown = (text: string)"
replacement_clean_md = "const cleanMarkdown = (text: string, keyBoxMode: 'boxed' | 'bold' = 'boxed')"

if target_clean_md in content:
    content = content.replace(target_clean_md, replacement_clean_md)

content = content.replace("cleanMarkdownContent(text)", "cleanMarkdownContent(text, keyBoxMode)")

# 2. Add keyBoxMode state to MainsView
target_state_anchor = "const [textColorMode, setTextColorMode] = useState<'default' | 'black'>('default');"
keybox_state_code = """const [textColorMode, setTextColorMode] = useState<'default' | 'black'>('default');
  const [keyBoxMode, setKeyBoxMode] = useState<'boxed' | 'bold'>('boxed');

  useEffect(() => {
    AsyncStorage.getItem('@mains_key_box_mode')
      .then(val => {
        if (val === 'boxed' || val === 'bold') {
          setKeyBoxMode(val as any);
        }
      })
      .catch(() => {});
  }, []);

  const handleUpdateKeyBoxMode = (mode: 'boxed' | 'bold') => {
    setKeyBoxMode(mode);
    AsyncStorage.setItem('@mains_key_box_mode', mode).catch(() => {});
  };"""

if target_state_anchor in content and "setKeyBoxMode" not in content:
    content = content.replace(target_state_anchor, keybox_state_code, 1)

# 3. Add KeyBox controls to MainsLeftPanel Props
target_panel_props = "textColorMode?: 'default' | 'black';\n  onChangeTextColorMode?: (mode: 'default' | 'black') => void;"
replacement_panel_props = """textColorMode?: 'default' | 'black';
  onChangeTextColorMode?: (mode: 'default' | 'black') => void;
  keyBoxMode?: 'boxed' | 'bold';
  onChangeKeyBoxMode?: (mode: 'boxed' | 'bold') => void;"""

if target_panel_props in content:
    content = content.replace(target_panel_props, replacement_panel_props)

target_panel_args = "textColorMode = 'default',\n  onChangeTextColorMode,"
replacement_panel_args = """textColorMode = 'default',
  onChangeTextColorMode,
  keyBoxMode = 'boxed',
  onChangeKeyBoxMode,"""

if target_panel_args in content:
    content = content.replace(target_panel_args, replacement_panel_args)

# 4. Add KEYWORD BOXES UI toggle right under TEXT READABILITY in MainsLeftPanel
sidebar_text_readability_end = "Muted Grey\n            </Text>\n          </TouchableOpacity>\n          <TouchableOpacity\n            onPress={() => onChangeTextColorMode?.('black')}"

sidebar_keybox_ui = """
        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans-Bold', fontWeight: '900', color: colors.textTertiary + '99', letterSpacing: 1.5, marginTop: 14, marginBottom: 8 }}>
          KEYWORD BOXES
        </Text>
        <View style={{ flexDirection: 'row', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderRadius: 8, padding: 3, gap: 4 }}>
          <TouchableOpacity
            onPress={() => onChangeKeyBoxMode?.('boxed')}
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: 'center',
              borderRadius: 6,
              backgroundColor: keyBoxMode === 'boxed' ? (isDark ? '#334155' : '#ffffff') : 'transparent',
              ...Platform.select({
                ios: keyBoxMode === 'boxed' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 } : {},
                android: keyBoxMode === 'boxed' ? { elevation: 1 } : {},
              }),
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: keyBoxMode === 'boxed' ? colors.primary : colors.textSecondary }}>
              Boxed
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onChangeKeyBoxMode?.('bold')}
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: 'center',
              borderRadius: 6,
              backgroundColor: keyBoxMode === 'bold' ? (isDark ? '#334155' : '#ffffff') : 'transparent',
              ...Platform.select({
                ios: keyBoxMode === 'bold' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 } : {},
                android: keyBoxMode === 'bold' ? { elevation: 1 } : {},
              }),
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: keyBoxMode === 'bold' ? (isDark ? '#ffffff' : '#000000') : colors.textSecondary }}>
              Plain Bold
            </Text>
          </TouchableOpacity>
        </View>"""

pos_black_btn = content.find("onChangeTextColorMode?.('black')")
if pos_black_btn != -1 and "KEYWORD BOXES" not in content:
    pos_btn_end = content.find("</TouchableOpacity>", pos_black_btn)
    if pos_btn_end != -1:
        pos_view_end = content.find("</View>", pos_btn_end)
        if pos_view_end != -1:
            content = content[:pos_view_end+7] + sidebar_keybox_ui + content[pos_view_end+7:]

# Pass keyBoxMode down to sub-components
content = content.replace("onChangeTextColorMode={handleUpdateTextColorMode}", "onChangeTextColorMode={handleUpdateTextColorMode}\n              keyBoxMode={keyBoxMode}\n              onChangeKeyBoxMode={handleUpdateKeyBoxMode}")
content = content.replace("cleanMarkdown(activeAnswer.answerText)", "cleanMarkdown(activeAnswer.answerText, keyBoxMode)")
content = content.replace("cleanMarkdown(activeAnswer.answerText.replace(parsed.rawMatch, '').trim())", "cleanMarkdown(activeAnswer.answerText.replace(parsed.rawMatch, '').trim(), keyBoxMode)")

with open(mains_path, "w", encoding="utf-8") as f:
    f.write(content)

print("[SUCCESS] Updated app/mains.tsx with Keyword Box toggle and renderer!")
