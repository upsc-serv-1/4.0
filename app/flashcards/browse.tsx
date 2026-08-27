import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, FlatList, Animated, Modal, Platform, Pressable, Image as RNImage } from 'react-native';
import { Image } from 'expo-image';
import ImageViewer from 'react-native-image-zoom-viewer';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, X, Search, Share2, MoreVertical } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { OfflineManager } from '../../src/services/OfflineManager';
import { FlashcardSvc } from '../../src/services/FlashcardService';
import { BranchSvc } from '../../src/services/BranchService';
import { CardOverflowMenu, CardMenuAction } from '../../src/components/flashcards/CardOverflowMenu';
import { PremiumMoveModal } from '../../src/components/flashcards/PremiumMoveModal';
import Markdown from 'react-native-markdown-display';
import { getMarkdownStyles, getMarkdownRules, cleanMarkdownContent } from '../mains';
import { parseImageUrls } from '../../src/utils/imageHelpers';
import { renderAIText } from '../../src/utils/renderAIText';
import { supabase } from '../../src/lib/supabase';
import { KVStore } from '../../src/lib/kvStore';
import { NetworkStatus } from '../../src/lib/networkStatus';

const { width, height: windowHeight } = Dimensions.get('window');

function AutoCardImage({
  url,
  onPress,
  maxHeight = Math.max(400, windowHeight * 0.65),
  borderRadius = 8,
  marginBottom = 12,
}: {
  url: string;
  onPress: () => void;
  maxHeight?: number;
  borderRadius?: number;
  marginBottom?: number;
}) {
  const windowW = Dimensions.get('window').width;
  const [containerWidth, setContainerWidth] = useState(windowW - 32);
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!url) return;
    RNImage.getSize(
      url,
      (w, h) => {
        if (w > 0 && h > 0) {
          setImgDimensions({ width: w, height: h });
        }
      },
      () => {}
    );
  }, [url]);

  let renderedWidth = containerWidth;
  let renderedHeight: number | null = null;

  if (imgDimensions && imgDimensions.width > 0 && imgDimensions.height > 0) {
    const ar = imgDimensions.width / imgDimensions.height;
    const hIfFullW = containerWidth / ar;
    if (hIfFullW <= maxHeight) {
      renderedHeight = Math.round(hIfFullW);
      renderedWidth = containerWidth;
    } else {
      renderedHeight = maxHeight;
      renderedWidth = Math.round(Math.min(containerWidth, maxHeight * ar));
    }
  }

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - containerWidth) > 2) {
          setContainerWidth(w);
        }
      }}
      style={{ width: '100%', alignItems: 'center', marginBottom }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        style={{
          width: renderedWidth,
          height: renderedHeight ?? Math.min(260, maxHeight),
          borderRadius,
          overflow: 'hidden',
        }}
      >
        <Image
          source={{ uri: url }}
          onLoad={(e) => {
            if (e.source.width && e.source.height) {
              setImgDimensions({ width: e.source.width, height: e.source.height });
            }
          }}
          contentFit="contain"
          contentPosition="center"
          allowDownscaling={false}
          cachePolicy="memory-disk"
          style={{ width: '100%', height: '100%', borderRadius }}
        />
      </TouchableOpacity>
    </View>
  );
}

