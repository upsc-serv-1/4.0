import React, { forwardRef } from 'react';
import { View } from 'react-native';
import { RichEditor } from 'react-native-pell-rich-editor';

type Props = {
  html: string;
  onChange: (html: string) => void;
  themeColors: { bg: string; surface: string; textPrimary: string; border: string; primary: string };
  editorStyle?: any;
  placeholder?: string;
  onFocus?: () => void;
  useContainer?: boolean;
};

/**
 * Rich text editor wrapped around react-native-pell-rich-editor.
 * Renders a WebView-backed contentEditable that supports bold, italic,
 * underline, highlight (setHiliteColor), and lists natively.
 *
 * The output is clean HTML (<b>, <i>, <u>, <mark>/<span style="background">, <ul>, <ol>)
 * which is preserved exactly when exporting to PDF via the notesPdfEngine.
 */
const RichNoteEditor = forwardRef<any, Props>((props, ref) => {
  const { html, onChange, themeColors, editorStyle, placeholder, onFocus, useContainer = true } = props;

  return (
    <View style={{ flex: useContainer ? 1 : undefined, backgroundColor: themeColors.bg || '#ffffff' }}>
      <RichEditor
        ref={ref as any}
        initialContentHTML={html}
        onChange={onChange}
        onFocus={onFocus}
        placeholder={placeholder || 'Start writing...'}
        style={{
          minHeight: editorStyle?.minHeight ?? 260,
          backgroundColor: themeColors.bg || '#ffffff',
          ...(editorStyle?.containerStyle || null),
        }}
        editorStyle={{
          backgroundColor: themeColors.bg || '#ffffff',
          color: themeColors.textPrimary || '#000000',
          placeholderColor: '#9ca3af',
          contentCSSText: `
            font-size:16px;
            line-height:1.55;
            padding:12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif;
            caret-color: ${themeColors.primary || '#6366f1'};
          `,
          cssText: `
            body, p, li, div { font-size: 16px !important; line-height: 1.6; }
            h1 { font-size: 24px !important; font-weight: 800; margin-top: 12px; margin-bottom: 6px; }
            h2 { font-size: 20px !important; font-weight: 700; margin-top: 10px; margin-bottom: 5px; }
            h3 { font-size: 18px !important; font-weight: 700; margin-top: 8px; margin-bottom: 4px; }
            b, strong { font-weight: bold !important; }
            i, em { font-style: italic; }
            u { text-decoration: underline; }
            mark, .highlight { background-color: #FFF59D; padding: 0 2px; border-radius: 2px; }
            ul, ol { padding-left: 20px; margin: 8px 0; font-size: 16px; }
            li { margin: 4px 0; }
            blockquote { border-left: 3px solid ${themeColors.primary || '#6366f1'}; padding-left: 10px; color: #555; font-style: italic; }
            p { margin: 6px 0; }
          `,
        }}
        useContainer={useContainer}
        initialHeight={editorStyle?.minHeight ?? 320}
      />
    </View>
  );
});

RichNoteEditor.displayName = 'RichNoteEditor';
export default RichNoteEditor;
