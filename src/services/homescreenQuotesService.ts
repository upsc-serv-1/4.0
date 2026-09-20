import AsyncStorage from '@react-native-async-storage/async-storage';
import { KVStore } from '../lib/kvStore';
import { supabase } from '../lib/supabase';

export interface HomescreenQuote {
  id: string;
  text: string;
  author: string;
  is_active: boolean;
  source?: string;
  created_at?: string;
}

const DEFAULT_USER_QUOTES: HomescreenQuote[] = [
  { id: '1', text: 'You have to dream before your dreams can come true.', author: 'Dr. A.P.J. Abdul Kalam', is_active: true },
  { id: '2', text: 'If you want to shine like a sun, first burn like a sun.', author: 'Dr. A.P.J. Abdul Kalam', is_active: true },
  { id: '3', text: 'To succeed in your mission, you must have single-minded devotion to your goal.', author: 'Dr. A.P.J. Abdul Kalam', is_active: true },
  { id: '4', text: 'Excellence happens not by accident. It is a process.', author: 'Dr. A.P.J. Abdul Kalam', is_active: true },
  { id: '5', text: 'Man needs difficulties in life because they are necessary to enjoy success.', author: 'Dr. A.P.J. Abdul Kalam', is_active: true }
];

export async function getHomescreenQuotes(userId?: string): Promise<HomescreenQuote[]> {
  try {
    // 1. MMKV Local cache
    const cacheKey = 'user_quotes_cache_' + (userId || 'global');
    const localKv = KVStore.getJson<HomescreenQuote[]>(cacheKey) || KVStore.getJson<HomescreenQuote[]>('user_quotes_cache');
    if (Array.isArray(localKv) && localKv.length > 0) {
      return localKv;
    }

    // 2. AsyncStorage
    const cached = await AsyncStorage.getItem(`custom_quotes_${userId || 'guest'}`) || await AsyncStorage.getItem('custom_quotes_global');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    // 3. Supabase Cloud Sync
    if (userId && userId !== 'guest') {
      const { data } = await supabase
        .from('user_notes')
        .select('content')
        .eq('user_id', userId)
        .eq('subject', '__user_quotes__')
        .maybeSingle();

      if (data?.content) {
        const cloudQuotes = JSON.parse(data.content);
        if (Array.isArray(cloudQuotes) && cloudQuotes.length > 0) {
          KVStore.setJson(cacheKey, cloudQuotes);
          KVStore.setJson('user_quotes_cache', cloudQuotes);
          return cloudQuotes;
        }
      }
    }

    return DEFAULT_USER_QUOTES;
  } catch (e) {
    console.warn('[homescreenQuotesService] getHomescreenQuotes error:', e);
    return DEFAULT_USER_QUOTES;
  }
}

export async function saveHomescreenQuotes(newQuotes: HomescreenQuote[], userId?: string): Promise<void> {
  try {
    const cacheKey = 'user_quotes_cache_' + (userId || 'global');
    KVStore.setJson(cacheKey, newQuotes);
    KVStore.setJson('user_quotes_cache', newQuotes);
    await AsyncStorage.setItem(`custom_quotes_${userId || 'guest'}`, JSON.stringify(newQuotes));
    await AsyncStorage.setItem('custom_quotes_global', JSON.stringify(newQuotes));

    if (userId && userId !== 'guest') {
      const { data: existing } = await supabase
        .from('user_notes')
        .select('id')
        .eq('user_id', userId)
        .eq('subject', '__user_quotes__')
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from('user_notes')
          .update({
            content: JSON.stringify(newQuotes),
            title: 'Custom Quotes',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('user_notes')
          .insert({
            user_id: userId,
            subject: '__user_quotes__',
            title: 'Custom Quotes',
            content: JSON.stringify(newQuotes),
          });
      }
    }
  } catch (e) {
    console.warn('[homescreenQuotesService] saveHomescreenQuotes error:', e);
  }
}

export async function addQuoteToHomescreen(
  quote: { text: string; author?: string; id?: string; source?: string },
  userId?: string
): Promise<{ success: boolean; isNew: boolean }> {
  try {
    const current = await getHomescreenQuotes(userId);
    const cleanText = quote.text.trim();
    if (!cleanText) return { success: false, isNew: false };

    // Check if already present by text (normalized) or id
    const existingIdx = current.findIndex(
      q => (quote.id && (q.id === quote.id || q.id === `va_${quote.id}`)) || q.text.trim().toLowerCase() === cleanText.toLowerCase()
    );

    if (existingIdx !== -1) {
      // Make sure it's active
      if (!current[existingIdx].is_active) {
        current[existingIdx].is_active = true;
        await saveHomescreenQuotes(current, userId);
      }
      return { success: true, isNew: false };
    }

    const newQuote: HomescreenQuote = {
      id: quote.id ? `va_${quote.id}` : `uq_${Date.now()}`,
      text: cleanText,
      author: quote.author?.trim() || 'Mains Value Add',
      is_active: true,
      source: quote.source,
      created_at: new Date().toISOString(),
    };

    const updated = [newQuote, ...current];
    await saveHomescreenQuotes(updated, userId);
    return { success: true, isNew: true };
  } catch (e) {
    console.warn('[homescreenQuotesService] addQuoteToHomescreen error:', e);
    return { success: false, isNew: false };
  }
}

export async function removeQuoteFromHomescreen(
  quoteIdOrText: string,
  userId?: string
): Promise<boolean> {
  try {
    const current = await getHomescreenQuotes(userId);
    const target = quoteIdOrText.trim().toLowerCase();
    const updated = current.filter(
      q => q.id !== quoteIdOrText && `va_${q.id}` !== quoteIdOrText && q.id !== `va_${quoteIdOrText}` && q.text.trim().toLowerCase() !== target
    );

    await saveHomescreenQuotes(updated.length > 0 ? updated : DEFAULT_USER_QUOTES, userId);
    return true;
  } catch (e) {
    console.warn('[homescreenQuotesService] removeQuoteFromHomescreen error:', e);
    return false;
  }
}

export function isQuoteOnHomescreenSync(quoteIdOrText: string, userId?: string): boolean {
  try {
    const cacheKey = 'user_quotes_cache_' + (userId || 'global');
    const localKv = KVStore.getJson<HomescreenQuote[]>(cacheKey) || KVStore.getJson<HomescreenQuote[]>('user_quotes_cache');
    if (!Array.isArray(localKv)) return false;
    const target = quoteIdOrText.trim().toLowerCase();
    return localKv.some(
      q => (q.id === quoteIdOrText || `va_${q.id}` === quoteIdOrText || q.id === `va_${quoteIdOrText}`) ||
           (q.text && q.text.trim().toLowerCase() === target)
    );
  } catch {
    return false;
  }
}