const BrowseCardView = React.memo(function BrowseCardView({ card, isActive, onImagePress }: { card: any, isActive: boolean, onImagePress: (url: string) => void }) {
  const { colors, isDark } = useTheme();
  const [revealed, setRevealed] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const answerYRef = useRef<number>(0);
  
  // reset revealed when card changes
  useEffect(() => {
    setRevealed(false);
  }, [card.id]);

  const mdStyles = useMemo(() => getMarkdownStyles(colors, isDark, 18), [colors, isDark]);
  const mdRules = useMemo(() => getMarkdownRules(colors, isDark, 18), [colors, isDark]);

  const hasOptions = card.source?.options && Object.keys(card.source.options).length > 0;
  const opts = hasOptions ? card.source.options : {};

  const handleShowAnswer = () => {
    if (!revealed) {
      setRevealed(true);
      setTimeout(() => {
        if (answerYRef.current > 0) {
          scrollRef.current?.scrollTo({ y: answerYRef.current - 20, animated: true });
        } else {
          scrollRef.current?.scrollToEnd({ animated: true });
        }
      }, 100);
    }
  };

  return (
    <ScrollView 
      ref={scrollRef}
      style={{ width }} 
      contentContainerStyle={styles.cardScroll}
      maximumZoomScale={5}
      minimumZoomScale={1}
      pinchGestureEnabled={true}
      bouncesZoom={true}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={Platform.OS === 'android'}
    >
      <Pressable 
        onPress={handleShowAnswer}
        style={[styles.cardContainer, { backgroundColor: colors.surface }]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardHeaderTitle, { color: colors.textSecondary }]}>Front</Text>
        </View>

        {parseImageUrls(card.front_image_url).map((url, idx) => (
          <AutoCardImage 
            key={url + idx} 
            url={url} 
            onPress={() => onImagePress(url)} 
            borderRadius={8} 
            marginBottom={12} 
          />
        ))}

        <Markdown style={mdStyles} rules={mdRules}>
          {cleanMarkdownContent(card.front_text || card.question_text || '')}
        </Markdown>

        {hasOptions && Object.entries(opts).map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', marginTop: 10, gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, backgroundColor: colors.surface, borderColor: colors.border }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontWeight: '900', color: colors.textTertiary, fontSize: 12 }}>{String(k).toUpperCase()}</Text>
            </View>
            <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 14 }}>{v as string}</Text>
          </View>
        ))}

        {!revealed ? (
          <TouchableOpacity 
            style={[styles.showAnswerBtn, { backgroundColor: colors.primary }]}
            onPress={handleShowAnswer}
          >
            <Text style={styles.showAnswerText}>Show Answer</Text>
          </TouchableOpacity>
        ) : (
          <View 
            style={[styles.backContainer, { borderColor: colors.border }]}
            onLayout={(e) => { answerYRef.current = e.nativeEvent.layout.y; }}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardHeaderTitle, { color: colors.textSecondary }]}>Back</Text>
            </View>

            {parseImageUrls(card.back_image_url).map((url, idx) => (
              <AutoCardImage 
                key={url + idx} 
                url={url} 
                onPress={() => onImagePress(url)} 
                borderRadius={8} 
                marginBottom={12} 
              />
            ))}

            <Markdown style={mdStyles} rules={mdRules}>
              {cleanMarkdownContent(card.back_text || card.answer_text || '')}
            </Markdown>
          </View>
        )}
      </Pressable>
    </ScrollView>
  );
});

