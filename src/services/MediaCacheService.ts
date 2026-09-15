/**
 * MediaCacheService — on-disk cache for images embedded in questions/cards.
 *
 * Why this exists
 *   Question explanations and options routinely contain Markdown images
 *   (`![alt](https://...r2.dev/foo.png)`). Those URLs live on Cloudflare/R2,
 *   so rendering them does NOT cost Supabase egress — but they DO require
 *   network. To make "airplane mode" actually usable we download every
 *   referenced image once, at the end of the initial Download, and rewrite
 *   the URL to a `file://` path at render time.
 *
 * Design
 *   • Binaries live on the filesystem (`documentDirectory/media-cache/`).
 *     NEVER in MMKV — MMKV is for small JSON only.
 *   • KVStore holds a URL → { localUri, ... } index so lookups are synchronous
 *     (~0.2 ms) during render.
 *   • `resolveUri()` is a pure sync map lookup; it never throws and returns the
 *     original URL when nothing is cached, so online behaviour is unchanged.
 *   • Fully idempotent: re-running a sync skips anything already on disk.
 *
 * Generalised from TopperImageCacheService (which keeps its own A4-aware
 * layout logic and stays untouched).
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Image as ExpoImage } from 'expo-image';
import { KVStore } from '../lib/kvStore';
import { parseImageUrls } from '../utils/imageHelpers';

export interface MediaCacheRecord {
  remoteUrl: string;
  localUri: string;
  cachedAt: number;
  fileSizeBytes?: number;
}

export type MediaCacheMap = Record<string, MediaCacheRecord>;

const CACHE_INDEX_KEY = '@media_cache_index_v1';
const CACHE_FOLDER_NAME = 'media-cache/';

export interface MediaCollectResult {
  urls: string[];
  total: number;
}

/** Markdown image syntax: ![alt](url) or ![alt](url "title") */
const MD_IMAGE_RE = /!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
/** HTML <img src="..."> */
const HTML_IMG_RE = /<img[^>]+src=["']([^"']+)["']/gi;
/** Bare http(s) URLs pointing at common image extensions. */
const BARE_IMAGE_RE = /https?:\/\/[^\s)"'<>]+\.(?:png|jpe?g|gif|webp|bmp|svg|avif)(?:\?[^\s)"'<>]*)?/gi;

