import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Bookmark, ExternalLink } from 'lucide-react-native';
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
  searchQuery?: string;
}

export function highlightKeywords(text: string, query?: string): React.ReactNode {
  if (!text) return null;
  if (!query || !query.trim()) return text;

  const trimmed = query.trim();
  const words = trimmed.split(/\s+/).filter(w => w.length >= 2);
  if (words.length === 0) return text;

  const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const pattern = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(pattern);
  if (parts.length <= 1) return text;

  return parts.map((part, i) =>
    pattern.test(part) ? (
      <Text
        key={i}
        style={{
          fontWeight: '900',
          color: '#ea580c',
          backgroundColor: 'rgba(234, 88, 12, 0.15)',
          borderRadius: 3,
        }}
      >
        {part}
      </Text>
    ) : (
      part
    )
  );
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
  searchQuery,
}: QuestionBankTopperCardProps) {
  // 1. Identify target topper answer
  const answer =
    topperAnswer ||
    (question.answers || []).find(a => (a.page_urls && a.page_urls.length > 0) || a.is_topper) ||
    question.answers?.[0];

  const topperName = getTopperName(answer, question);
  const air = getAir(answer, question);
  const pageUrls = getTopperPageUrls(answer);
  const displayYear = question.year || (question as any).topper_year;

  // Instead of generic "Optional", display the actual optional subject name (e.g. Anthropology)
  const isOptional =
    !question.paper ||
    question.paper.trim().toLowerCase() === 'optional' ||
    question.paper.trim().toLowerCase().includes('anthro') ||
    question.paper.trim().toLowerCase().includes('socio');

  let displaySubject = '';
  if (isOptional) {
    const rawSub =
      (question.subject && question.subject.trim().toLowerCase() !== 'optional'
        ? question.subject.trim()
        : null) ||
      (question.hierarchy_path?.[0] && question.hierarchy_path[0].trim().toLowerCase() !== 'optional'
        ? question.hierarchy_path[0].trim()
        : null) ||
      'Optional';

    // Format all-caps (e.g. "ANTHROPOLOGY" -> "Anthropology")
    displaySubject =
      rawSub.length > 3 && rawSub === rawSub.toUpperCase()
        ? rawSub.charAt(0) + rawSub.slice(1).toLowerCase()
        : rawSub;
  } else {
    const paper = question.paper.trim();
    const rawSub = (question.subject || '').trim();
    if (rawSub && rawSub.toLowerCase() !== paper.toLowerCase()) {
      const cleanSub =
        rawSub.length > 3 && rawSub === rawSub.toUpperCase()
          ? rawSub.charAt(0) + rawSub.slice(1).toLowerCase()
          : rawSub;
      displaySubject = `${paper} · ${cleanSub}`;
    } else {
      displaySubject = paper;
    }
  }

  // Formatted candidate rank & year string: e.g. "AIR 36 - 2025" or "AIR 120 - 2025"
  const rankYearParts = [];
  if (air !== undefined && air !== null && String(air).trim() !== '') {
    rankYearParts.push(`AIR ${air}`);
  }
  if (displayYear) {
    rankYearParts.push(`${displayYear}`);
  }
  const rankYearStr = rankYearParts.join(' - ');

  // 2. Overlapping Thumbnail strip calculations (first 3, 68x90, radius 7, overlapping, +N if more)
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
          borderLeftWidth: 3, // 3px left orange accent
        },
      ]}
    >
      {/* 1. Header: Candidate Name (AIR - Year) · Subject · Marks */}
      <View style={styles.headerRow}>
        <View style={styles.metaLeftGroup}>
          {/* Candidate Name & Rank/Year */}
          <Text style={[styles.candidateName, { color: colors.textSecondary }]}>
            {topperName}
            {!!rankYearStr && (
              <Text style={{ fontWeight: '600', color: colors.textSecondary }}>
                {' '}({rankYearStr})
              </Text>
            )}
          </Text>

          {/* Subject (e.g. Anthropology instead of Optional) */}
          {!!displaySubject && (
            <>
              <Text style={[styles.metaDot, { color: colors.textTertiary }]}>•</Text>
              <Text style={[styles.subjectText, { color: colors.textSecondary }]}>
                {displaySubject}
              </Text>
            </>
          )}

          {/* Marks */}
          {!!question.marks && (
            <>
              <Text style={[styles.metaDot, { color: colors.textTertiary }]}>•</Text>
              <Text style={[styles.marksText, { color: colors.textTertiary }]}>
                {question.marks} Marks
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
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ExternalLink size={15} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
          {onToggleBookmark && (
            <TouchableOpacity
              onPress={() => onToggleBookmark(question.id)}
              style={styles.iconBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Bookmark
                size={15}
                color={isBookmarked ? '#f97316' : colors.textTertiary}
                fill={isBookmarked ? '#f97316' : 'none'}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. Question Title */}
      <TouchableOpacity activeOpacity={0.85} onPress={() => handleOpenAt(0)}>
        <Text
          style={[
            styles.questionTitle,
            {
              color: colors.textPrimary,
              fontSize: zoomFontSize,
              lineHeight: Math.round(zoomFontSize * 1.3),
            },
          ]}
        >
          {highlightKeywords(question.questionText, searchQuery)}
        </Text>
      </TouchableOpacity>

      {/* 3. Overlapping Thumbnail Row */}
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
                  idx > 0 && { marginLeft: -12 },
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
          <Text style={{ fontSize: 11, color: colors.textTertiary, fontStyle: 'italic' }}>
            Tap to view topper copy
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1.2,
    padding: 10,
    marginBottom: 8,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1.5,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 6,
  },
  metaLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
    gap: 5,
  },
  topperBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  topperBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ea580c',
    letterSpacing: 0.5,
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    marginTop: -2,
  },
  iconBtn: {
    padding: 3,
  },
  candidateName: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  subjectText: {
    fontSize: 11,
    fontWeight: '700',
  },
  marksText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  metaDot: {
    fontSize: 9,
  },
  pageCountText: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  questionTitle: {
    fontWeight: '800',
    marginBottom: 6,
  },
  thumbnailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  thumbnailWrapper: {
    width: 68,
    height: 90,
    borderRadius: 7,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.08,
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
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  emptyPagesNotice: {
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
});
