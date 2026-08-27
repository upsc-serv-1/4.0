import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft,
  Save,
  Info,
  ImagePlus,
  CheckCircle2,
  MapPin,
  Sparkles,
  Edit,
  X,
  ClipboardPaste,
  Server,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { DragDropContentView } from 'expo-drag-drop-content-view';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { spacing, radius } from '../../src/theme';
import { PageWrapper } from '../../src/components/PageWrapper';
import { pickAndUploadFlashcardImage, uploadCompressedImage } from '../../src/services/ImageUpload';
import { StorageConfig, StorageProvider } from '../../src/services/StorageConfig';
import { StorageSettingsSheet } from '../../src/components/flashcards/StorageSettingsSheet';
import { FlashcardSvc } from '../../src/services/FlashcardService';
import { BranchSvc } from '../../src/services/BranchService';
import { BranchPlacement } from '../../src/services/BranchPlacement';
import { AddToFlashcardSheet } from '../../src/components/flashcards/AddToFlashcardSheet';
import { parseImageUrls, serializeImageUrls } from '../../src/utils/imageHelpers';
import { useFlashcardAI } from '../../src/hooks/useFlashcardAI';

type DeckSelection = {
  id: string;
  name: string;
  path: string;
};

export default function NewCard() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const uid = session?.user?.id;

  const params = useLocalSearchParams<{   
    subject?: string;
    section?: string;
    microtopic?: string;
    branchId?: string;
    branchName?: string;
    aiPrefilledContent?: string;
    mode?: 'ai' | 'manual';
    cardId?: string;
  }>();

  const editingCardId = params.cardId;
  const isEditing = Boolean(editingCardId);
  const [loadingCard, setLoadingCard] = useState(false);
  const [originalBranchId, setOriginalBranchId] = useState<string | null>(null);

  // Non-blocking toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 2500);
  };

  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [saving, setSaving] = useState(false);

  // Storage provider state
  const [activeStorageProvider, setActiveStorageProvider] = useState<StorageProvider>('supabase');
  const [storageSettingsVisible, setStorageSettingsVisible] = useState(false);

  useEffect(() => {
    StorageConfig.getStorageProvider().then(setActiveStorageProvider);
  }, []);

  // AI-related state
  const { generateFlashcard, loading: aiGenerating, error: aiError } = useFlashcardAI();
  const [mode, setMode] = useState<'ai' | 'manual'>(params.mode === 'ai' ? 'ai' : 'manual');
  const [aiInput, setAiInput] = useState(params.aiPrefilledContent || '');
  const [aiLoading, setAiLoading] = useState(false);

  const [frontImageUrls, setFrontImageUrls] = useState<string[]>([]);
  const [backImageUrls, setBackImageUrls] = useState<string[]>([]);
  const [frontUploading, setFrontUploading] = useState(false);
  const [backUploading, setBackUploading] = useState(false);
  const [isDraggingFront, setIsDraggingFront] = useState(false);
  const [isDraggingBack, setIsDraggingBack] = useState(false);

  const [destination, setDestination] = useState<DeckSelection | null>(null);
  const [destinationPicker, setDestinationPicker] = useState(false);

  const hint = useMemo(() => ({
    subject: String(params.subject || 'General'),
    section_group: String(params.section || 'General'),
    microtopic: String(params.microtopic || 'General'),
  }), [params.subject, params.section, params.microtopic]);

  // Load existing card details if editing
  useEffect(() => {
    if (!editingCardId || !uid) return;
    (async () => {
      setLoadingCard(true);
      try {
        const c = await FlashcardSvc.getCardDetails(editingCardId);
        if (c) {
          setFront(c.front_text || c.question_text || '');
          setBack(c.back_text || c.answer_text || '');
          setFrontImageUrls(parseImageUrls(c.front_image_url));
          setBackImageUrls(parseImageUrls(c.back_image_url));
        }
        const branch = await BranchSvc.getBranchForCard(uid, editingCardId);
        if (branch) {
          setOriginalBranchId(branch.id);
          setDestination({
            id: branch.id,
            name: branch.name,
            path: branch.name,
          });
        }
      } catch (e: any) {
        console.error('Failed to load card details for edit:', e);
      } finally {
        setLoadingCard(false);
      }
    })();
  }, [editingCardId, uid]);

  // Auto-populate destination from branchId if coming from inside a deck
  useEffect(() => {
    if (params.branchId && params.branchName && !destination) {
      const path = params.branchName ? String(params.branchName) : '';
      setDestination({
        id: String(params.branchId),
        name: String(params.branchName),
        path,
      });
    }
  }, [params.branchId, params.branchName]);

  const destinationLabel = destination?.path || null;

  const handleGenerateFlashcard = async () => {
    if (!aiInput.trim()) {
      Alert.alert('Empty Input', 'Please enter some content for AI to generate a flashcard from.');
      return;
    }

    setAiLoading(true);
    try {
      const result = await generateFlashcard(aiInput);
      if (result) {
        setFront(result.front);
        setBack(result.back);
      } else {
        Alert.alert('Generation Failed', 'Could not parse AI response. Please try again.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate flashcard');
    } finally {
      setAiLoading(false);
    }
  };

  const handlePasteClipboardImage = async (side: 'front' | 'back') => {
    if (!uid) return;
    try {
      const hasImage = await Clipboard.hasImageAsync();
      if (!hasImage) {
        Alert.alert('No Image in Clipboard', 'Copy an image from Photos or browser first, then tap Paste.');
        return;
      }
      if (side === 'front') setFrontUploading(true);
      else setBackUploading(true);

      const image = await Clipboard.getImageAsync({ format: 'jpeg' });
      if (image?.data) {
        let uri = image.data;
        if (!uri.startsWith('file://') && !uri.startsWith('http') && !uri.startsWith('data:')) {
          uri = `data:image/jpeg;base64,${uri}`;
        }
        const url = await uploadCompressedImage(uri, uid);
        if (url) {
          if (side === 'front') setFrontImageUrls(prev => [...prev, url]);
          else setBackImageUrls(prev => [...prev, url]);
        }
      }
    } catch (err: any) {
      console.error('Clipboard paste error:', err);
      Alert.alert('Paste Error', err.message || 'Could not paste image from clipboard.');
    } finally {
      if (side === 'front') setFrontUploading(false);
      else setBackUploading(false);
    }
  };

  // Quick paste: auto-detect which side needs the image
  const handleQuickPaste = async () => {
    if (!uid) return;
    const targetSide: 'front' | 'back' = frontImageUrls.length === 0 ? 'front' : (backImageUrls.length === 0 ? 'back' : 'front');
    await handlePasteClipboardImage(targetSide);
  };

  // Handle dropped image from iPadOS Photos/Files drag-and-drop
  const handleDroppedAssets = async (assets: any[], side: 'front' | 'back') => {
    if (!uid || !assets || assets.length === 0) return;
    if (side === 'front') setIsDraggingFront(false);
    else setIsDraggingBack(false);

    const asset = assets[0];
    const uri = asset.uri || asset.path;
    if (!uri) return;

    if (side === 'front') setFrontUploading(true);
    else setBackUploading(true);
    try {
      const url = await uploadCompressedImage(uri, uid);
      if (url) {
        if (side === 'front') setFrontImageUrls(prev => [...prev, url]);
        else setBackImageUrls(prev => [...prev, url]);
      }
    } catch (err: any) {
      console.error('Drop upload error:', err);
      Alert.alert('Upload Error', err.message || 'Could not upload dropped image.');
    } finally {
      if (side === 'front') setFrontUploading(false);
      else setBackUploading(false);
    }
  };

  const save = async () => {
    if (!uid) return;
    
    const hasFront = front.trim() || frontImageUrls.length > 0;
    const hasBack = back.trim() || backImageUrls.length > 0;

    if (!hasFront || !hasBack) {
      showToast('Both front & back need text or image', 'error');
      return;
    }
    if (!destination) {
      showToast('Please select a destination deck', 'error');
      return;
    }

    setSaving(true);
    try {
      const frontImgVal = serializeImageUrls(frontImageUrls);
      const backImgVal = serializeImageUrls(backImageUrls);

      if (isEditing && editingCardId) {
        await FlashcardSvc.updateCardForUser(uid, editingCardId, {
          front_text: front.trim(),
          back_text: back.trim(),
          front_image_url: frontImgVal,
          back_image_url: backImgVal,
        });

        if (destination && destination.id !== originalBranchId) {
          if (originalBranchId) {
            await BranchPlacement.moveCard(uid, editingCardId, originalBranchId, destination.id);
          } else {
            await BranchPlacement.placeAt(uid, editingCardId, destination.id);
          }
        }

        showToast('Card updated', 'success');
        setTimeout(() => router.back(), 500);
        return;
      }

      const cardId = await FlashcardSvc.createCard(uid, {
        front_text: front.trim(),
        back_text: back.trim(),
        front_image_url: frontImgVal,
        back_image_url: backImgVal,
        subject: hint.subject,
        section_group: hint.section_group,
        microtopic: hint.microtopic,
        card_type: 'manual',
        source: { kind: 'manual' } as any,
      });

      await BranchPlacement.placeAt(uid, cardId, destination.id);

      // Clear input fields for next card (keep destination selected)
      setFront('');
      setBack('');
      setFrontImageUrls([]);
      setBackImageUrls([]);

      // Show non-blocking bottom-right toast for 2.5 seconds — stay on screen!
      const deckName = destination.name || destination.path || 'deck';
      showToast(`Card saved to ${deckName}`, 'success');
    } catch (error: any) {
      console.error(error);
      showToast(error.message || 'Failed to save card', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageWrapper>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="btn-back-new-card">
            <ChevronLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={s.headerTitleGroup}>
            <Text style={[s.title, { color: colors.textPrimary }]}>{isEditing ? 'Edit card' : 'Add cards'}</Text>
            <TouchableOpacity 
              onPress={() => setStorageSettingsVisible(true)}
              style={[s.storagePill, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}
              testID="btn-storage-settings"
            >
              <Server size={12} color={colors.primary} />
              <Text style={[s.storagePillText, { color: colors.textPrimary }]}>
                {activeStorageProvider === 'cloudflare_edge'
                  ? 'R2 Edge'
                  : activeStorageProvider === 'cloudflare'
                  ? 'Cloudflare R2'
                  : 'Supabase'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            onPress={save} 
            disabled={saving}
            style={[s.headerSaveBtn, { backgroundColor: colors.primary + '20' }]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <CheckCircle2 size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView 
          contentContainerStyle={s.scrollContent} 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
        >
          {/* Tab selector for AI vs Manual mode */}
          <View style={[s.tabContainer, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setMode('ai')}
              style={[s.tab, mode === 'ai' && [s.tabActive, { borderBottomColor: colors.primary }]]}
            >
              <Sparkles size={18} color={mode === 'ai' ? colors.primary : colors.textTertiary} />
              <Text style={[s.tabText, { color: mode === 'ai' ? colors.primary : colors.textTertiary }]}>
                AI Generate
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setMode('manual')}
              style={[s.tab, mode === 'manual' && [s.tabActive, { borderBottomColor: colors.primary }]]}
            >
              <Edit size={18} color={mode === 'manual' ? colors.primary : colors.textTertiary} />
              <Text style={[s.tabText, { color: mode === 'manual' ? colors.primary : colors.textTertiary }]}>
                Manual
              </Text>
            </TouchableOpacity>
          </View>

          {/* AI Input section */}
          {mode === 'ai' && (
            <View style={s.inputContainer}>
              <Text style={[s.label, { color: colors.textTertiary }]}>Content for AI</Text>
              <TextInput
                value={aiInput}
                onChangeText={setAiInput}
                placeholder="Paste notes, text, or content here..."
                placeholderTextColor={colors.textTertiary + '80'}
                multiline
                textAlignVertical="top"
                style={[s.textArea, { backgroundColor: colors.surfaceStrong, color: colors.textPrimary }]}
                editable={!aiLoading}
              />

              <TouchableOpacity
                onPress={handleGenerateFlashcard}
                disabled={aiLoading}
                style={[s.generateBtn, { backgroundColor: aiLoading ? colors.border : colors.primary }]}
              >
                {aiLoading ? (
                  <ActivityIndicator size="small" color={colors.surfaceStrong} />
                ) : (
                  <>
                    <Sparkles size={20} color={colors.surfaceStrong} />
                    <Text style={[s.generateBtnText, { color: colors.surfaceStrong }]}>
                      Generate with AI
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {aiError && (
                <Text style={[s.errorText, { color: colors.textSecondary }]}>
                  {aiError}
                </Text>
              )}

              <View style={{ height: 24 }} />
            </View>
          )}

          <View style={s.inputContainer}>
            {/* FRONT SIDE — Drop zone for iPadOS drag & drop */}
            <DragDropContentView
              onDrop={(e) => handleDroppedAssets(e.assets || [], 'front')}
              onEnter={() => setIsDraggingFront(true)}
              onExit={() => setIsDraggingFront(false)}
              allowedMimeTypes={[/^image\/.*/]}
              style={[
                s.dropZone,
                { borderColor: isDraggingFront ? colors.primary : 'transparent' },
                isDraggingFront && { backgroundColor: colors.primary + '10' },
              ]}
            >
              <Text style={[s.label, { color: colors.textTertiary }]}>
                Front side {isDraggingFront ? ' — Drop image here! 📷' : ''}
              </Text>
              <TextInput
                value={front}
                onChangeText={setFront}
                placeholder="Enter text here or drag image from Photos..."
                placeholderTextColor={colors.textTertiary + '80'}
                multiline
                textAlignVertical="top"
                style={[s.textArea, { backgroundColor: colors.surfaceStrong, color: colors.textPrimary }]}
                testID="input-front"
              />
              {frontUploading && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Uploading image...</Text>
                </View>
              )}
            </DragDropContentView>
            {frontImageUrls.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 10 }}>
                {frontImageUrls.map((url, idx) => (
                  <View key={url + idx} style={s.previewContainer}>
                    <Image source={{ uri: url }} style={s.previewImage} contentFit="cover" cachePolicy="memory-disk" />
                    <TouchableOpacity
                      style={s.removeImageBtn}
                      onPress={() => setFrontImageUrls(prev => prev.filter((_, i) => i !== idx))}
                      activeOpacity={0.8}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      testID={`btn-remove-front-image-${idx}`}
                    >
                      <X size={14} color="#FFFFFF" strokeWidth={3} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            
            <View style={{ height: 24 }} />

            {/* BACK SIDE — Drop zone for iPadOS drag & drop */}
            <DragDropContentView
              onDrop={(e) => handleDroppedAssets(e.assets || [], 'back')}
              onEnter={() => setIsDraggingBack(true)}
              onExit={() => setIsDraggingBack(false)}
              allowedMimeTypes={[/^image\/.*/]}
              style={[
                s.dropZone,
                { borderColor: isDraggingBack ? colors.primary : 'transparent' },
                isDraggingBack && { backgroundColor: colors.primary + '10' },
              ]}
            >
              <Text style={[s.label, { color: colors.textTertiary }]}>
                Back side {isDraggingBack ? ' — Drop image here! 📷' : ''}
              </Text>
              <TextInput
                value={back}
                onChangeText={setBack}
                placeholder="Enter text here or drag image from Photos..."
                placeholderTextColor={colors.textTertiary + '80'}
                multiline
                textAlignVertical="top"
                style={[s.textArea, { backgroundColor: colors.surfaceStrong, color: colors.textPrimary }]}
                testID="input-back"
              />
              {backUploading && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Uploading image...</Text>
                </View>
              )}
            </DragDropContentView>
            {backImageUrls.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 10 }}>
                {backImageUrls.map((url, idx) => (
                  <View key={url + idx} style={s.previewContainer}>
                    <Image source={{ uri: url }} style={s.previewImage} contentFit="cover" cachePolicy="memory-disk" />
                    <TouchableOpacity
                      style={s.removeImageBtn}
                      onPress={() => setBackImageUrls(prev => prev.filter((_, i) => i !== idx))}
                      activeOpacity={0.8}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      testID={`btn-remove-back-image-${idx}`}
                    >
                      <X size={14} color="#FFFFFF" strokeWidth={3} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={{ height: 32 }} />

            <Text style={[s.label, { color: colors.textTertiary }]}>DESTINATION</Text>
            {params.branchId ? (
              <View
                style={[s.destinationBtn, { borderColor: colors.primary, backgroundColor: colors.surfaceStrong }]}
                testID="destination-readonly"
              >
                <MapPin size={16} color={colors.primary} />
                <Text
                  style={{
                    flex: 1,
                    color: colors.textPrimary,
                    fontWeight: '800',
                    fontSize: 14
                  }}
                  numberOfLines={1}
                >
                  {destinationLabel}
                </Text>
                <CheckCircle2 size={18} color={colors.primary} />
              </View>
            ) : (
              <TouchableOpacity
                style={[s.destinationBtn, { borderColor: destination ? colors.primary : colors.border, backgroundColor: colors.surfaceStrong }]}
                onPress={() => setDestinationPicker(true)}
                testID="btn-select-destination"
              >
                <MapPin size={16} color={destination ? colors.primary : colors.textTertiary} />
                <Text
                  style={{
                    flex: 1,
                    color: destination ? colors.textPrimary : colors.textTertiary,
                    fontWeight: destination ? '800' : '600',
                    fontSize: 14
                  }}
                  numberOfLines={1}
                >
                  {destinationLabel || 'Choose deck...'}
                </Text>
                {destination ? <CheckCircle2 size={18} color={colors.primary} /> : null}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        {/* Bottom bar with image actions */}
        <View style={[s.bottomBar, { borderTopColor: colors.border, backgroundColor: colors.surface }]}> 
          {/* Paste Clipboard Images Row — Left: Front, Right: Back */}
          <View style={s.pasteRow}>
            <TouchableOpacity
              onPress={() => handlePasteClipboardImage('front')}
              disabled={frontUploading || backUploading}
              style={[s.pasteBtn, { backgroundColor: colors.primary }]}
              testID="btn-paste-front"
            >
              {frontUploading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <ClipboardPaste size={16} color="#FFF" />
              )}
              <Text style={s.pasteBtnText}>
                {frontUploading ? 'Uploading...' : 'Paste Front'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handlePasteClipboardImage('back')}
              disabled={frontUploading || backUploading}
              style={[s.pasteBtn, { backgroundColor: colors.primary }]}
              testID="btn-paste-back"
            >
              {backUploading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <ClipboardPaste size={16} color="#FFF" />
              )}
              <Text style={s.pasteBtnText}>
                {backUploading ? 'Uploading...' : 'Paste Back'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={s.mediaRow}>
            <TouchableOpacity
              onPress={async () => {
                if (!uid || frontUploading) return;
                setFrontUploading(true);
                try {
                  const url = await pickAndUploadFlashcardImage(uid);
                  if (url) setFrontImageUrls(prev => [...prev, url]);
                } finally { setFrontUploading(false); }
              }}
              style={[s.mediaBtn, { borderColor: colors.border, backgroundColor: colors.bg }]}
              testID="btn-media-front"
              disabled={frontUploading}
            >
              {frontUploading ? <ActivityIndicator size="small" color={colors.primary} /> : <ImagePlus size={16} color={colors.primary} />}
              <Text style={[s.mediaBtnText, { color: colors.textPrimary }]}>{frontUploading ? 'Uploading...' : 'Front image'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={async () => {
                if (!uid || backUploading) return;
                setBackUploading(true);
                try {
                  const url = await pickAndUploadFlashcardImage(uid);
                  if (url) setBackImageUrls(prev => [...prev, url]);
                } finally { setBackUploading(false); }
              }}
              style={[s.mediaBtn, { borderColor: colors.border, backgroundColor: colors.bg }]}
              testID="btn-media-back"
              disabled={backUploading}
            >
              {backUploading ? <ActivityIndicator size="small" color={colors.primary} /> : <ImagePlus size={16} color={colors.primary} />}
              <Text style={[s.mediaBtnText, { color: colors.textPrimary }]}>{backUploading ? 'Uploading...' : 'Back image'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <AddToFlashcardSheet
        visible={destinationPicker}
        onClose={() => setDestinationPicker(false)}
        userId={uid || ''}
        cardId={null}
        hint={hint}
        manualOnly
        selectionOnly
        title="Move card to deck"
        onSelectDeck={(deck) => {
          setDestination(deck);
          showToast(`Destination: ${deck.name || deck.path}`);
        }}
      />

      <StorageSettingsSheet
        visible={storageSettingsVisible}
        onClose={() => setStorageSettingsVisible(false)}
        onProviderChanged={setActiveStorageProvider}
      />

      {/* Non-blocking bottom-right Toast notification */}
      {toast && (
        <View style={s.bottomRightToast} pointerEvents="none">
          <View style={[s.toastCard, { backgroundColor: toast.type === 'error' ? '#ef4444' : '#22c55e' }]}>
            {toast.type === 'error' ? (
              <Info size={18} color="#FFF" />
            ) : (
              <CheckCircle2 size={18} color="#FFF" />
            )}
            <Text style={s.toastText}>{toast.message}</Text>
          </View>
        </View>
      )}
    </PageWrapper>
  );
}


const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  storagePillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  backBtn: { padding: 8 },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  scrollContent: { padding: spacing.lg, paddingBottom: 40 },
  inputContainer: { flex: 1 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 10, color: '#666' },
  destinationBtn: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textArea: {
    minHeight: 100,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '500',
  },
  previewContainer: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  previewImage: {
    width: 130,
    height: 130,
    borderRadius: 12,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  headerSaveBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  mediaRow: { flexDirection: 'row', gap: 10 },
  mediaBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mediaBtnText: { fontSize: 13, fontWeight: '700' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 52,
    borderRadius: 14,
  },
  saveBtnText: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 52,
    borderRadius: 14,
    marginTop: spacing.md,
  },
  generateBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: spacing.sm,
  },
  pasteRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  pasteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
  },
  pasteBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  dropZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 4,
  },
  bottomRightToast: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 95 : 75,
    right: 16,
    zIndex: 9999,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },
});

