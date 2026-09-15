import { Platform, Dimensions } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Image as ExpoImage } from 'expo-image';
import { KVStore } from '../lib/kvStore';
import { getTopperPageUrls } from '../utils/topperHelpers';

export interface TopperImageCacheRecord {
  remoteUrl: string;
  localUri: string;
  questionId: string;
  pageIndex: number;
  width?: number;
  height?: number;
  fileSizeBytes?: number;
  cachedAt: number;
}

export type TopperImageCacheMap = Record<string, TopperImageCacheRecord>;

const CACHE_INDEX_KEY = '@topper_image_disk_index_v1';
const CACHE_FOLDER_NAME = 'topper_copies/';

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

class TopperImageCacheServiceClass {
  private memoryIndex: TopperImageCacheMap | null = null;
  private isInitialized = false;

  private getCacheDir(): string | null {
    if (Platform.OS === 'web' || !FileSystem.documentDirectory) {
      return null;
    }
    return `${FileSystem.documentDirectory}${CACHE_FOLDER_NAME}`;
  }

  private loadIndex(): TopperImageCacheMap {
    if (this.memoryIndex) {
      return this.memoryIndex;
    }
    try {
      const stored = KVStore.getJson<TopperImageCacheMap>(CACHE_INDEX_KEY);
      this.memoryIndex = stored || {};
    } catch {
      this.memoryIndex = {};
    }
    return this.memoryIndex;
  }

