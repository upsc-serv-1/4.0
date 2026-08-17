import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { X, Server, Cloud, Check, ShieldCheck, Key } from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme';
import { StorageConfig, StorageProvider, CloudflareR2Config } from '../../services/StorageConfig';

interface StorageSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  onProviderChanged?: (provider: StorageProvider) => void;
}

export function StorageSettingsSheet({
  visible,
  onClose,
  onProviderChanged,
}: StorageSettingsSheetProps) {
  const [provider, setProvider] = useState<StorageProvider>('supabase');
  const [accountId, setAccountId] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [bucketName, setBucketName] = useState('flashcard-images');
  const [publicUrl, setPublicUrl] = useState('https://pub-cfb8b9095d7d4914990dbb6f73afeb92.r2.dev');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  const loadSettings = async () => {
    const activeProvider = await StorageConfig.getStorageProvider();
    setProvider(activeProvider);

    const cfConfig = await StorageConfig.getCloudflareConfig();
    if (cfConfig) {
      if (cfConfig.accountId) setAccountId(cfConfig.accountId);
      if (cfConfig.accessKeyId) setAccessKeyId(cfConfig.accessKeyId);
      if (cfConfig.secretAccessKey) setSecretAccessKey(cfConfig.secretAccessKey);
      if (cfConfig.bucketName) setBucketName(cfConfig.bucketName);
      if (cfConfig.publicUrl) setPublicUrl(cfConfig.publicUrl);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (provider === 'cloudflare') {
        if (!accountId.trim() || !accessKeyId.trim() || !secretAccessKey.trim() || !bucketName.trim()) {
          Alert.alert('Incomplete Credentials', 'Please fill in all Cloudflare R2 credential fields.');
          setSaving(false);
          return;
        }

        const config: CloudflareR2Config = {
          accountId: accountId.trim(),
          accessKeyId: accessKeyId.trim(),
          secretAccessKey: secretAccessKey.trim(),
          bucketName: bucketName.trim(),
          publicUrl: publicUrl.trim(),
        };

        await StorageConfig.setCloudflareConfig(config);
      }

      await StorageConfig.setStorageProvider(provider);
      onProviderChanged?.(provider);

      Alert.alert(
        'Storage Provider Saved',
        `Image uploads will now use ${provider === 'cloudflare' ? 'Cloudflare R2' : 'Supabase Storage'}.`
      );
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save storage settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <View style={s.headerTitleRow}>
              <Server size={20} color={colors.primary} />
              <Text style={s.headerTitle}>Flashcard Storage Settings</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <X size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.content}>
            <Text style={s.sectionLabel}>SELECT STORAGE PROVIDER</Text>

            {/* Provider Option 1: Supabase */}
            <TouchableOpacity
              onPress={() => setProvider('supabase')}
              style={[
                s.providerCard,
                provider === 'supabase' && s.providerCardActive,
              ]}
            >
              <View style={s.providerIconWrap}>
                <Server size={22} color={provider === 'supabase' ? colors.primary : colors.textTertiary} />
              </View>
              <View style={s.providerTextWrap}>
                <Text style={s.providerTitle}>Supabase Storage</Text>
                <Text style={s.providerSub}>Default database storage bucket ('flashcard-images')</Text>
              </View>
              {provider === 'supabase' && <Check size={20} color={colors.primary} />}
            </TouchableOpacity>

            {/* Provider Option 2: Cloudflare R2 */}
            <TouchableOpacity
              onPress={() => setProvider('cloudflare')}
              style={[
                s.providerCard,
                provider === 'cloudflare' && s.providerCardActive,
              ]}
            >
              <View style={s.providerIconWrap}>
                <Cloud size={22} color={provider === 'cloudflare' ? colors.primary : colors.textTertiary} />
              </View>
              <View style={s.providerTextWrap}>
                <Text style={s.providerTitle}>Cloudflare R2 Storage</Text>
                <Text style={s.providerSub}>Zero egress fees, ultra-fast global CDN</Text>
              </View>
              {provider === 'cloudflare' && <Check size={20} color={colors.primary} />}
            </TouchableOpacity>

            {/* Cloudflare R2 Config Inputs */}
            {provider === 'cloudflare' && (
              <View style={s.cfConfigContainer}>
                <View style={s.cfHeader}>
                  <Key size={16} color={colors.primary} />
                  <Text style={s.cfHeaderTitle}>Cloudflare R2 Credentials</Text>
                </View>

                <Text style={s.inputLabel}>Account ID</Text>
                <TextInput
                  value={accountId}
                  onChangeText={setAccountId}
                  placeholder="e.g. cfb8b9095d7d4914990dbb6f73afeb92"
                  placeholderTextColor={colors.textTertiary + '80'}
                  style={s.input}
                  autoCapitalize="none"
                />

                <Text style={s.inputLabel}>Access Key ID</Text>
                <TextInput
                  value={accessKeyId}
                  onChangeText={setAccessKeyId}
                  placeholder="Enter R2 Access Key ID"
                  placeholderTextColor={colors.textTertiary + '80'}
                  style={s.input}
                  autoCapitalize="none"
                />

                <Text style={s.inputLabel}>Secret Access Key</Text>
                <TextInput
                  value={secretAccessKey}
                  onChangeText={setSecretAccessKey}
                  placeholder="Enter R2 Secret Access Key"
                  placeholderTextColor={colors.textTertiary + '80'}
                  secureTextEntry
                  style={s.input}
                  autoCapitalize="none"
                />

                <Text style={s.inputLabel}>R2 Bucket Name</Text>
                <TextInput
                  value={bucketName}
                  onChangeText={setBucketName}
                  placeholder="e.g. flashcard-images"
                  placeholderTextColor={colors.textTertiary + '80'}
                  style={s.input}
                  autoCapitalize="none"
                />

                <Text style={s.inputLabel}>Public R2 / Custom Domain URL</Text>
                <TextInput
                  value={publicUrl}
                  onChangeText={setPublicUrl}
                  placeholder="https://pub-cfb8b9095d7d4914990dbb6f73afeb92.r2.dev"
                  placeholderTextColor={colors.textTertiary + '80'}
                  style={s.input}
                  autoCapitalize="none"
                />
              </View>
            )}

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={[s.saveBtn, { backgroundColor: colors.primary }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <ShieldCheck size={18} color="#FFF" />
                  <Text style={s.saveBtnText}>Save Storage Preference</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
  closeBtn: {
    padding: 6,
  },
  content: {
    padding: spacing.lg,
    gap: 12,
  },
  sectionLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 12,
  },
  providerCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  providerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerTextWrap: {
    flex: 1,
  },
  providerTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  providerSub: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
  },
  cfConfigContainer: {
    marginTop: 8,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  cfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  cfHeaderTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  inputLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  input: {
    backgroundColor: colors.bg,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
  },
  saveBtn: {
    height: 50,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