export default function BrowseScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const uid = session?.user?.id;
  
  const { branchId, subject, section, microtopic, recursive, cardId } = useLocalSearchParams<any>();
  const isBranchMode = !!branchId;

  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuBusy, setMenuBusy] = useState(false);
  
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [branchTree, setBranchTree] = useState<any[]>([]);
  
  const flatListRef = useRef<FlatList>(null);
  const hasScrolledToInitial = useRef(false);

  useEffect(() => {
    if (!uid) return;
    const load = async () => {
      setLoading(true);
      try {
        const offlineCards: any[] = (((OfflineManager as any).getCollectionSync('cards') ?? []) as any[])
          .filter((c: any) => !c.deleted && !c.is_deleted);

        let filtered: any[] = [];
        
        if (isBranchMode) {
           const cardIds = await BranchSvc.listCardIdsInBranch(String(branchId), { recursive: recursive === '1', userId: uid });
           const idSet = new Set(cardIds);
           filtered = cardIds.map(id => offlineCards.find(c => c.id === id)).filter(Boolean);
           
           // Network Fallback for missing cards
           if (filtered.length < cardIds.length && NetworkStatus.isOnline()) {
             const missingIds = cardIds.filter(id => !filtered.find(c => c.id === id));
             if (missingIds.length > 0) {
               try {
                 const { data } = await supabase.from('cards').select('*').in('id', missingIds).eq('is_deleted', false);
                 if (data && data.length > 0) {
                   filtered = [...filtered, ...data];
                   // Update local cache
                   const allCached = (((OfflineManager as any).getCollectionSync('cards') ?? []) as any[]);
                   const merged = [...allCached, ...data];
                   KVStore.setJson('@cards_all', merged);
                 }
               } catch (e) {}
             }
           }
        } else {
           filtered = offlineCards
            .filter((c: any) => c.subject === subject && c.microtopic === microtopic)
            .filter((c: any) => section && section !== 'General'
              ? c.section_group === section
              : !c.section_group || c.section_group === 'General');
        }
        
        setCards(filtered);
        
        // Find index of the clicked card
        if (cardId && filtered.length > 0) {
          const idx = filtered.findIndex(c => c.id === cardId);
          if (idx >= 0) {
            setCurrentIndex(idx);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [uid, branchId, recursive, subject, section, microtopic, cardId]);

  // Initial scroll to the selected card
  useEffect(() => {
    if (!loading && cards.length > 0 && !hasScrolledToInitial.current && flatListRef.current) {
      if (currentIndex > 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index: currentIndex, animated: false });
          hasScrolledToInitial.current = true;
        }, 100);
      } else {
        hasScrolledToInitial.current = true;
      }
    }
  }, [loading, cards.length, currentIndex]);

  const handleScroll = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / width);
    if (idx !== currentIndex && idx >= 0 && idx < cards.length) {
      setCurrentIndex(idx);
    }
  };

  const renderCardItem = useCallback(({ item, index }: { item: any, index: number }) => (
    <BrowseCardView card={item} isActive={index === currentIndex} onImagePress={setZoomImageUrl} />
  ), [currentIndex]);

  const handleMenuAction = async (action: CardMenuAction) => {
    const card = cards[currentIndex];
    if (!card) return;

    try {
      setMenuBusy(true);
      switch (action) {
        case 'edit':
          setMenuVisible(false);
          router.push({ pathname: '/flashcards/new', params: { cardId: card.id } });
          break;
        case 'history':
          setMenuVisible(false);
          router.push({ pathname: '/flashcards/history', params: { cardId: card.id, title: card.front_text?.slice(0, 40) || 'Card history' } });
          break;
        case 'move':
          setMenuVisible(false);
          const tree = await BranchSvc.buildTree(uid);
          setBranchTree(tree);
          setShowMoveModal(true);
          break;
        case 'delete':
          setMenuVisible(false);
          import('react-native').then(({ Alert }) => {
            Alert.alert('Delete card?', 'This will remove it from your deck.', [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Delete', 
                style: 'destructive', 
                onPress: async () => { 
                  try { 
                    setMenuBusy(true);
                    await FlashcardSvc.softDeleteCardForUser(uid, card.id); 
                    const nq = cards.filter((_, i) => i !== currentIndex);
                    setCards(nq);
                    if (currentIndex >= nq.length) setCurrentIndex(Math.max(0, nq.length - 1));
                  } catch (e: any) { alert(e?.message); }
                  finally { setMenuBusy(false); }
                } 
              },
            ]);
          });
          break;
        default:
          setMenuVisible(false);
          alert(`Action '${action}' is available in full Study Mode.`);
          break;
      }
    } catch (e: any) {
      alert(e?.message);
    } finally {
      setMenuBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#1a1a1a' : colors.bg }} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronLeft size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        
        <View style={[styles.headerPill, { backgroundColor: isDark ? '#333' : '#fff', borderColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {loading ? '...' : `${currentIndex + 1}/${cards.length} cards`}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setMenuVisible(true)}>
            <MoreVertical size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary }}>Loading cards...</Text>
        </View>
      ) : cards.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary }}>No cards found.</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={cards}
          keyExtractor={(item) => item.id}
          renderItem={renderCardItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews={Platform.OS === 'android'}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
            }, 100);
          }}
          decelerationRate="fast"
          style={{ flex: 1 }}
        />
      )}

        <Modal visible={!!zoomImageUrl} transparent={true} onRequestClose={() => setZoomImageUrl(null)}>
          <ImageViewer
            imageUrls={zoomImageUrl ? [{ url: zoomImageUrl }] : []}
            enableSwipeDown={true}
            onSwipeDown={() => setZoomImageUrl(null)}
            renderIndicator={() => <View />}
          />
        </Modal>

      <CardOverflowMenu 
        visible={menuVisible} 
        frozen={cards[currentIndex]?.state?.status === 'frozen'} 
        busy={menuBusy}
        onClose={() => setMenuVisible(false)}
        onAction={handleMenuAction}
      />

      {showMoveModal && (
        <PremiumMoveModal 
          visible={showMoveModal}
          tree={branchTree}
          node={cards[currentIndex] ? { id: cards[currentIndex].id, name: cards[currentIndex].front_text } as any : null}
          onClose={() => setShowMoveModal(false)}
          onConfirm={async (targetBranchId) => {
            try {
              if (!uid) return;
              const card = cards[currentIndex];
              if (!card) return;
              await FlashcardSvc.moveCard(uid, card.id, targetBranchId);
              setShowMoveModal(false);
              
              // Remove card from view
              setCards(prev => {
                const newCards = [...prev];
                newCards.splice(currentIndex, 1);
                return newCards;
              });
              if (currentIndex >= cards.length - 1) {
                setCurrentIndex(Math.max(0, cards.length - 2));
              }
              alert('Card moved successfully.');
            } catch (e: any) {
              alert(e?.message || 'Failed to move card');
            }
          }}
          title="Select location"
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    alignItems: 'center', justifyContent: 'center'
  },
  headerPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700'
  },
  cardScroll: {
    padding: 16,
    paddingBottom: 40
  },
  cardContainer: {
    borderRadius: 16,
    padding: 20,
    minHeight: 200,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)'
  },
  cardHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  showAnswerBtn: {
    marginTop: 30,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  showAnswerText: {
    color: '#04223a',
    fontSize: 15,
    fontWeight: '900'
  },
  backContainer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1
  }
});
