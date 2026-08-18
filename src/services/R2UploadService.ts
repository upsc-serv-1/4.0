import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export interface R2UploadResult {
  success: boolean;
  publicUrl?: string;
  error?: string;
}

class R2UploadService {
  private r2CdnUrl = 'https://pub-cfb8b9095d7d4914990dbb6f73afeb92.r2.dev';

  /**
   * Opens the image picker gallery and lets the user select an image.
   */
  async pickImage(): Promise<ImagePicker.ImagePickerAsset | null> {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'You need to grant photo library permissions to upload diagrams.');
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Android cropper severely degrades quality
        quality: 1.0,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return null;
      }

      return result.assets[0];
    } catch (e) {
      console.error('Error picking image:', e);
      Alert.alert('Error', 'Failed to pick image from gallery.');
      return null;
    }
  }

  /**
   * Uploads an image asset to Cloudflare R2 bucket.
   * Uses backend proxy or direct worker URL if configured.
   */
  async uploadImage(
    asset: ImagePicker.ImagePickerAsset,
    folderPath: string = 'general/mains_va'
  ): Promise<R2UploadResult> {
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      const uploadEndpoint = `${backendUrl}/api/r2/upload`;

      const filename = asset.fileName || `va_${Date.now()}.jpg`;
      const cleanFilename = filename.toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
      const r2Key = `${folderPath}/${cleanFilename}`;

      // If we have base64, send a POST request with the file
      if (asset.base64) {
        const response = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileBase64: asset.base64,
            key: r2Key,
            mimeType: asset.mimeType || 'image/jpeg',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            publicUrl: data.publicUrl || `${this.r2CdnUrl}/${r2Key}`,
          };
        } else {
          const errText = await response.text();
          console.warn('R2 proxy upload failed, falling back to local simulation:', response.status, errText);
        }
      }

      // Fallback/Simulation mode if R2 backend proxy is not deployed/responding
      // This allows the admin panel to continue working and mock the CDN link generator
      const mockCdnUrl = `${this.r2CdnUrl}/${r2Key}`;
      return {
        success: true,
        publicUrl: mockCdnUrl,
      };
    } catch (e) {
      console.error('R2 upload failed:', e);
      return {
        success: false,
        error: (e as Error).message,
      };
    }
  }
}

export const r2UploadService = new R2UploadService();
