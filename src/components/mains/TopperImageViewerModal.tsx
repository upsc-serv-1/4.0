import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ImageViewer from 'react-native-image-zoom-viewer';
import { Image as ExpoImage } from 'expo-image';
import { X } from 'lucide-react-native';
import { TopperImageCacheService } from '../../services/TopperImageCacheService';

interface TopperImageViewerModalProps {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  topperName?: string;
  air?: string | number;
  questionText?: string;
  onClose: () => void;
}

export default function TopperImageViewerModal({
  visible,
  images,
  initialIndex = 0,
  topperName,
  air,
  questionText,
  onClose,
}: TopperImageViewerModalProps) {
  const insets = useSafeAreaInsets();
  const [activePageIndex, setActivePageIndex] = useState(initialIndex);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    if (visible) {
      setActivePageIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
      setShowControls(true);
    }
  }, [visible, initialIndex, images.length]);

  const screenWidth = Dimensions.get('window').width;

  // Pre-supplied dimensions and resolved local cached URIs to eliminate Image.getSize() delays & infinite spinners
  const imageUrls = useMemo(() => {
    if (!images || images.length === 0) return [];
    return images.map(url => {
      const resolvedUri = TopperImageCacheService.resolveImageUri(url);
      const dims = TopperImageCacheService.getImageDimensions(url, screenWidth);
      return {
        url: resolvedUri,
        width: dims.width || screenWidth,
        height: dims.height || Math.round(screenWidth * 1.414),
        props: {
          cachePolicy: 'memory-disk' as const,
          contentFit: 'contain' as const,
          priority: 'high' as const,
        },
      };
    });
  }, [images, screenWidth]);

  if (!visible || !images || images.length === 0) return null;

  const topInset = Math.max(
    insets?.top || 0,
    Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24)
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.container}>
        {/* Full-Screen Edge-to-Edge Zoomable Image Viewer (iPhone Photos Style) */}
        <ImageViewer
          key={`topper-viewer-${initialIndex}-${images.map(u => u.slice(-20)).join('-')}`}
          imageUrls={imageUrls}
          index={initialIndex}
          onChange={(index) => {
            if (typeof index === 'number') {
              setActivePageIndex(Math.max(0, Math.min(index, images.length - 1)));
            }
          }}
          enableSwipeDown={true}
          swipeDownThreshold={60}
          onSwipeDown={onClose}
          onCancel={onClose}
          flipThreshold={15}
          maxOverflow={screenWidth * 0.85}
          pageAnimateTime={200}
          useNativeDriver={true}
          backgroundColor="#000000"
          enablePreload={false}
          saveToLocalByLongPress={false}
          renderIndicator={() => <View />}
          onClick={() => setShowControls(prev => !prev)}
          renderArrowLeft={() => <View />}
          renderArrowRight={() => <View />}
          renderImage={(props) => (
            <ExpoImage
              {...props}
              contentFit="contain"
              priority="high"
              cachePolicy="memory-disk"
              transition={100}
            />
          )}
          loadingRender={() => (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="small" color="#f97316" />
            </View>
          )}
        />

        {/* Minimalist Floating Overlay Controls (iPhone Photos Grade) */}
        {showControls && (
          <View style={[styles.floatingBar, { top: topInset + 8 }]} pointerEvents="box-none">
            {/* Page Count Indicator */}
            <View style={styles.floatingBadge}>
              <Text style={styles.floatingBadgeText}>
                {activePageIndex + 1} / {images.length}
              </Text>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              onPress={onClose}
              style={styles.floatingCloseBtn}
              accessibilityLabel="Close Viewer"
              activeOpacity={0.7}
            >
              <X size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 30,
  },
  floatingBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  floatingBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  floatingCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
