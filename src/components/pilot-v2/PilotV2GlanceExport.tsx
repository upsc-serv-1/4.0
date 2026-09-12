y/**
 * PilotV2GlanceExport
 * --------------------
 * Standalone export modal for the Pilot V2 Glance View that generates
 * pixel-perfect PDFs with both text and pencil strokes matching exactly
 * what the user sees on screen.
 *
 * Strategy:
 *   1. Builds an HTML page where text blocks are laid out at the SAME
 *      frozen page width used in the glance view, with matching font sizes
 *      and spacing to approximate the on-screen layout.
 *   2. Pencil strokes are rendered as an SVG overlay at exact pixel
 *      positions relative to the page coordinate system.
 *   3. Since the page width is FROZEN (never changes), the export canvas
 *      matches the editor canvas, so the canvasMatch fast path in
 *      remapStrokeForExport triggers — strokes get raw relative→absolute
 *      scaling that matches exactly what the user sees on screen.
 *
 * This is completely independent of the unified export engine and does
 * not modify any shared components.
 */

import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { X, FileDown } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../../context/ThemeContext';
import { PilotV2Block, PilotV2PencilStroke } from './types';
import { remapStrokesForExport } from '../../lib/pilotV2StrokeRemap';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  blocks: PilotV2Block[];
  strokes: PilotV2PencilStroke[];
  /** Frozen page width from the glance view. */
  pageWidth: number;
  /** Content height from onLayout measurement. */
  pageHeight: number;
}

const STROKES_TO_SVG = (strokes: PilotV2PencilStroke[], W: number, H: number): string => {
  // Convert each stroke's points (0..1) to SVG path
  return strokes
    .filter((s) => s.tool !== 'eraser' && s.points?.length > 0)
    .map((s) => {
      const pts = s.points;
      if (!pts.length) return '';
      let d = `M ${(pts[0].x * W).toFixed(2)} ${(pts[0].y * H).toFixed(2)}`;
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const cur = pts[i];
        const px = prev.x * W, py = prev.y * H;
        const cx = cur.x * W, cy = cur.y * H;
        const mx = (px + cx) / 2, my = (py + cy) / 2;
        d += ` Q ${px.toFixed(2)} ${py.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
      }
      const last = pts[pts.length - 1];
      d += ` L ${(last.x * W).toFixed(2)} ${(last.y * H).toFixed(2)}`;
      const isHL = s.tool === 'highlighter';
      const alpha = isHL ? Math.round((s.opacity || 0.35) * 255).toString(16).padStart(2, '0') : '';
      const color = isHL && alpha ? `${s.color}${alpha}` : s.color;
      const width = isHL ? s.width * 1.8 : s.width;
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${isHL ? ` opacity="${s.opacity || 0.35}" style="mix-blend-mode:multiply"` : ''}/>`;
    })
    .join('');
};

const BLOCK_TO_HTML = (b: PilotV2Block, fs: number): string => {
  const text = b.text || '';
  const baseFont = `font-size:${fs}pt; line-height:${fs * 1.55}pt; color:#0F172A;`;
  const bold = b.bold ? 'font-weight:700;' : '';
  const italic = b.italic ? 'font-style:italic;' : '';
  const underline = b.underline ? 'text-decoration:underline;' : '';

  switch (b.type) {
    case 'heading': {
      const level = b.level || 2;
      const hFs = level === 1 ? fs * 1.6 : level === 2 ? fs * 1.3 : fs * 1.15;
      const mt = level === 1 ? 28 : 20;
      return `<div style="font-weight:700;font-size:${hFs}pt;line-height:${hFs * 1.4}pt;margin-top:${mt}px;margin-bottom:8px;color:#0F172A;">${text}</div>`;
    }
    case 'bullet':
      return `<div style="display:flex;flex-direction:row;gap:8px;margin:4px 0;"><span style="font-size:${fs}pt;line-height:${fs * 1.55}pt;">•</span><span style="${baseFont}${bold}${italic}${underline}">${text}</span></div>`;
    case 'numbered':
      return `<div style="display:flex;flex-direction:row;gap:8px;margin:4px 0;"><span style="font-size:${fs}pt;line-height:${fs * 1.55}pt;font-weight:600;">1.</span><span style="${baseFont}${bold}${italic}${underline}">${text}</span></div>`;
    case 'checklist': {
      const checked = b.checked ? '✓' : '';
      const checkBg = b.checked ? '#5B4EFA' : 'transparent';
      const deco = b.checked ? 'text-decoration:line-through;opacity:0.6;' : '';
      return `<div style="display:flex;flex-direction:row;gap:8px;margin:4px 0;"><span style="width:16px;height:16px;border:1.5px solid #94A3B8;border-radius:3px;background:${checkBg};color:#fff;font-size:11px;text-align:center;line-height:16px;flex-shrink:0;">${checked}</span><span style="${baseFont}${deco}${bold}${italic}${underline}">${text}</span></div>`;
    }
    case 'quote':
      return `<div style="border-left:3px solid #5B4EFA;padding-left:14px;margin:8px 0;"><span style="${baseFont}font-style:italic;color:#475569;">${text}</span></div>`;
    case 'highlight':
      return `<div style="background:#FDE68A;padding:8px 12px;border-radius:6px;margin:6px 0;"><span style="${baseFont}">${text}</span></div>`;
    case 'code':
      return `<pre style="background:#0F172A;color:#E2E8F0;padding:14px;border-radius:8px;margin:8px 0;font-family:monospace;font-size:${fs - 1}pt;line-height:${fs * 1.5}pt;overflow-x:auto;">${text}</pre>`;
    default:
      return `<div style="margin:4px 0;"><span style="${baseFont}${bold}${italic}${underline}">${text}</span></div>`;
  }
};

