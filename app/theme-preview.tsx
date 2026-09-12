import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Check } from 'lucide-react-native';
import { useTheme, themes, ThemeType } from '../src/context/ThemeContext';

const { width } = Dimensions.get('window');

const THEME_LIST: ThemeType[] = [
  'default', 'nature', 'modern', 'sand', 'cute', 'medical',
  'sage', 'lavender', 'ivory',
  'midnight_nebula', 'golden_night', 'emerald_dream', 'royal_purple', 'fitness_navy',
  'child_of_light', 'aruba_aqua', 'zinnia', 'fuchsia_blue', 'original_dark',
  'yogesh_2', 'yogesh_4'
];

const getThemeName = (t: string) => {
  const originals = ['default', 'nature', 'modern', 'sand', 'cute', 'medical', 'original_dark'];
  const zen = [
    'sage', 'lavender', 'ivory', 'midnight_nebula', 'golden_night', 'emerald_dream',
    'royal_purple', 'fitness_navy', 'child_of_light', 'aruba_aqua', 'zinnia', 'fuchsia_blue'
  ];
  const name = t.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

  if (originals.includes(t)) return `Original ${name}`;
  if (zen.includes(t)) return `Zen ${name}`;
  return name;
};

export default function ThemePreviewScreen() {
  const { theme, setTheme, colors } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<ThemeType>(theme);

  const handleThemeSelect = (selected: ThemeType) => {
    setSelectedTheme(selected);
    setTheme(selected);
  };

  const selectedColors = themes[selectedTheme];

  return (
    <SafeAreaView style={[s.container, { backgroundColor: selectedColors.bg }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: selectedColors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backButton}
        >
          <ChevronLeft color={selectedColors.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: selectedColors.textPrimary }]}>
          Theme Preview
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Theme Selector - Horizontal Scroll */}
        <View style={s.themeListContainer}>
          <Text style={[s.sectionLabel, { color: selectedColors.textSecondary }]}>
            Available Themes
          </Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={THEME_LIST}
            keyExtractor={(item) => item}
            contentContainerStyle={s.themeListContent}
            renderItem={({ item: t }) => (
              <TouchableOpacity
                onPress={() => handleThemeSelect(t)}
                style={[
                  s.themeButton,
                  {
                    borderColor: selectedTheme === t ? selectedColors.primary : selectedColors.border,
                    borderWidth: selectedTheme === t ? 2.5 : 1.5,
                    backgroundColor: selectedTheme === t ? selectedColors.primary + '15' : selectedColors.surface,
                  }
                ]}
              >
                <View
                  style={[
                    s.themeColorDot,
                    { backgroundColor: themes[t].primary }
                  ]}
                />
                <Text
                  style={[
                    s.themeButtonText,
                    {
                      color: selectedTheme === t ? selectedColors.primary : selectedColors.textSecondary,
                      fontWeight: selectedTheme === t ? '800' : '600',
                    }
                  ]}
                  numberOfLines={1}
                >
                  {getThemeName(t)}
                </Text>
                {selectedTheme === t && (
                  <Check size={14} color={selectedColors.primary} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Sample Components Preview */}
        <View style={s.previewSection}>
          <Text style={[s.sectionLabel, { color: selectedColors.textSecondary }]}>
            Component Preview
          </Text>

          {/* Primary Box */}
          <View
            style={[
              s.sampleBox,
              {
                backgroundColor: selectedColors.primary,
                borderColor: selectedColors.border,
              }
            ]}
          >
            <Text style={[s.boxText, { color: selectedColors.buttonText }]}>
              Primary Box
            </Text>
            <Text style={[s.boxSubText, { color: selectedColors.buttonText + '99' }]}>
              This uses your theme's primary color
            </Text>
          </View>

          {/* Surface Box */}
          <View
            style={[
              s.sampleBox,
              {
                backgroundColor: selectedColors.surface,
                borderColor: selectedColors.border,
                borderWidth: 1.5,
              }
            ]}
          >
            <Text style={[s.boxText, { color: selectedColors.textPrimary }]}>
              Surface Box
            </Text>
            <Text style={[s.boxSubText, { color: selectedColors.textSecondary }]}>
              This is your theme's surface color
            </Text>
          </View>

          {/* Accent Box */}
          <View
            style={[
              s.sampleBox,
              {
                backgroundColor: selectedColors.accent + '20',
                borderLeftWidth: 4,
                borderLeftColor: selectedColors.accent,
              }
            ]}
          >
            <Text style={[s.boxText, { color: selectedColors.textPrimary }]}>
              Accent Box
            </Text>
            <Text style={[s.boxSubText, { color: selectedColors.textSecondary }]}>
              This highlights with your accent color
            </Text>
          </View>

          {/* Buttons Row */}
          <View style={s.buttonsRow}>
            <TouchableOpacity
              style={[
                s.sampleButton,
                {
                  backgroundColor: selectedColors.primary,
                }
              ]}
            >
              <Text style={[s.buttonText, { color: selectedColors.buttonText }]}>
                Primary
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.sampleButton,
                {
                  backgroundColor: selectedColors.accent,
                }
              ]}
            >
              <Text style={[s.buttonText, { color: selectedColors.buttonText }]}>
                Accent
              </Text>
            </TouchableOpacity>
          </View>

          {/* Secondary Buttons Row */}
          <View style={s.buttonsRow}>
            <TouchableOpacity
              style={[
                s.sampleButton,
                {
                  backgroundColor: selectedColors.surface,
                  borderWidth: 1.5,
                  borderColor: selectedColors.primary,
                }
              ]}
            >
              <Text style={[s.buttonText, { color: selectedColors.primary }]}>
                Outline
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.sampleButton,
                {
                  backgroundColor: selectedColors.surfaceStrong,
                  borderWidth: 1,
                  borderColor: selectedColors.border,
                }
              ]}
            >
              <Text style={[s.buttonText, { color: selectedColors.textPrimary }]}>
                Secondary
              </Text>
            </TouchableOpacity>
          </View>

          {/* Text Colors Demo */}
          <View
            style={[
              s.textDemo,
              {
                backgroundColor: selectedColors.surfaceStrong,
                borderColor: selectedColors.border,
              }
            ]}
          >
            <Text style={[s.demoLabel, { color: selectedColors.textTertiary }]}>
              Text Colors
            </Text>
            <Text style={[s.textPrimary, { color: selectedColors.textPrimary }]}>
              Primary Text - Most important content
            </Text>
            <Text style={[s.textSecondary, { color: selectedColors.textSecondary }]}>
              Secondary Text - Regular content
            </Text>
            <Text style={[s.textTertiary, { color: selectedColors.textTertiary }]}>
              Tertiary Text - Subtle/disabled text
            </Text>
          </View>

          {/* Theme Info */}
          <View
            style={[
              s.infoBox,
              {
                backgroundColor: selectedColors.primary + '10',
                borderColor: selectedColors.primary,
                borderWidth: 1,
              }
            ]}
          >
            <Text style={[s.infoTitle, { color: selectedColors.primary }]}>
              Current Theme: {getThemeName(selectedTheme)}
            </Text>
            <Text style={[s.infoText, { color: selectedColors.textSecondary }]}>
              This theme is now applied to your entire app experience.
            </Text>
          </View>

          {/* Spacing for scroll */}
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  themeListContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  themeListContent: {
    paddingRight: 16,
    gap: 8,
  },
  themeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    minWidth: 120,
  },
  themeColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  themeButtonText: {
    fontSize: 12,
    flex: 1,
  },
  previewSection: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 16,
  },
  sampleBox: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 16,
    gap: 4,
  },
  boxText: {
    fontSize: 16,
    fontWeight: '800',
  },
  boxSubText: {
    fontSize: 13,
    fontWeight: '500',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sampleButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  textDemo: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  demoLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textPrimary: {
    fontSize: 14,
    fontWeight: '600',
  },
  textSecondary: {
    fontSize: 13,
    fontWeight: '500',
  },
  textTertiary: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoBox: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  infoText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

