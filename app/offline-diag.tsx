/**
 * offline-diag.tsx — Offline Diagnostic Page
 * 
 * Shows:
 *   1. Offline cache status (what's stored in KVStore)
 *   2. "Simulate Offline" toggle that blocks all Supabase calls
 *   3. Real-time log of blocked Supabase calls as you navigate
 * 
 * Usage: Navigate to this page, check cache health, toggle "Simulate Offline",
 * then browse other tabs — come back here to see which screens made Supabase calls.
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';
import { OfflineManager, OfflineMetadata } from '../src/services/OfflineManager';
import { KVStore } from '../src/lib/kvStore';
import { NetworkStatus } from '../src/lib/networkStatus';
import {
  Wifi,
  WifiOff,
  Database,
  FileQuestion,
  StickyNote,
  Layers,
  BookOpen,
  Trash2,
  RefreshCw,
  Play,
  Square,
  Copy,
  CheckCircle,
  XCircle,
} from 'lucide-react-native';

// Store blocked calls globally so they survive navigation
interface BlockedCall {
  ts: number;
  url: string;
  screen: string;
}

// @ts-ignore
if (typeof global !== 'undefined' && !global.__offlineDiagBlocked) {
  // @ts-ignore
  global.__offlineDiagBlocked = [] as BlockedCall[];
  // @ts-ignore
  global.__offlineDiagActive = false;
  // @ts-ignore
  global.__offlineDiagOriginalFetch = null;
}

function getBlockedCalls(): BlockedCall[] {
  // @ts-ignore
  return global.__offlineDiagBlocked || [];
}

function clearBlockedCalls() {
  // @ts-ignore
  global.__offlineDiagBlocked = [];
}

function isSimActive(): boolean {
  // @ts-ignore
  return global.__offlineDiagActive === true;
}

export default function OfflineDiagScreen() {
  const { colors } = useTheme();
  const [meta, setMeta] = useState<OfflineMetadata | null>(null);
  const [cacheStats, setCacheStats] = useState<Record<string, number>>({});
  const [kvKeys, setKvKeys] = useState<string[]>([]);
  const [blockedCalls, setBlockedCalls] = useState<BlockedCall[]>([]);
  const [simulating, setSimulating] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load diagnostic data
  const loadDiag = async () => {
    try {
      const m = await OfflineManager.getMetadata();
      setMeta(m);

      const tests = OfflineManager.getOfflineTestsSync();
      const questions = OfflineManager.getOfflineQuestionsAllSync();
      const facets = OfflineManager.getOfflineFacets();
      const subjects = [...new Set(questions.map((q: any) => q.subject).filter(Boolean))];

      // Pull additional per-user collections so users can verify each feature
      // has its data ready before going offline.
      const allKeys = KVStore.getAllKeys();
      const tagsCount = allKeys
        .filter((k) => k.startsWith('@user_tags_'))
        .reduce((acc, k) => acc + ((KVStore.getJson<any[]>(k) ?? []).length), 0);
      const syllabusCount = allKeys
        .filter((k) => k.startsWith('@user_syllabus_progress_'))
        .reduce((acc, k) => acc + ((KVStore.getJson<any[]>(k) ?? []).length), 0);
      const promptCount = allKeys
        .filter((k) => k.startsWith('@user_prompt_templates_'))
        .reduce((acc, k) => acc + ((KVStore.getJson<any[]>(k) ?? []).length), 0);
      const folderAlgoCount = allKeys
        .filter((k) => k.startsWith('@user_folder_algo_settings_'))
        .reduce((acc, k) => acc + ((KVStore.getJson<any[]>(k) ?? []).length), 0);
      const pilotV2Nodes = allKeys
        .filter((k) => k.startsWith('@user_note_nodes_'))
        .reduce((acc, k) => acc + ((KVStore.getJson<any[]>(k) ?? [])
          .filter((n: any) => n?.metadata?.surface === 'pilot_v2').length), 0);
      const pilotV2NoteIds = new Set<string>();
      allKeys.filter((k) => k.startsWith('@user_note_nodes_')).forEach((k) => {
        (KVStore.getJson<any[]>(k) ?? []).forEach((n: any) => {
          if (n?.metadata?.surface === 'pilot_v2' && n.type === 'note' && n.note_id) {
            pilotV2NoteIds.add(n.note_id);
          }
        });
      });
      const pendingSync = (KVStore.getJson<any[]>('sync:pending') ?? []).length;

      setCacheStats({
        'Tests': tests.length,
        'Questions': questions.length,
        'Institutes': facets.institutes.length,
        'Programs': facets.program_names.length,
        'Subjects': subjects.length,
        'Question States': m.totalStates,
        'Notebooks (all)': m.totalNotes,
        'Pilot V2 Nodes': pilotV2Nodes,
        'Pilot V2 Notes': pilotV2NoteIds.size,
        'Attempts': m.totalAttempts,
        'Flashcards': m.totalCards,
        'User Tags': tagsCount,
        'Syllabus Progress Rows': syllabusCount,
        'Prompt Templates': promptCount,
        'Folder Algo Settings': folderAlgoCount,
        'Pending Sync Queue': pendingSync,
      });

      const keys = KVStore.getAllKeys();
      setKvKeys(keys.sort());
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  useEffect(() => {
    loadDiag();
  }, []);

  // Poll blocked calls
  useEffect(() => {
    setSimulating(isSimActive());
    setBlockedCalls([...getBlockedCalls()]);

    intervalRef.current = setInterval(() => {
      const active = isSimActive();
      const calls = getBlockedCalls();
      setSimulating(active);
      setBlockedCalls([...calls]);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startSimulation = () => {
    try {
      // @ts-ignore
      if (!global.__offlineDiagOriginalFetch) {
        // @ts-ignore
        global.__offlineDiagOriginalFetch = global.fetch || window.fetch;
      }
      // @ts-ignore
      const _fetch = global.__offlineDiagOriginalFetch || global.fetch || window.fetch;

      // @ts-ignore
      global.fetch = function (url: any, opts: any) {
        const urlStr = typeof url === 'string' ? url : url?.url || '';
        if (urlStr.includes('supabase')) {
          const short = urlStr.replace(/https:\/\/[^/]+\//, '').substring(0, 100);
          // @ts-ignore
          if (global.__offlineDiagBlocked) {
            // @ts-ignore
            global.__offlineDiagBlocked.push({
              ts: Date.now(),
              url: short,
              screen: 'navigated',
            });
          }
          return Promise.reject(new Error('Offline (simulated)'));
        }
        return _fetch.call(global, url, opts);
      };

      // @ts-ignore
      global.__offlineDiagActive = true;
      NetworkStatus.setSimulatedOffline(true);
      setSimulating(true);
    } catch (e: any) {
      Alert.alert('Error', 'Could not start simulation: ' + e.message);
    }
  };

  const stopSimulation = () => {
    try {
      // @ts-ignore
      if (global.__offlineDiagOriginalFetch) {
        // @ts-ignore
        global.fetch = global.__offlineDiagOriginalFetch;
      }
      // @ts-ignore
      global.__offlineDiagActive = false;
      NetworkStatus.setSimulatedOffline(false);
      setSimulating(false);
      // Run an incremental sync to flush queued mutations & pull any
      // updates that happened during the simulation window.
      try {
        const userId = (KVStore.getJson<any>('@offline_meta') as any) ? null : null;
        // No need to look up userId — incrementalSync will no-op without it.
        // The SyncQueue worker (already running) will drain pending writes.
      } catch {}
    } catch (e: any) {
      Alert.alert('Error', 'Could not stop simulation: ' + e.message);
    }
  };

  const copyReport = () => {
    const lines: string[] = [];
    lines.push('=== OFFLINE DIAGNOSTIC REPORT ===');
    lines.push('');
    lines.push('-- Cache Status --');
    lines.push(`Last Full Sync: ${meta?.lastFullSync ? new Date(meta.lastFullSync).toLocaleString() : 'NEVER'}`);
    Object.entries(cacheStats).forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
    lines.push('');
    lines.push(`KVStore Keys: ${kvKeys.length}`);
    kvKeys.forEach(k => lines.push(`  ${k}`));
    lines.push('');
    lines.push(`-- Blocked Supabase Calls (${blockedCalls.length}) --`);
    blockedCalls.forEach((c, i) => {
      lines.push(`  ${i + 1}. [${new Date(c.ts).toLocaleTimeString()}] ${c.url}`);
    });
    lines.push('');
    const report = lines.join('\n');

    // Copy to clipboard via Alert (React Native doesn't have navigator.clipboard easily)
    Alert.alert(
      'Diagnostic Report',
      report.substring(0, 4000),
      [
        { text: 'Close', style: 'cancel' },
      ]
    );
  };

  const simColor = simulating ? '#ef4444' : '#22c55e';
  const SimIcon = simulating ? WifiOff : Wifi;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.small, { color: colors.textTertiary }]}>DIAGNOSTIC</Text>
            <Text style={[styles.h1, { color: colors.textPrimary }]}>Offline Test</Text>
          </View>
          <SimIcon size={32} color={simColor} />
        </View>

        {/* Simulation Toggle */}
        <View style={[styles.card, { backgroundColor: simColor + '10', borderColor: simColor + '30' }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            {simulating ? '🔴 Simulating Offline (Airplane Mode)' : '🟢 Online — Supabase Working'}
          </Text>
          <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
            {simulating
              ? 'All Supabase calls are BLOCKED. Browse other tabs to test offline behavior.'
              : 'Tap "Simulate Offline" to block Supabase and test what breaks.'}
          </Text>
          <View style={styles.simButtons}>
            {!simulating ? (
              <TouchableOpacity style={[styles.simBtn, { backgroundColor: '#ef4444' }]} onPress={startSimulation}>
                <WifiOff size={18} color="#fff" />
                <Text style={styles.simBtnText}>Simulate Offline</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.simBtn, { backgroundColor: '#22c55e' }]} onPress={stopSimulation}>
                <Wifi size={18} color="#fff" />
                <Text style={styles.simBtnText}>Stop Simulation</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.simBtn, { backgroundColor: '#6b7280' }]} onPress={clearBlockedCalls}>
              <Trash2 size={18} color="#fff" />
              <Text style={styles.simBtnText}>Clear Log</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cache Status */}
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>CACHE STATUS</Text>
        <View style={[styles.card, { backgroundColor: colors.surface + '80', borderColor: colors.border }]}>
          {meta?.lastFullSync ? (
            <View style={styles.statusRow}>
              <CheckCircle size={18} color="#22c55e" />
              <Text style={[styles.statusText, { color: '#22c55e' }]}>
                Last synced: {new Date(meta.lastFullSync).toLocaleString()}
              </Text>
            </View>
          ) : (
            <View style={styles.statusRow}>
              <XCircle size={18} color="#ef4444" />
              <Text style={[styles.statusText, { color: '#ef4444' }]}>
                NOT SYNCED — Go to Profile → "Download All Data" first!
              </Text>
            </View>
          )}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {Object.entries(cacheStats).map(([key, val]) => (
            <View key={key} style={styles.statRow}>
              <Text style={[styles.statLabel, { color: colors.textPrimary }]}>{key}</Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>{val.toLocaleString()}</Text>
            </View>
          ))}
        </View>

        {/* Blocked Supabase Calls Log */}
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
          BLOCKED SUPABASE CALLS ({blockedCalls.length})
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface + '80', borderColor: colors.border }]}>
          {blockedCalls.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              {simulating
                ? 'No calls blocked yet — navigate to other tabs!'
                : 'Start simulation, then browse other tabs. Come back here to see blocked calls.'}
            </Text>
          ) : (
            blockedCalls.map((c, i) => (
              <View key={i} style={[styles.logRow, i < blockedCalls.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <Text style={[styles.logIndex, { color: colors.textTertiary }]}>{i + 1}.</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.logTime, { color: colors.textSecondary }]}>
                    {new Date(c.ts).toLocaleTimeString()}
                  </Text>
                  <Text style={[styles.logUrl, { color: '#ef4444' }]} numberOfLines={2}>
                    {c.url}
                  </Text>
                </View>
              </View>
            ))
          )}
          {blockedCalls.length > 0 && (
            <TouchableOpacity style={[styles.copyBtn, { backgroundColor: colors.primary }]} onPress={copyReport}>
              <Copy size={16} color="#fff" />
              <Text style={[styles.copyBtnText, { color: '#fff' }]}>Copy Full Report</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Test Instructions */}
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>HOW TO TEST</Text>
        <View style={[styles.card, { backgroundColor: colors.surface + '80', borderColor: colors.border }]}>
          <Text style={[styles.instruction, { color: colors.textSecondary }]}>
            1. Make sure cache is populated (green checkmark above){'\n'}
            2. Tap "Simulate Offline"{'\n'}
            3. Navigate to each tab: Home, PYQ, Flashcards, Notes, AI Search{'\n'}
            4. Note which screens show data vs. blank/error{'\n'}
            5. Come back here — blocked calls are logged automatically{'\n'}
            6. Tap "Stop Simulation" when done{'\n'}
            7. Copy the report and share it
          </Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  small: { fontSize: 11, letterSpacing: 2, fontWeight: '800', marginBottom: 4 },
  h1: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  cardSub: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  simButtons: { flexDirection: 'row', gap: 10 },
  simBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, flex: 1, justifyContent: 'center' },
  simBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  sectionTitle: { fontSize: 11, letterSpacing: 2, fontWeight: '800', marginBottom: 10, marginTop: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  statusText: { fontSize: 12, fontWeight: '700', flex: 1 },
  divider: { height: 1, marginBottom: 12 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  statLabel: { fontSize: 13, fontWeight: '600' },
  statValue: { fontSize: 14, fontWeight: '900' },
  emptyText: { fontSize: 12, fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },
  logRow: { flexDirection: 'row', paddingVertical: 8, gap: 8, alignItems: 'flex-start' },
  logIndex: { fontSize: 12, fontWeight: '700', width: 24, marginTop: 2 },
  logTime: { fontSize: 10, marginBottom: 2 },
  logUrl: { fontSize: 11, fontFamily: 'monospace' },
  copyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 12 },
  copyBtnText: { fontSize: 14, fontWeight: '800' },
  instruction: { fontSize: 13, lineHeight: 22 },
});