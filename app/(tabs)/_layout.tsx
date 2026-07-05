import { Tabs, useSegments, useRouter, Redirect, useFocusEffect } from 'expo-router';
import { Home, BarChart2, RotateCcw, LayoutList, Tag, Target, FileText, TrendingUp, BarChart3, Layers, Database, PenTool, Sparkles, BookOpen, Compass, Globe, Search, Zap } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useCourse } from '../../src/context/CourseContext';
import { View, ActivityIndicator, ScrollView, TouchableOpacity, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { useState, useEffect, useCallback } from 'react';
import { TabConfigService, TabKey } from '../../src/services/TabConfigService';

const DEFAULT_TAB_ORDER: TabKey[] = ['index', 'arena', 'prelims', 'analyse', 'mains', 'pyq', 'flashcards', 'tags', 'pilot-v2', 'browser', 'revise', 'tracker'];

export default function TabsLayout() {
  const { colors } = useTheme();
  const { session, loading: authLoading } = useAuth();
  const segments = useSegments();
  const [tabOrder, setTabOrder] = useState<TabKey[]>(DEFAULT_TAB_ORDER);
  const [loading, setLoading] = useState(true);

  // Hide FAB if on Arena tab
  const isArena = segments[segments.length - 1] === 'arena';

  const loadConfig = async () => {
    try {
      const timeoutPromise = new Promise<TabKey[]>((_, reject) => 
        setTimeout(() => reject(new Error('Tab config load timeout')), 5000)
      );
      const order = await Promise.race([
        TabConfigService.getTabOrder(),
        timeoutPromise
      ]);
      setTabOrder(order);
    } catch (err) {
      console.error('Failed to load tab config:', err);
      setTabOrder(DEFAULT_TAB_ORDER);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // Reload config when settings change (triggered by focus)
  useFocusEffect(useCallback(() => {
    if (loading) loadConfig();
  }, [loading]));

  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;

  // Distinct accent colors for each tab icon (vibrant, not just gray)
  const TAB_COLORS: Record<string, string> = {
    index: '#6366f1',       // Indigo
    arena: '#ef4444',       // Red
    prelims: '#7c3aed',     // Purple
    analyse: '#14b8a6',     // Teal
    mains: '#f43f5e',       // Rose
    pyq: '#f59e0b',         // Amber
    flashcards: '#8b5cf6',  // Purple
    tags: '#06b6d4',        // Cyan
    'pilot-v2': '#10b981',  // Emerald
    browser: '#ec4899',     // Pink
    revise: '#3b82f6',      // Blue (Repo)
    tracker: '#f97316',     // Orange (Syllabus)
    'ai-search': '#6366f1', // Indigo
    notes: '#a855f7',       // Violet
    hardnotes: '#ef4444',   // Red
    capsule: '#eab308',     // Yellow
    softnotes: '#14b8a6',   // Teal
  };

  const TAB_DEFINITIONS: Record<TabKey, { title: string; icon: any }> = {
    index: { title: 'Home', icon: Home },
    arena: { title: 'Arena', icon: Target },
    prelims: { title: 'Prelims', icon: Target },
    analyse: { title: 'Analyse', icon: BarChart2 },
    mains: { title: 'Mains', icon: PenTool },
    pyq: { title: 'PYQ Analysis', icon: BarChart3 },
    flashcards: { title: 'Flashcards', icon: Layers },
    tags: { title: 'Tags', icon: Tag },
    notes: { title: 'Notes', icon: FileText },
    hardnotes: { title: 'Hardnotes', icon: PenTool },
    capsule: { title: 'Capsule', icon: Sparkles },
    'pilot-v2': { title: 'Pilot V2', icon: Compass },
    browser: { title: 'Ghost', icon: Globe },
    softnotes: { title: 'Softnotes', icon: BookOpen },
    revise: { title: 'Repo', icon: RotateCcw },
    tracker: { title: 'Syllabus', icon: LayoutList },
    'ai-search': { title: 'Search', icon: Search },
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => {
          const currentRouteName = props.state.routes[props.state.index].name;
          if (currentRouteName !== 'index' && currentRouteName !== 'revise') return null;
          return <ScrollableTabBar {...props} colors={colors} order={tabOrder} defs={TAB_DEFINITIONS} tabColors={TAB_COLORS} />;
        }}
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: 'transparent' },
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="revise" options={{ title: 'Revise' }} />
      </Tabs>
    </View>
  );
}

function ScrollableTabBar({ state, descriptors, navigation, colors, order, defs, tabColors }: any) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { selectedCourse } = useCourse();

  const visibleOrder = order.filter((tabKey: TabKey) => 
    !!defs[tabKey] && 
    tabKey !== 'notes' && 
    tabKey !== 'hardnotes' && 
    tabKey !== 'softnotes' &&
    tabKey !== 'capsule' &&
    tabKey !== 'arena' &&
    tabKey !== 'analyse' &&
    tabKey !== 'pyq' &&
    tabKey !== 'tracker' &&
    tabKey !== 'ai-search' &&
    tabKey !== 'revise' &&
    tabKey !== 'tags' &&
    tabKey !== 'drupsc_hub' &&
    !(selectedCourse === 'Medical Science' && (tabKey === 'mains' || tabKey === 'prelims'))
  );
  const tabletItemWidth = isTablet
    ? Math.max(74, Math.floor((Math.max(width, 768) - 20) / Math.max(1, visibleOrder.length)))
    : undefined;

  return (
    <View style={[styles.tabBarContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      <ScrollView
        horizontal
        scrollEnabled={!isTablet}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && styles.scrollContentTablet,
        ]}
      >
        {visibleOrder.map((tabKey: TabKey) => {
          if (!defs[tabKey]) return null;
          const currentRoute = state.routes[state.index].name;
          const isFocused = tabKey === currentRoute || (tabKey === 'index' && currentRoute === 'index');
          const { icon: Icon, title } = defs[tabKey];

          const onPress = () => {
            if (tabKey === 'index') {
              navigation.navigate('index');
            } else if (tabKey === 'revise') {
              navigation.navigate('revise');
            } else {
              // Push onto root stack for full-screen view with back gesture
              const path = tabKey === 'arena' ? '/unified/arena' : `/${tabKey}`;
              router.push(path as any);
            }
          };

          return (
            <TouchableOpacity
              key={tabKey}
              onPress={onPress}
              style={[
                styles.tabItem,
                isTablet && styles.tabItemTablet,
                isTablet && tabletItemWidth ? { width: tabletItemWidth } : null,
              ]}
            >
              <Icon
                color={isFocused ? colors.primary : (tabColors?.[tabKey] || colors.textTertiary)}
                size={22}
                strokeWidth={isFocused ? 2.5 : 2}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isFocused ? colors.primary : (tabColors?.[tabKey] || colors.textTertiary) }
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {title.toUpperCase()}
              </Text>
              {isFocused && <View style={[styles.activeIndicator, { backgroundColor: colors.primary }]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    height: 70,
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  scrollContent: {
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  scrollContentTablet: {
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  tabItem: {
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minWidth: 80,
  },
  tabItemTablet: {
    minWidth: 0,
    paddingHorizontal: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 30,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  }
});