export const PilotV2GlanceExport: React.FC<Props> = ({
  visible, onClose, title, blocks, strokes,
  pageWidth, pageHeight,
}) => {
  const { colors } = useTheme();
  const [isExporting, setIsExporting] = useState(false);
  const [fontSize, setFontSize] = useState(11);
  const [paperBg, setPaperBg] = useState('#FFFFFF');

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const W = pageWidth > 1 ? pageWidth : 794;
      const H = pageHeight > 1 ? pageHeight + 200 : 1123;

      // Remap strokes to export-canvas coordinates using the canvasMatch fast path
      const exportStrokes = remapStrokesForExport(strokes, {
        layouts: new Map(),
        exportCanvasWidth: W,
        exportCanvasHeight: H,
        editorCanvasWidth: W,
        editorCanvasHeight: H,
      });

      const blocksHtml = blocks.map((b) => BLOCK_TO_HTML(b, fontSize)).join('');
      const strokesSvg = STROKES_TO_SVG(exportStrokes as any, W, H);

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=800, initial-scale=1">
  <style>
    @page { margin: 20px; size: A4; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, Helvetica, Arial, sans-serif;
      background: #f1f5f9;
      display: flex;
      justify-content: center;
      padding: 20px 0;
    }
    .page {
      width: ${W}px;
      min-height: ${H}px;
      background: ${paperBg};
      padding: 28px 16px 40px;
      position: relative;
      box-shadow: 0 1px 8px rgba(0,0,0,0.08);
      border-radius: 2px;
    }
    .title {
      font-size: ${fontSize * 1.6}pt;
      font-weight: 700;
      line-height: ${fontSize * 2.2}pt;
      margin-bottom: 20px;
      color: #0F172A;
    }
    .blocks {
      position: relative;
      z-index: 1;
    }
    .strokes-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: ${W}px;
      height: ${H}px;
      pointer-events: none;
      z-index: 2;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="title">${title || 'Untitled Note'}</div>
    <div class="blocks">${blocksHtml}</div>
    <svg class="strokes-overlay" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${strokesSvg}
      <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="none"/>
    </svg>
  </div>
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const safe = title.replace(/[^a-z0-9-_ ]/gi, '_').slice(0, 48) || 'pilot-v2-export';
      const dest = `${FileSystem.cacheDirectory}${safe}_${Date.now()}.pdf`;
      try { await FileSystem.moveAsync({ from: uri, to: dest }); } catch { /* ok */ }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dest, { mimeType: 'application/pdf', dialogTitle: title });
      } else {
        Alert.alert('PDF Saved', `PDF saved to: ${dest}`);
      }
    } catch (e: any) {
      Alert.alert('Export Failed', e?.message || 'An error occurred during PDF generation.');
    } finally {
      setIsExporting(false);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              Export Glance View
            </Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* Title preview */}
            <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>{title}</Text>

            {/* Font size */}
            <Text style={[styles.label, { color: colors.textTertiary }]}>Font Size</Text>
            <View style={styles.chipRow}>
              {[8, 10, 11, 12, 14, 16].map((fs) => (
                <TouchableOpacity
                  key={fs}
                  onPress={() => setFontSize(fs)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: fontSize === fs ? colors.primary : colors.surfaceStrong,
                      borderColor: fontSize === fs ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: fontSize === fs ? '#fff' : colors.textPrimary, fontWeight: '700', fontSize: 12 }}>
                    {fs}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Paper background */}
            <Text style={[styles.label, { color: colors.textTertiary, marginTop: 16 }]}>Background</Text>
            <View style={styles.chipRow}>
              {[
                { id: '#FFFFFF', label: 'White' },
                { id: '#FFFDF5', label: 'Cream' },
                { id: '#F0F9FF', label: 'Sky' },
                { id: '#FAFAFA', label: 'Gray' },
              ].map((p) => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setPaperBg(p.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: paperBg === p.id ? colors.primary : colors.surfaceStrong,
                      borderColor: paperBg === p.id ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View style={[styles.colorDot, { backgroundColor: p.id, borderWidth: p.id === '#FFFFFF' ? 1 : 0, borderColor: colors.border }]} />
                  <Text style={{ color: paperBg === p.id ? '#fff' : colors.textPrimary, fontWeight: '700', fontSize: 12 }}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Stroke count */}
            <Text style={[styles.info, { color: colors.textTertiary, marginTop: 16 }]}>
              {strokes.length} pencil stroke{strokes.length !== 1 ? 's' : ''} will be included
            </Text>
          </ScrollView>

          {/* Export button */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleExport}
              disabled={isExporting}
              style={[styles.exportBtn, { backgroundColor: colors.primary, opacity: isExporting ? 0.6 : 1 }]}
            >
              {isExporting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <FileDown size={18} color="#fff" />
              )}
              <Text style={styles.exportBtnText}>
                {isExporting ? 'Exporting...' : 'Export PDF'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  closeBtn: { padding: 6, borderRadius: 8, width: 36, alignItems: 'center' },
  body: { paddingHorizontal: 16, maxHeight: 400 },
  previewTitle: { fontSize: 18, fontWeight: '700', marginVertical: 16 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  info: { fontSize: 12, fontStyle: 'italic' },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  exportBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

export default PilotV2GlanceExport;