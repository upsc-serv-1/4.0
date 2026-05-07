import React from 'react';
import { View, ScrollView, Platform } from 'react-native';

/**
 * Build theme-aware Markdown inline styles.
 */
export function buildMarkdownStyles(
  textColor: string,
  fontSize: number,
  bgSurface: string,
  borderColor: string,
  primaryColor: string,
  fontFamily: string = 'System',
) {
  return {
    body: {
      color: textColor,
      fontSize,
      lineHeight: fontSize * 1.55,
      fontWeight: '500' as const,
      fontFamily,
    },
    paragraph: {
      marginTop: 4,
      marginBottom: 4,
    },
    heading1: { fontSize: fontSize + 6, fontWeight: '900' as const, color: textColor, marginTop: 12, marginBottom: 6 },
    heading2: { fontSize: fontSize + 4, fontWeight: '800' as const, color: textColor, marginTop: 10, marginBottom: 5 },
    heading3: { fontSize: fontSize + 2, fontWeight: '700' as const, color: textColor, marginTop: 8, marginBottom: 4 },
    strong: { fontWeight: '800' as const },
    em: { fontStyle: 'italic' as const },
    list_item: { flexDirection: 'row' as const, marginBottom: 4 },
    bullet_list: { marginBottom: 12 },
    ordered_list: { marginBottom: 12 },
    code_inline: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: primaryColor + '15', color: primaryColor, paddingHorizontal: 4, borderRadius: 4, fontSize: fontSize - 1 },
    code_block: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: bgSurface, padding: 12, borderRadius: 8, marginBottom: 12 },
    table: { borderWidth: 1, borderColor, borderRadius: 8, overflow: 'hidden' as const, marginBottom: 12, minWidth: '100%' },
    th: { backgroundColor: primaryColor + '18', padding: 8, borderWidth: 1, borderColor },
    td: { padding: 8, borderWidth: 1, borderColor },
    tr: {},
  };
}

/**
 * Build custom render rules that produce properly scrollable tables.
 */
export function buildMarkdownRules(borderColor: string, primaryColor: string, textColor: string, fontSize: number) {
  return {
    table: (node: any, children: any) => (
      <ScrollView key={node.key} horizontal showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: '100%' }} style={{ marginVertical: 8 }}>
        <View style={{ borderWidth: 1, borderColor, borderRadius: 8, overflow: 'hidden', minWidth: 280 }}>
          {children}
        </View>
      </ScrollView>
    ),
    thead: (node: any, children: any) => (
      <View key={node.key} style={{ backgroundColor: primaryColor + '18', borderBottomWidth: 1, borderBottomColor: borderColor }}>{children}</View>
    ),
    tbody: (node: any, children: any) => (
      <View key={node.key}>{children}</View>
    ),
    tr: (node: any, children: any) => (
      <View key={node.key} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: borderColor }}>{children}</View>
    ),
    th: (node: any, children: any) => (
      <View key={node.key} style={{ flex: 1, padding: 8, borderRightWidth: 1, borderRightColor: borderColor, justifyContent: 'center' }}>{children}</View>
    ),
    td: (node: any, children: any) => (
      <View key={node.key} style={{ flex: 1, padding: 8, borderRightWidth: 1, borderRightColor: borderColor }}>{children}</View>
    )
  };
}
