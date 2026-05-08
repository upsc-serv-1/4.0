/**
 * Capsule navigation customization — adds capsule to the tab order ordering
 * helper so the bottom tab bar exposes the new tab.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TabKey = 'index' | 'arena' | 'analyse' | 'pyq' | 'flashcards' | 'tags' | 'notes' | 'hardnotes' | 'capsule' | 'softnotes' | 'revise' | 'tracker' | 'noji_hub' | 'ai-search' | 'pilot-v2';

const DEFAULT_TAB_ORDER: TabKey[] = ['index', 'arena', 'analyse', 'pyq', 'flashcards', 'ai-search', 'tags', 'notes', 'hardnotes', 'capsule', 'pilot-v2', 'softnotes', 'revise', 'tracker', 'noji_hub'];

const normalizeOrder = (order: TabKey[]): TabKey[] => {
  const cleaned = order.filter((key, index) => order.indexOf(key) === index);
  DEFAULT_TAB_ORDER.forEach((key) => {
    if (!cleaned.includes(key)) cleaned.push(key);
  });

  // Hardnotes must always be visible in tab customization/order.
  if (!cleaned.includes('hardnotes')) cleaned.push('hardnotes');

  return cleaned;
};

export const TabConfigService = {
  async getTabOrder(): Promise<TabKey[]> {
    try {
      const stored = await AsyncStorage.getItem('user_tab_order');
      if (stored) {
        const parsed = JSON.parse(stored) as TabKey[];
        return normalizeOrder(Array.isArray(parsed) ? parsed : DEFAULT_TAB_ORDER);
      }
    } catch (e) {
      console.error('Failed to load tab order', e);
    }
    return normalizeOrder(DEFAULT_TAB_ORDER);
  },

  async setTabOrder(order: TabKey[]) {
    try {
      await AsyncStorage.setItem('user_tab_order', JSON.stringify(normalizeOrder(order)));
    } catch (e) {
      console.error('Failed to save tab order', e);
    }
  }
};
