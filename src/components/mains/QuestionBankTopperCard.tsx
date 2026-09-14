import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Award, Bookmark, ExternalLink } from 'lucide-react-native';
import type { ConsolidatedQuestion, ConsolidatedAnswer } from '../../data/mainsConsolidatedLoader';
import { getTopperName, getAir, getTopperPageUrls } from '../../utils/topperHelpers';
import { TopperImageCacheService } from '../../services/TopperImageCacheService';

export interface QuestionBankTopperCardProps {
  question: ConsolidatedQuestion;
  topperAnswer?: ConsolidatedAnswer;
  colors: any;
  isDark: boolean;
  zoomFontSize: number;
  isBookmarked?: boolean;
  onToggleBookmark?: (id: string) => void;
  onOpenViewer: (
    images: string[],
    index: number,
    topperName?: string,
    air?: string | number,
    questionText?: string
  ) => void;
  onOpenDetailed?: (q: ConsolidatedQuestion) => void;
}

export default function QuestionBankTopperCard({
  question,
  topperAnswer,
  colors,
  isDark,
  zoomFontSize,
  isBookmarked = false,
  onToggleBookmark,
  onOpenViewer,
  onOpenDetailed,
}: QuestionBankTopperCardProps) {
  // 1. Identify target topper answer
  const answer =
    topperAnswer ||
    (question.answers || []).find(a => (a.page_urls && a.page_urls.length > 0) || a.is_topper) ||
    question.answers?.[0];

  const topperName = getTopperName(answer, question);
  const air = getAir(answer, question);
  const pageUrls = getTopperPageUrls(answer);
  const institute = answer?.institute || question.institute;
  const displayYear = question.year || (question as any).topper_year;

  // 2. Overlapping Thumbnail strip calculations (R2: first 3, 72x96, radius 8, overlapping, +N if more)
  const previewUrls = pageUrls.slice(0, 3);
  const remainingCount = pageUrls.length - 3;

  const handleOpenAt = (idx: number) => {
    if (pageUrls.length > 0) {
      onOpenViewer(pageUrls, idx, topperName, air, question.questionText);
    } else if (onOpenDetailed) {
      onOpenDetailed(question);
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.85)',
          borderColor: 'rgba(249, 115, 22, 0.35)',
          borderLeftColor: '#f97316',
          borderLeftWidth: 3, // R2: 3px left orange accent
        },
      ]}
    >
      {/* 1. Header Badge Row (R2: Award icon + TOPPER COPY label 11px, 700, #ea580c) */}
      <View style={styles.headerRow}>
        <View style={styles.badgeLeftGroup}>
          <View
            style={[
              styles.topperBadge,
              {
                backgroundColor: isDark ? 'rgba(234, 88, 12, 0.18)' : '#fff7ed',
                borderColor: 'rgba(234, 88, 12, 0.35)',
              },
            ]}
          >
            <Award size={12} color="#ea580c" />
            <Text style={styles.topperBadgeText}>TOPPER COPY</Text>
          </View>

          <Text style={[styles.metaPill, { color: '#ea580c' }]}>{question.paper || 'Optional'}</Text>

          {!!displayYear && (
            <>
              <Text style={[styles.metaDot, { color: colors.textTertiary }]}>•</Text>
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>{displayYear}</Text>
            </>
          )}

          {!!question.marks && (
            <>
              <Text style={[styles.metaDot, { color: colors.textTertiary }]}>•</Text>
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>{question.marks} Marks</Text>
            </>
          )}

          {!!question.subject && (
            <>
              <Text style={[styles.metaDot, { color: colors.textTertiary }]}>•</Text>
              <Text style={[styles.metaText, { color: colors.textTertiary }]} numberOfLines={1}>
                {question.subject}
              </Text>
            </>
          )}
        </View>

        {/* Action icons */}
        <View style={styles.actionsRight}>
          {onOpenDetailed && (
            <TouchableOpacity
              onPress={() => onOpenDetailed(question)}
              style={styles.iconBtn}
              activeOpacity={0.7}
            >
              <ExternalLink size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
          {onToggleBookmark && (
            <TouchableOpacity
              onPress={() => onToggleBookmark(question.id)}
              style={styles.iconBtn}
              activeOpacity={0.7}
            >
              <Bookmark
                size={16}
                color={isBookmarked ? '#f97316' : colors.textTertiary}
                fill={isBookmarked ? '#f97316' : 'none'}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. Question Title (R2: same typography as question cards) */}
      <TouchableOpacity activeOpacity={0.85} onPress={() => handleOpenAt(0)}>
        <Text
          style={[
            styles.questionTitle,
            {
              color: colors.textPrimary,
              fontSize: zoomFontSize,
              lineHeight: Math.round(zoomFontSize * 1.35),
            },
          ]}
        >
          {question.questionText}
        </Text>
      </TouchableOpacity>

      {/* 3. Person Row (R2: name, AIR n, institute, page count) */}
      <View style={styles.personRow}>
        <Text style={[styles.candidateName, { color: '#ea580c' }]}>{topperName}</Text>
        {air !== undefined && (
          <View style={styles.airChip}>
            <Text style={styles.airChipText}>AIR {air}</Text>
          </View>
        )}
        {!!institute && (
          <Text style={[styles.instituteText, { color: colors.textTertiary }]}>
            • {institute}
          </Text>
        )}
        <Text style={[styles.pageCountText, { color: colors.textTertiary }]}>
          • {pageUrls.length} {pageUrls.length === 1 ? 'page' : 'pages'}
        </Text>
      </View>

      {/* 4. Overlapping Thumbnail Row (R2: 72x96, radius 8, overlapping, +N if more) */}
      {previewUrls.length > 0 ? (
        <View style={styles.thumbnailRow}>
          {previewUrls.map((url, idx) => {
            const isLast = idx === previewUrls.length - 1;
            const showMore = isLast && remainingCount > 0;
            const resolvedUri = TopperImageCacheService.resolveImageUri(url);

            return (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.85}
                onPress={() => handleOpenAt(idx)}
                style={[
                  styles.thumbnailWrapper,
                  idx > 0 && { marginLeft: -14 },
                  {
                    zIndex: idx + 1,
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.12)',
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <ExpoImage
                  source={{ uri: resolvedUri }}
                  style={styles.thumbnailImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={120}
                />
                <View style={styles.pageNumberBadge}>
                  <Text style={styles.pageNumberText}>p.{idx + 1}</Text>
                </View>
                {showMore && (
                  <View style={styles.moreOverlay}>
                    <Text style={styles.moreOverlayText}>+{remainingCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => handleOpenAt(0)}
          style={[
            styles.emptyPagesNotice,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' },
          ]}
        >
          <Text style={{ fontSize: 12, color: colors.textTertiary, fontStyle: 'italic' }}>
            Tap to view topper copy
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1.2,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgeLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  topperBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  topperBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ea580c',
    letterSpacing: 0.5,
  },
  metaPill: {
    fontSize: 11,
    fontWeight: '800',
  },
  metaDot: {
    fontSize: 11,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 6,
  },
  questionTitle: {
    fontWeight: '800',
    marginBottom: 8,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  candidateName: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  airChip: {
    backgroundColor: 'rgba(234, 88, 12, 0.12)',
    borderColor: 'rgba(234, 88, 12, 0.3)',
    borderWidth: 0.8,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  airChipText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#ea580c',
  },
  instituteText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  pageCountText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  thumbnailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  thumbnailWrapper: {
    width: 72,
    height: 96,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  pageNumberBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  pageNumberText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '800',
  },
  moreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreOverlayText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  emptyPagesNotice: {
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
});
