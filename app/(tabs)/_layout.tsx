import { Tabs, useSegments, useRouter, Redirect, useFocusEffect } from 'expo-router';
import { Home, BarChart2, RotateCcw, LayoutList, Tag, Target, FileText, TrendingUp, BarChart3, Layers, Database, PenTool, Brain, Sparkles, BookOpen, Compass, Globe } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { View, ActivityIndicator, ScrollView, TouchableOpacity, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { useState, useEffect, useCallback } from 'react';
import { TabConfigService, TabKey } from '../../src/services/TabConfigService';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { session, loading: authLoading } = useAuth();
  const segments = useSegments();
  const [tabOrder, setTabOrder] = useState<TabKey[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Hide FAB if on Arena tab
  const isArena = segments[segments.length - 1] === 'arena';

  const loadConfig = async () => {
    const order = await TabConfigService.getTabOrder();
    setTabOrder(order);
    setLoading(false);
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // Reload config when settings change (triggered by focus)
  useFocusEffect(useCallback(() => {
    loadConfig();
  }, []));

  if (authLoading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  
  if (!session) return <Redirect href="/(auth)/login" />;

  const TAB_DEFINITIONS: Record<TabKey, { title: string; icon: any }> = {
    index: { title: 'Home', icon: Home },
    arena: { title: 'Arena', icon: Target },
    analyse: { title: 'Analyse', icon: BarChart2 },
    pyq: { title: 'PYQs', icon: BarChart3 },
    flashcards: { title: 'Cards', icon: Layers },
    tags: { title: 'Tags', icon: Tag },
    notes: { title: 'Notes', icon: FileText },
    hardnotes: { title: 'Hardnotes', icon: PenTool },
    capsule: { title: 'Capsule', icon: Sparkles },
    'pilot-v2': { title: 'Pilot V2', icon: Compass },
    browser: { title: 'Browser', icon: Globe },
    softnotes: { title: 'Softnotes', icon: BookOpen },
    revise: { title: 'Revise', icon: RotateCcw },
    tracker: { title: 'Tracker', icon: LayoutList },
    'ai-search': { title: 'AI Search', icon: Brain },
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => {
          const currentRouteName = props.state.routes[props.state.index].name;
          if (currentRouteName !== 'index' && currentRouteName !== 'hardnotes') return null;
          return <ScrollableTabBar {...props} colors={colors} order={tabOrder} defs={TAB_DEFINITIONS} />;
        }}
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: 'transparent' },
          sceneContainerStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="hardnotes" options={{ title: 'Hardnotes' }} />
      </Tabs>
    </View>
  );
}

function ScrollableTabBar({ state, descriptors, navigation, colors, order, defs }: any) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const visibleOrder = order.filter((tabKey: TabKey) => !!defs[tabKey]);
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
            } else if (tabKey === 'hardnotes') {
              navigation.navigate('hardnotes');
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
                color={isFocused ? colors.primary : colors.textTertiary} 
                size={22} 
                strokeWidth={isFocused ? 2.5 : 2} 
              />
              <Text 
                style={[
                  styles.tabLabel, 
                  { color: isFocused ? colors.primary : colors.textTertiary }
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
