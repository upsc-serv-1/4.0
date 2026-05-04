import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import {
  ExportOptions, QuestionRow, CardRow,
  buildQuestionsHtml, buildFlashcardsHtml, buildNotesHtml, buildTagsHtml,
} from './exportTemplates';

export type ExportPayload =
  | { kind: 'questions';  rows: QuestionRow[] }
  | { kind: 'flashcards'; rows: CardRow[] }
  | { kind: 'notes';      blocks: { title: string; html: string }[] }
  | { kind: 'tags';       groups: { tag: string; questions: QuestionRow[] }[] };

const sharePdfWithTimeout = async (uri: string, dialogTitle: string): Promise<void> => {
  const timeoutMs = 20000;
  await Promise.race([
    Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle }).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
};

export async function exportPdf(payload: ExportPayload, opts: ExportOptions) {
  let html = '';
  switch (payload.kind) {
    case 'questions':  html = buildQuestionsHtml(payload.rows, opts); break;
    case 'flashcards': html = buildFlashcardsHtml(payload.rows, opts); break;
    case 'notes':      html = buildNotesHtml(payload.blocks, opts); break;
    case 'tags':       html = buildTagsHtml(payload.groups, opts); break;
  }

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  // Rename to a friendly filename
  const safe = opts.title.replace(/[^a-z0-9-_ ]/gi, '_').slice(0, 48) || 'export';
  const dest = `${FileSystem.cacheDirectory}${safe}.pdf`;
  try { await FileSystem.moveAsync({ from: uri, to: dest }); } catch {}
  const finalUri = (await FileSystem.getInfoAsync(dest)).exists ? dest : uri;

  if (await Sharing.isAvailableAsync()) {
    await sharePdfWithTimeout(finalUri, opts.title);
  }
  return finalUri;
}
