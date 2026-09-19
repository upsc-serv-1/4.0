import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
} from 'react-native';
import { ChevronUp, ChevronDown } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { KeyBoxColor } from '../../utils/mainsCardHelpers';

export type SidebarDisplayPreferencesProps = {
  textColorMode?: 'default' | 'black';
  onChangeTextColorMode?: (mode: 'default' | 'black') => void;
  keyBoxMode?: 'boxed' | 'bold';
  onChangeKeyBoxMode?: (mode: 'boxed' | 'bold') => void;
  keyBoxColor?: KeyBoxColor;
  onChangeKeyBoxColor?: (color: KeyBoxColor) => void;
  colors: any;
  isDark?: boolean;
  hideHeader?: boolean;
};

export default function SidebarDisplayPreferences({
  textColorMode = 'default',
  onChangeTextColorMode,
  keyBoxMode = 'boxed',
  onChangeKeyBoxMode,
  keyBoxColor = 'blue',
  onChangeKeyBoxColor,
  colors,
  isDark: propIsDark,
  hideHeader = false,
}: SidebarDisplayPreferencesProps) {
  const { isDark: contextIsDark } = useTheme();
  const isDark = propIsDark !== undefined ? propIsDark : contextIsDark;
  const [expanded, setExpanded] = useState(false);

  const isVisible = hideHeader || expanded;

  return (
    <View style={hideHeader ? { marginVertical: 2 } : { marginVertical: 2, marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border + '60', paddingTop: 8 }}>
      {!hideHeader && (
        <TouchableOpacity
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
          style={[
            styles.sidebarSectionHeader,
            expanded && styles.sidebarSectionHeaderActive,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.panelLabel, { color: colors.textTertiary, fontSize: 10, marginBottom: 0, letterSpacing: 1 }]}>
              READING & DISPLAY
            </Text>
            <View style={{ backgroundColor: colors.border + '60', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 8, fontWeight: '800', color: colors.textTertiary }}>
                3
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: expanded ? colors.primary + '15' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {expanded
                ? <ChevronUp size={13} color={colors.textSecondary} />
                : <ChevronDown size={13} color={colors.textTertiary} />
              }
            </View>
          </View>
        </TouchableOpacity>
      )}

      {isVisible && (
        <View style={{ paddingTop: 8, paddingBottom: 6, paddingHorizontal: 2 }}>
          {/* TEXT READABILITY */}
          <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans-Bold', fontWeight: '900', color: colors.textTertiary + '99', letterSpacing: 1.5, marginBottom: 8 }}>
            TEXT READABILITY
          </Text>
          <View style={{ flexDirection: 'row', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderRadius: 8, padding: 3, gap: 4 }}>
            <TouchableOpacity
              onPress={() => onChangeTextColorMode?.('default')}
              style={{
                flex: 1,
                paddingVertical: 8,
                alignItems: 'center',
                borderRadius: 6,
                backgroundColor: textColorMode === 'default' ? (isDark ? '#334155' : '#ffffff') : 'transparent',
                ...Platform.select<any>({
                  ios: textColorMode === 'default' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 } : {},
                  android: textColorMode === 'default' ? { elevation: 1 } : {},
                }),
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: textColorMode === 'default' ? colors.primary : colors.textSecondary }}>
                Muted Grey
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onChangeTextColorMode?.('black')}
              style={{
                flex: 1,
                paddingVertical: 8,
                alignItems: 'center',
                borderRadius: 6,
                backgroundColor: textColorMode === 'black' ? (isDark ? '#334155' : '#ffffff') : 'transparent',
                ...Platform.select<any>({
                  ios: textColorMode === 'black' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 } : {},
                  android: textColorMode === 'black' ? { elevation: 1 } : {},
                }),
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: textColorMode === 'black' ? (isDark ? '#ffffff' : '#000000') : colors.textSecondary }}>
                Deep Black
              </Text>
            </TouchableOpacity>
          </View>

          {/* KEYWORD BOXES */}
          <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans-Bold', fontWeight: '900', color: colors.textTertiary + '99', letterSpacing: 1.5, marginTop: 14, marginBottom: 8 }}>
            KEYWORD BOXES
          </Text>
          <View style={{ flexDirection: 'row', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderRadius: 8, padding: 3, gap: 4 }}>
            <TouchableOpacity
              onPress={() => onChangeKeyBoxMode?.('boxed')}
              style={{
                flex: 1,
                paddingVertical: 8,
                alignItems: 'center',
                borderRadius: 6,
                backgroundColor: keyBoxMode === 'boxed' ? (isDark ? '#334155' : '#ffffff') : 'transparent',
                ...Platform.select<any>({
                  ios: keyBoxMode === 'boxed' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 } : {},
                  android: keyBoxMode === 'boxed' ? { elevation: 1 } : {},
                }),
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: keyBoxMode === 'boxed' ? colors.primary : colors.textSecondary }}>
                Boxed
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onChangeKeyBoxMode?.('bold')}
              style={{
                flex: 1,
                paddingVertical: 8,
                alignItems: 'center',
                borderRadius: 6,
                backgroundColor: keyBoxMode === 'bold' ? (isDark ? '#334155' : '#ffffff') : 'transparent',
                ...Platform.select<any>({
                  ios: keyBoxMode === 'bold' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 } : {},
                  android: keyBoxMode === 'bold' ? { elevation: 1 } : {},
                }),
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: keyBoxMode === 'bold' ? (isDark ? '#ffffff' : '#000000') : colors.textSecondary }}>
                Plain Bold
              </Text>
            </TouchableOpacity>
          </View>

          {/* HIGHLIGHT COLOR */}
          <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans-Bold', fontWeight: '900', color: colors.textTertiary + '99', letterSpacing: 1.5, marginTop: 14, marginBottom: 8 }}>
            HIGHLIGHT COLOR
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            {(['yellow', 'green', 'blue', 'pink'] as KeyBoxColor[]).map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => onChangeKeyBoxColor?.(c)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: 
                    c === 'yellow' ? (isDark ? '#ca8a04' : '#fef08a') :
                    c === 'green' ? (isDark ? '#16a34a' : '#bbf7d0') :
                    c === 'blue' ? (isDark ? '#2563eb' : '#bfdbfe') :
                    (isDark ? '#db2777' : '#fbcfe8'),
                  borderWidth: keyBoxColor === c ? 2 : 1,
                  borderColor: keyBoxColor === c ? (isDark ? '#ffffff' : '#000000') : (isDark ? '#334155' : '#e2e8f0'),
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: keyBoxColor === c ? 0.3 : 0,
                  shadowRadius: 2,
                  elevation: keyBoxColor === c ? 2 : 0,
                }}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebarSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  sidebarSectionHeaderActive: {
    paddingBottom: 4,
  },
  panelLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
