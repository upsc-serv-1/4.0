import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { StorageConfig } from './StorageConfig';
import { uploadToCloudflareR2 } from './CloudflareR2Upload';

export async function pickAndCompress(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });
  if (res.canceled || !res.assets[0]) return null;

  const compressed = await ImageManipulator.manipulateAsync(
    res.assets[0].uri,
    [{ resize: { width: 2048 } }],
    { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
  );

  return compressed.uri;
}

export async function uploadCompressedImage(localUri: string, userId: string = 'public'): Promise<string> {
  const provider = await StorageConfig.getStorageProvider();

  if (provider === 'cloudflare') {
    const cfConfig = await StorageConfig.getCloudflareConfig();
    if (!cfConfig || !cfConfig.accountId || !cfConfig.accessKeyId || !cfConfig.secretAccessKey || !cfConfig.bucketName) {
      Alert.alert(
        'Cloudflare Credentials Missing',
        'Please enter your Cloudflare R2 credentials in Storage Settings, or switch to Supabase Storage.'
      );
      throw new Error('Cloudflare R2 credentials missing');
    }
    try {
      return await uploadToCloudflareR2(localUri, cfConfig, userId);
    } catch (err: any) {
      console.error('Cloudflare R2 upload error:', err);
      Alert.alert('Cloudflare Upload Failed', `${err.message}\n\nUploading to Supabase fallback.`);
      // Fallback to Supabase
    }
  }

  // Supabase Upload
  const path = `${userId}/${Date.now()}.jpg`;

  const formData = new FormData();
  formData.append('file', {
    uri: localUri,
    name: path.split('/').pop(),
    type: 'image/jpeg',
  } as any);

  const { error } = await supabase.storage
    .from('flashcard-images')
    .upload(path, formData, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) {
    console.error('Upload failed', error);
    Alert.alert('Upload Error', `Supabase error: ${error.message}`);
    throw error;
  }

  const { data } = supabase.storage.from('flashcard-images').getPublicUrl(path);
  return data.publicUrl;
}

export async function pickAndUploadFlashcardImage(userId: string): Promise<string | null> {
  const localUri = await pickAndCompress();
  if (!localUri) return null;
  try {
    return await uploadCompressedImage(localUri, userId);
  } catch (err: any) {
    console.error('pickAndUploadFlashcardImage error:', err);
    return null;
  }
}
