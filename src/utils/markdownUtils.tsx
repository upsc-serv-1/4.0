import React from 'react';
import { View, ScrollView, Platform, Image as RNImage } from 'react-native';
import { MediaCacheService } from '../services/MediaCacheService';

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
  // Uniform heading sizes - all explanations render consistently
  const headingSize = fontSize + 1;
  
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
    heading1: { fontSize: headingSize, fontWeight: '700' as const, color: textColor, marginTop: 8, marginBottom: 4 },
    heading2: { fontSize: headingSize, fontWeight: '700' as const, color: textColor, marginTop: 8, marginBottom: 4 },
    heading3: { fontSize: headingSize, fontWeight: '700' as const, color: textColor, marginTop: 8, marginBottom: 4 },
    strong: { fontWeight: '800' as const },
    em: { fontStyle: 'italic' as const },
    list_item: { flexDirection: 'row' as const, marginBottom: 4 },
    bullet_list: { marginBottom: 12 },
    ordered_list: { marginBottom: 12 },
    code_inline: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: primaryColor + '15', color: primaryColor, paddingHorizontal: 4, borderRadius: 4, fontSize: fontSize - 1 },
    code_block: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: bgSurface, padding: 12, borderRadius: 8, marginBottom: 12 },
    table: { borderWidth: 1, borderColor, borderRadius: 8, overflow: 'hidden' as const, marginBottom: 12 },
    th: { backgroundColor: primaryColor + '18', padding: 8, borderWidth: 1, borderColor },
    td: { padding: 8, borderWidth: 1, borderColor },
    tr: {},
  };
}

/**
 * Build custom render rules that produce properly scrollable tables.
 *
 * Also installs the `image` rule, which is what makes answer images work in
 * airplane mode:
 *   • If the URL was cached during the Download's media phase, it renders from
 *     the local `file://` path — zero network.
 *   • Otherwise it renders the remote URL (online case, unchanged) and asks
 *     MediaCacheService to cache it in the background for next time. That lazy
 *     path is the safety net for URLs added after the last Download.
 *
 * Media lives on Cloudflare/R2, so even the remote render does not touch
 * Supabase egress.
 */
export function buildMarkdownRules(borderColor: string, primaryColor: string, textColor: string, fontSize: number) {
  return {
    image: (node: any) => {
      const src = String(node?.attributes?.src || '');
      if (!src) return null;

      // Cached URLs resolve to a local file; unknown ones stay remote and get
      // queued for lazy caching.
      const resolved = MediaCacheService.resolveUri(src);
      if (resolved === src && /^https?:\/\//i.test(src)) {
        MediaCacheService.ensureCached([src]);
      }

      return (
        <RNImage
          key={node.key}
          source={{ uri: resolved }}
          style={{ width: '100%', height: 220, resizeMode: 'contain', marginVertical: 8, borderRadius: 6 }}
          resizeMode="contain"
        />
      );
    },
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
