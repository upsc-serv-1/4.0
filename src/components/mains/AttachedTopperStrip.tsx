import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Award, ChevronRight } from 'lucide-react-native';
import type { ConsolidatedQuestion, ConsolidatedAnswer } from '../../data/mainsConsolidatedLoader';
import { getTopperName, getAir, getTopperPageUrls } from '../../utils/topperHelpers';
import { TopperImageCacheService } from '../../services/TopperImageCacheService';

export interface AttachedTopperStripProps {
  question: ConsolidatedQuestion;
  attachedToppers: ConsolidatedAnswer[];
  colors: any;
  isDark: boolean;
  onOpenViewer: (
    images: string[],
    index: number,
    topperName?: string,
    air?: string | number,
    questionText?: string
  ) => void;
}

export default function AttachedTopperStrip({
  question,
  attachedToppers,
  colors,
  isDark,
  onOpenViewer,
}: AttachedTopperStripProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (!attachedToppers || attachedToppers.length === 0) return null;

  const safeIdx = Math.min(selectedIdx, attachedToppers.length - 1);
  const activeTopper = attachedToppers[safeIdx];
  const activeName = getTopperName(activeTopper, question);
  const activeAir = getAir(activeTopper, question);
  const activePages = getTopperPageUrls(activeTopper);

  const previewPages = activePages;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? 'rgba(249, 115, 22, 0.08)' : 'rgba(255, 247, 237, 0.85)',
          borderColor: isDark ? 'rgba(249, 115, 22, 0.25)' : '#fed7aa',
        },
      ]}
    >
      {/* 1. Chips Row (supports 1 or multiple toppers) */}
      <View style={styles.chipsRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {attachedToppers.map((topper, idx) => {
            const isSelected = idx === safeIdx;
            const name = getTopperName(topper, question);
            const air = getAir(topper, question);
            const pageUrls = getTopperPageUrls(topper);

            return (
              <TouchableOpacity
                key={topper.id || idx}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedIdx(idx);
                  onOpenViewer(pageUrls, 0, name, air, question.questionText);
                }}
                style={[
                  styles.topperChip,
                  isSelected
                    ? {
                        backgroundColor: '#ea580c',
                        borderColor: '#c2410c',
                      }
                    : {
                        backgroundColor: isDark ? 'rgba(249, 115, 22, 0.15)' : '#ffedd5',
                        borderColor: 'rgba(249, 115, 22, 0.4)',
                      },
                ]}
              >
                <Award size={12} color={isSelected ? '#ffffff' : '#ea580c'} />
                <Text
                  style={[
                    styles.chipLabel,
                    { color: isSelected ? '#ffffff' : '#ea580c' },
                  ]}
                >
                  Handwritten
                </Text>
                <Text style={[styles.chipDot, { color: isSelected ? '#fed7aa' : '#c2410c' }]}>•</Text>
                <Text
                  style={[
                    styles.chipName,
                    { color: isSelected ? '#ffffff' : '#9a3412' },
                  ]}
                  numberOfLines={1}
                >
                  {name}
                </Text>
                {air !== undefined && (
                  <>
                    <Text style={[styles.chipDot, { color: isSelected ? '#fed7aa' : '#c2410c' }]}>•</Text>
                    <Text
                      style={[
                        styles.chipAir,
                        { color: isSelected ? '#ffffff' : '#ea580c' },
                      ]}
                    >
                      AIR {air}
                    </Text>
                  </>
                )}
                {pageUrls.length > 0 && (
                  <>
                    <Text style={[styles.chipDot, { color: isSelected ? '#fed7aa' : '#c2410c' }]}>•</Text>
                    <Text
                      style={[
                        styles.chipPages,
                        { color: isSelected ? '#ffedd5' : '#9a3412' },
                      ]}
                    >
                      {pageUrls.length}p
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          onPress={() => onOpenViewer(activePages, 0, activeName, activeAir, question.questionText)}
          style={styles.viewCopyBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.viewCopyText}>View</Text>
          <ChevronRight size={12} color="#ea580c" />
        </TouchableOpacity>
      </View>

      {/* 2. Thumbnail Previews */}
      {previewPages.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailsRow}
        >
          {previewPages.map((url, pIdx) => {
            const resolvedUri = TopperImageCacheService.resolveImageUri(url);

            return (
              <TouchableOpacity
                key={pIdx}
                activeOpacity={0.85}
                onPress={() => onOpenViewer(activePages, pIdx, activeName, activeAir, question.questionText)}
                style={[
                  styles.thumbnailWrapper,
                  {
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(234, 88, 12, 0.25)',
                    backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#ffffff',
                  },
                ]}
              >
                <ExpoImage
                  source={{ uri: resolvedUri }}
                  style={styles.thumbnailImg}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                <View style={styles.pageBadge}>
                  <Text style={styles.pageBadgeText}>p.{pIdx + 1}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <TouchableOpacity
          onPress={() => onOpenViewer(activePages, 0, activeName, activeAir, question.questionText)}
          style={styles.emptyNotice}
        >
          <Text style={{ fontSize: 11, color: colors.textTertiary, fontStyle: 'italic' }}>
            Tap to open handwritten copy
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topperChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  chipDot: {
    fontSize: 9,
    fontWeight: '700',
  },
  chipName: {
    fontSize: 10.5,
    fontWeight: '800',
    maxWidth: 120,
  },
  chipAir: {
    fontSize: 10,
    fontWeight: '900',
  },
  chipPages: {
    fontSize: 10,
    fontWeight: '700',
  },
  viewCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  viewCopyText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ea580c',
    marginRight: 2,
  },
  thumbnailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingRight: 12,
  },
  thumbnailWrapper: {
    width: 60,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
  },
  pageBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  pageBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '800',
  },
  moreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreOverlayText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  emptyNotice: {
    paddingVertical: 6,
    alignItems: 'center',
  },
});
