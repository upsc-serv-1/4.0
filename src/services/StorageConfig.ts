import AsyncStorage from '@react-native-async-storage/async-storage';

export type StorageProvider = 'supabase' | 'cloudflare' | 'cloudflare_edge';

export interface CloudflareR2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}

const STORAGE_PROVIDER_KEY = '@flashcard_storage_provider';
const CLOUDFLARE_CONFIG_KEY = '@flashcard_cloudflare_r2_config';

export const StorageConfig = {
  async getStorageProvider(): Promise<StorageProvider> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_PROVIDER_KEY);
      if (val === 'cloudflare') return 'cloudflare';
      if (val === 'cloudflare_edge') return 'cloudflare_edge';
      return 'supabase';
    } catch {
      return 'supabase';
    }
  },

  async setStorageProvider(provider: StorageProvider): Promise<void> {
    await AsyncStorage.setItem(STORAGE_PROVIDER_KEY, provider);
  },

  async getCloudflareConfig(): Promise<CloudflareR2Config | null> {
    try {
      const json = await AsyncStorage.getItem(CLOUDFLARE_CONFIG_KEY);
      if (!json) return null;
      return JSON.parse(json);
    } catch {
      return null;
    }
  },

  async setCloudflareConfig(config: CloudflareR2Config): Promise<void> {
    await AsyncStorage.setItem(CLOUDFLARE_CONFIG_KEY, JSON.stringify(config));
  },
};