  private saveIndex(index: TopperImageCacheMap): void {
    this.memoryIndex = index;
    try {
      KVStore.setJson(CACHE_INDEX_KEY, index);
    } catch (err) {
      console.warn('[TopperImageCacheService] Failed to save index to KVStore:', err);
    }
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    const dir = this.getCacheDir();
    if (!dir) {
      this.isInitialized = true;
      return;
    }

    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
    } catch (err) {
      console.warn('[TopperImageCacheService] Failed to create cache directory:', err);
    }
    this.isInitialized = true;
  }

  public resolveImageUri(url: string): string {
    if (!url) return '';
    if (Platform.OS === 'web') return url;

    const index = this.loadIndex();
    const record = index[url];
    if (record && record.localUri) {
      return record.localUri;
    }
    return url;
  }

  public isImageCached(url: string): boolean {
    if (!url || Platform.OS === 'web') return false;
    const index = this.loadIndex();
    return Boolean(index[url]?.localUri);
  }

  /** Number of topper pages currently indexed on disk. */
  public cachedCount(): number {
    return Object.keys(this.loadIndex()).length;
  }

  public getImageDimensions(
    url: string,
    customWidth?: number
  ): { width: number; height: number } {
    const index = this.loadIndex();
    const record = index[url];

    if (record?.width && record?.height) {
      return { width: record.width, height: record.height };
    }

    // UPSC answer sheets follow standard A4 portrait aspect ratio (1:1.414)
    const baseWidth = customWidth || Dimensions.get('window').width;
    const baseHeight = Math.round(baseWidth * 1.414);

    return { width: baseWidth, height: baseHeight };
  }

  public setImageDimensions(url: string, width: number, height: number): void {
    if (!url || width <= 0 || height <= 0) return;
    const index = this.loadIndex();
    const existing = index[url];
    if (existing) {
      existing.width = width;
      existing.height = height;
      this.saveIndex(index);
    }
  }

  public async downloadAndCacheImage(
    url: string,
    questionId: string,
    pageIndex: number
  ): Promise<string> {
    if (!url) return '';
    if (Platform.OS === 'web' || !FileSystem.documentDirectory) {
      return url;
    }

    await this.init();
    const cacheDir = this.getCacheDir();
    if (!cacheDir) return url;

    const index = this.loadIndex();
    const existing = index[url];

    // Verify if local file still exists
    if (existing && existing.localUri) {
      try {
        const info = await FileSystem.getInfoAsync(existing.localUri);
        if (info.exists) {
          return existing.localUri;
        }
      } catch {
        // File may have been purged, re-download
      }
    }

    const cleanQId = (questionId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
    const hash = hashString(url);
    const localFileName = `topper_${cleanQId}_p${pageIndex}_${hash}.jpg`;
    const localFilePath = `${cacheDir}${localFileName}`;

    try {
      const downloadResult = await FileSystem.downloadAsync(url, localFilePath);

      if (downloadResult.status === 200) {
        let sizeBytes: number | undefined;
        try {
          const fileInfo = await FileSystem.getInfoAsync(localFilePath);
          if (fileInfo.exists && 'size' in fileInfo) {
            sizeBytes = fileInfo.size;
          }
        } catch {
          // ignore size retrieval error
        }

        const screenWidth = Dimensions.get('window').width;
        const newRecord: TopperImageCacheRecord = {
          remoteUrl: url,
          localUri: downloadResult.uri,
          questionId: questionId || 'unknown',
          pageIndex,
          width: screenWidth,
          height: Math.round(screenWidth * 1.414),
          fileSizeBytes: sizeBytes,
          cachedAt: Date.now(),
        };

        index[url] = newRecord;
        this.saveIndex(index);

        // Preload into ExpoImage disk cache
        ExpoImage.prefetch(downloadResult.uri).catch(() => {});

        return downloadResult.uri;
      }
    } catch (err) {
      console.warn(`[TopperImageCacheService] Failed to download image ${url}:`, err);
    }

    return url;
  }

  public async syncAllTopperImages(
    questions: any[],
    onProgress?: (current: number, total: number) => void
  ): Promise<{ success: number; failed: number }> {
    if (!questions || questions.length === 0) {
      return { success: 0, failed: 0 };
    }

    if (Platform.OS === 'web' || !FileSystem.documentDirectory) {
      return { success: 0, failed: 0 };
    }

    await this.init();

    // 1. Collect all images to download
    interface DownloadTarget {
      url: string;
      questionId: string;
      pageIndex: number;
    }

    const targets: DownloadTarget[] = [];
    const seenUrls = new Set<string>();

    for (const q of questions) {
      const answers = q.answers || [];
      for (const a of answers) {
        // Use the shared resolver rather than reading `page_urls` directly.
        // Answer rows store these as arrays, JSON strings, delimiter-separated
        // strings, OR only as markdown images inside answerText — reading only
        // the array form silently produced "0 images" for most questions.
        const pageUrls: string[] = getTopperPageUrls(a);
        pageUrls.forEach((url, idx) => {
          if (url && typeof url === 'string' && !seenUrls.has(url)) {
            seenUrls.add(url);
            targets.push({
              url,
              questionId: q.id,
              pageIndex: idx,
            });
          }
        });
      }
    }

    const total = targets.length;
    let completed = 0;
    let success = 0;
    let failed = 0;

    if (total === 0) {
      return { success: 0, failed: 0 };
    }

    onProgress?.(0, total);

    // 2. Download in parallel batches of 5 to avoid socket saturation
    const BATCH_SIZE = 5;
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async item => {
          try {
            const resultUri = await this.downloadAndCacheImage(
              item.url,
              item.questionId,
              item.pageIndex
            );
            if (resultUri && resultUri.startsWith('file://')) {
              success++;
            } else {
              failed++;
            }
          } catch {
            failed++;
          } finally {
            completed++;
            onProgress?.(completed, total);
          }
        })
      );
    }

    return { success, failed };
  }

  public async clearCache(): Promise<void> {
    const dir = this.getCacheDir();
    if (dir) {
      try {
        await FileSystem.deleteAsync(dir, { idempotent: true });
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      } catch (err) {
        console.warn('[TopperImageCacheService] Error deleting cache folder:', err);
      }
    }
    this.memoryIndex = {};
    try {
      KVStore.delete(CACHE_INDEX_KEY);
    } catch (err) {
      console.warn('[TopperImageCacheService] Error deleting KVStore index:', err);
    }
  }

  public getCacheStats(): { count: number; totalSizeBytes: number } {
    const index = this.loadIndex();
    const records = Object.values(index);
    const count = records.length;
    const totalSizeBytes = records.reduce((acc, r) => acc + (r.fileSizeBytes || 0), 0);
    return { count, totalSizeBytes };
  }
}

export const TopperImageCacheService = new TopperImageCacheServiceClass();
