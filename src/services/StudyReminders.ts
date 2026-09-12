/**
 * StudyReminders — Issue 28
 * -------------------------
 * Lightweight in-app reminder scheduler that works in Expo Go without
 * the `expo-notifications` native module. Uses `setInterval` + a single
 * AsyncStorage-backed config so reminders survive cold starts.
 *
 * When the app comes to the foreground and the next-due timestamp has
 * passed, an in-app banner is shown via the `subscribe()` callback. To
 * upgrade to OS-level push notifications later, swap the `triggerBanner`
 * function with an `expo-notifications` `scheduleNotificationAsync` call.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';

const STORAGE_KEY = 'pilot-v2:study-reminders';

export interface StudyReminderConfig {
  enabled: boolean;
  /** Reminders per day (1..6). */
  frequency: number;
  /** Quiet hours — silent between these (24h clock). */
  silentStart: number;
  silentEnd: number;
  /** Optional list of subjects to remind about. */
  subjects: string[];
  /** Last fired timestamp, for de-duping. */
  lastFiredAt?: string;
}

const DEFAULT_CONFIG: StudyReminderConfig = {
  enabled: false,
  frequency: 2,
  silentStart: 22, // 10 PM
  silentEnd: 7,    // 7 AM
  subjects: [],
};

export async function getStudyRemindersConfig(): Promise<StudyReminderConfig> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function setStudyRemindersConfig(
  next: Partial<StudyReminderConfig>,
): Promise<StudyReminderConfig> {
  const cur = await getStudyRemindersConfig();
  const merged = { ...cur, ...next };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

/** Returns true when the current local hour falls in the silent window. */
export function isInSilentHours(
  now: Date,
  silentStart: number,
  silentEnd: number,
): boolean {
  const h = now.getHours();
  if (silentStart === silentEnd) return false;
  if (silentStart < silentEnd) return h >= silentStart && h < silentEnd;
  return h >= silentStart || h < silentEnd; // wraps across midnight
}

type Listener = (msg: { title: string; body: string; subject?: string }) => void;
const listeners = new Set<Listener>();

export function subscribeStudyReminders(fn: Listener) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

let intervalRef: any = null;
let appStateSub: { remove: () => void } | null = null;

/** Start the polling loop. Idempotent — calling twice is a no-op.
 *  Auto-stops on background and resumes on foreground. */
export function startStudyReminders() {
  if (intervalRef) return;
  const tick = async () => {
    const cfg = await getStudyRemindersConfig();
    if (!cfg.enabled) return;
    const now = new Date();
    if (isInSilentHours(now, cfg.silentStart, cfg.silentEnd)) return;

    // De-dup using lastFiredAt — fire at most once per (24/frequency)h.
    const minHoursBetween = Math.max(1, Math.floor(24 / cfg.frequency));
    if (cfg.lastFiredAt) {
      const last = new Date(cfg.lastFiredAt);
      if (now.getTime() - last.getTime() < minHoursBetween * 3600 * 1000) return;
    }

    const subject = cfg.subjects.length
      ? cfg.subjects[Math.floor(Math.random() * cfg.subjects.length)]
      : undefined;
    const title = subject ? `Time to review ${subject}` : 'Time for spaced revision';
    const body = subject
      ? `Your ${subject} flashcards are waiting — keep your streak alive.`
      : 'Open Pilot V2 to clear today’s due cards.';

    listeners.forEach((fn) => {
      try { fn({ title, body, subject }); } catch { /* ignore */ }
    });
    await setStudyRemindersConfig({ lastFiredAt: now.toISOString() });
  };

  intervalRef = setInterval(tick, 60 * 1000);
  // Pause polling when the app is backgrounded; resume on foreground.
  if (!appStateSub) {
    appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        if (!intervalRef) intervalRef = setInterval(tick, 60 * 1000);
      } else if (intervalRef) {
        clearInterval(intervalRef);
        intervalRef = null;
      }
    });
  }
}

export function stopStudyReminders() {
  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
  }
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
}