function isRemoteImageUrl(url: string): boolean {
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  // Data URIs never need downloading.
  if (url.startsWith('data:')) return false;
  return true;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function extensionFor(url: string): string {
  const clean = url.split('?')[0];
  const match = clean.match(/\.([a-zA-Z0-9]{2,5})$/);
  const ext = match ? match[1].toLowerCase() : 'jpg';
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(ext) ? ext : 'jpg';
}

class MediaCacheServiceClass {
  private memoryIndex: MediaCacheMap | null = null;
  private isInitialized = false;

  private getCacheDir(): string | null {
    if (Platform.OS === 'web' || !FileSystem.documentDirectory) return null;
    return `${FileSystem.documentDirectory}${CACHE_FOLDER_NAME}`;
  }

  private loadIndex(): MediaCacheMap {
    if (this.memoryIndex) return this.memoryIndex;
    try {
      this.memoryIndex = KVStore.getJson<MediaCacheMap>(CACHE_INDEX_KEY) ?? {};
    } catch {
      this.memoryIndex = {};
    }
    return this.memoryIndex;
  }

  private saveIndex(index: MediaCacheMap): void {
    this.memoryIndex = index;
    try {
      KVStore.setJson(CACHE_INDEX_KEY, index);
    } catch (err) {
      console.warn('[MediaCacheService] Failed to persist index:', err);
    }
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    const dir = this.getCacheDir();
    if (!dir) { this.isInitialized = true; return; }
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
    } catch (err) {
      console.warn('[MediaCacheService] Failed to create cache directory:', err);
    }
    this.isInitialized = true;
  }

  /** Sync lookup used by render paths. Returns the original URL when uncached. */
  public resolveUri(url: string): string {
    if (!url || Platform.OS === 'web') return url;
    const record = this.loadIndex()[url];
    return record?.localUri || url;
  }

  public isCached(url: string): boolean {
    if (!url || Platform.OS === 'web') return false;
    return Boolean(this.loadIndex()[url]?.localUri);
  }

  public cachedCount(): number {
    return Object.keys(this.loadIndex()).length;
  }

  /**
   * Extract every remote image URL referenced by a question row.
   * Covers question_text, options (all shapes) and explanation_markdown.
   *
   * Note: flashcard image columns are handled separately by `collectUrlsFromCard`
   * because they use a different, non-Markdown encoding.
   */
  public static collectUrlsFromQuestion(q: any): string[] {
    const found = new Set<string>();
    const scan = (value: any) => {
      if (!value) return;
      if (typeof value === 'string') {
        let m: RegExpExecArray | null;
        MD_IMAGE_RE.lastIndex = 0;
        while ((m = MD_IMAGE_RE.exec(value))) if (isRemoteImageUrl(m[1])) found.add(m[1]);
        HTML_IMG_RE.lastIndex = 0;
        while ((m = HTML_IMG_RE.exec(value))) if (isRemoteImageUrl(m[1])) found.add(m[1]);
        BARE_IMAGE_RE.lastIndex = 0;
        while ((m = BARE_IMAGE_RE.exec(value))) if (isRemoteImageUrl(m[0])) found.add(m[0]);
        return;
      }
      if (Array.isArray(value)) { value.forEach(scan); return; }
      if (typeof value === 'object') { Object.values(value).forEach(scan); }
    };

    scan(q?.question_text);
    scan(q?.explanation_markdown);
    scan(q?.options);
    return Array.from(found);
  }

  /**
   * Extract image URLs from a flashcard row.
   *
   * `front_image_url` / `back_image_url` are NOT plain URLs — they are written
   * by `serializeImageUrls`, which emits a bare URL for a single image and a
   * JSON array string for several (`'["a","b"]'`). They may also be
   * `|||`-delimited legacy values. So they must go through `parseImageUrls`
   * before being treated as URLs; feeding the raw string to a regex would
   * produce a corrupt, un-downloadable "URL" spanning both entries.
   */
  public static collectUrlsFromCard(card: any): string[] {
    const found = new Set<string>();

    const addAll = (val?: string | null) => {
      for (const url of parseImageUrls(val)) {
        if (isRemoteImageUrl(url)) found.add(url);
      }
    };
    addAll(card?.front_image_url);
    addAll(card?.back_image_url);

    // Card text can still embed Markdown/HTML images.
    const scan = (value: any) => {
      if (!value) return;
      if (typeof value === 'string') {
        let m: RegExpExecArray | null;
        MD_IMAGE_RE.lastIndex = 0;
        while ((m = MD_IMAGE_RE.exec(value))) if (isRemoteImageUrl(m[1])) found.add(m[1]);
        HTML_IMG_RE.lastIndex = 0;
        while ((m = HTML_IMG_RE.exec(value))) if (isRemoteImageUrl(m[1])) found.add(m[1]);
        return;
      }
      if (Array.isArray(value)) { value.forEach(scan); return; }
      if (typeof value === 'object') { Object.values(value).forEach(scan); }
    };
    scan(card?.front_text);
    scan(card?.back_text);

    return Array.from(found);
  }

  /** Collect URLs across a batch of questions/cards. */
  public static collectUrls(rows: any[]): string[] {
    const all = new Set<string>();
    for (const row of rows || []) {
      MediaCacheServiceClass.collectUrlsFromQuestion(row).forEach((u) => all.add(u));
      // Cards are distinguished by having image columns; collecting from both
      // is harmless because results are deduped by URL.
      MediaCacheServiceClass.collectUrlsFromCard(row).forEach((u) => all.add(u));
    }
    return Array.from(all);
  }

  /**
   * Download one image if not already on disk.
   * Returns the local URI (or the remote URL when caching isn't possible).
   */
  public async cacheUrl(url: string): Promise<string> {
    if (!isRemoteImageUrl(url)) return url;
    if (Platform.OS === 'web' || !FileSystem.documentDirectory) return url;

    await this.init();
    const cacheDir = this.getCacheDir();
    if (!cacheDir) return url;

    const index = this.loadIndex();
    const existing = index[url];
    if (existing?.localUri) {
      try {
        const info = await FileSystem.getInfoAsync(existing.localUri);
        if (info.exists) return existing.localUri;
      } catch {
        // Purged by the OS — fall through and re-download.
      }
    }

    const fileName = `m_${hashString(url)}.${extensionFor(url)}`;
    const localFilePath = `${cacheDir}${fileName}`;

    try {
      const res = await FileSystem.downloadAsync(url, localFilePath);
      if (res.status === 200) {
        let fileSizeBytes: number | undefined;
        try {
          const info = await FileSystem.getInfoAsync(localFilePath);
          if (info.exists && 'size' in info) fileSizeBytes = info.size;
        } catch { /* size is best-effort */ }

        index[url] = {
          remoteUrl: url,
          localUri: res.uri,
          cachedAt: Date.now(),
          fileSizeBytes,
        };
        this.saveIndex(index);
        ExpoImage.prefetch(res.uri).catch(() => {});
        return res.uri;
      }
    } catch (err) {
      console.warn(`[MediaCacheService] Failed to cache ${url}:`, err);
    }
    return url;
  }

  /**
   * Bulk-cache a list of URLs with progress + cancellation.
   * Skips anything already on disk, so re-running is cheap.
   */
  public async cacheUrls(
    urls: string[],
    onProgress?: (done: number, total: number, skipped: number) => void,
    shouldCancel?: () => boolean
  ): Promise<{ done: number; skipped: number; failed: number }> {
    let done = 0;
    let skipped = 0;
    let failed = 0;
    const total = urls.length;
    const index = this.loadIndex();

    for (let i = 0; i < total; i++) {
      if (shouldCancel?.()) break;
      const url = urls[i];

      if (index[url]?.localUri) {
        skipped += 1;
      } else {
        const before = index[url]?.localUri;
        const result = await this.cacheUrl(url);
        if (result && result !== url) done += 1;
        else if (!before) failed += 1;
      }
      onProgress?.(i + 1, total, skipped);
    }

    return { done, skipped, failed };
  }

  /**
   * Lazy safety net — called by renderers on first view of a question.
   * Fire-and-forget: the current render keeps the remote URL, the next one
   * resolves to the local file.
   */
  public ensureCached(urls: string[]): void {
    if (!urls?.length || Platform.OS === 'web') return;
    const index = this.loadIndex();
    const missing = urls.filter((u) => isRemoteImageUrl(u) && !index[u]?.localUri);
    if (missing.length === 0) return;
    // Serialise to avoid a burst of concurrent downloads.
    (async () => {
      for (const url of missing) {
        await this.cacheUrl(url);
      }
    })().catch(() => {});
  }

  /** Bytes currently used by the media cache (best-effort). */
  public async getCacheSize(): Promise<number> {
    const index = this.loadIndex();
    return Object.values(index).reduce((sum, r) => sum + (r.fileSizeBytes || 0), 0);
  }

  /** Wipe both the index and the files. */
  public async clearCache(): Promise<void> {
    const dir = this.getCacheDir();
    this.memoryIndex = {};
    KVStore.delete(CACHE_INDEX_KEY);
    if (!dir) return;
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (info.exists) {
        await FileSystem.deleteAsync(dir, { idempotent: true });
      }
    } catch (err) {
      console.warn('[MediaCacheService] Failed to clear cache directory:', err);
    }
  }
}

export const MediaCacheService = new MediaCacheServiceClass();
export default MediaCacheService;

/** Module-level helper so non-class callers can collect URLs without instantiating. */
export function collectQuestionMediaUrls(rows: any[]): string[] {
  return MediaCacheServiceClass.collectUrls(rows);
}

/** Collect just the front/back image URLs from a batch of flashcard rows. */
export function collectCardMediaUrls(rows: any[]): string[] {
  const all = new Set<string>();
  for (const row of rows || []) {
    MediaCacheServiceClass.collectUrlsFromCard(row).forEach((u) => all.add(u));
  }
  return Array.from(all);
}
