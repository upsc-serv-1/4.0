import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layers, Play, Loader2, ChevronRight } from 'lucide-react';

/**
 * Smart Dedup Manager (Branch 5.3).
 *
 * Lets an admin:
 *   • Pick subjects (multi / all)
 *   • Pick a year range (or single year, or all years)
 *   • Run a fuzzy-merge PREVIEW that mirrors the mobile app's
 *     `mergeQuestions()` logic — same year + token-Jaccard >= 0.78
 *     across is_pyq=true AND is_upsc_cse=true questions.
 *   • Pick a "Default Explanation" institute per cluster (saved to localStorage).
 *
 * The actual runtime dedupe in the mobile app is automatic (per user request);
 * this page is purely a safe inspection / override tool.
 */

const STOPWORDS = new Set([
  'the','a','an','of','in','to','and','or','is','are','was','were','for','on','at',
  'by','with','as','that','this','it','be','from','which','has','have','had','not',
  'consider','statements','following','statement','correct','given','above','below',
]);

const cleanText = (s: string) =>
  String(s || '').replace(/<[^>]*>/g, ' ').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const tokenize = (s: string) =>
  cleanText(s).split(' ').filter(t => t.length > 2 && !STOPWORDS.has(t));

const jaccard = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let inter = 0; for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
};

type Cluster = {
  canonicalId: string;
  canonicalText: string;
  year: string;
  members: Array<{ id: string; institute: string; text: string; explanation: string; answer: string }>;
};

export default function DedupManager() {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');
  const [running, setRunning] = useState(false);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [stats, setStats] = useState<{ total: number; merged: number; saved: number } | null>(null);
  const [defaults, setDefaults] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('dedup_default_explanations') || '{}'); }
    catch { return {}; }
  });

  const loadSubjects = async () => {
    if (allSubjects.length) return;
    const { data } = await supabase.from('questions')
      .select('subject').eq('is_pyq', true).eq('is_upsc_cse', true).limit(5000);
    const uniq = Array.from(new Set((data || []).map((r: any) => r.subject).filter(Boolean))).sort();
    setAllSubjects(uniq as string[]);
  };

  const runDedup = async () => {
    setRunning(true);
    setClusters([]);
    setStats(null);
    try {
      let query = supabase.from('questions')
        .select('id, question_text, explanation_markdown, correct_answer, subject, exam_year, test_id, tests(institute)')
        .eq('is_pyq', true).eq('is_upsc_cse', true).limit(10000);
      if (subjects.length) query = query.in('subject', subjects);
      if (yearStart) query = query.gte('exam_year', yearStart);
      if (yearEnd) query = query.lte('exam_year', yearEnd);
      const { data, error } = await query;
      if (error) throw error;
      const rows: any[] = data || [];

      const buckets = new Map<string, any[]>();
      for (const r of rows) {
        const year = String(r.exam_year || 'NA');
        const tokens = new Set(tokenize(r.question_text));
        const inst = (Array.isArray(r.tests) ? r.tests[0]?.institute : r.tests?.institute) || 'UPSC';
        const list = buckets.get(year) || [];
        let best: { c: any; s: number } | null = null;
        for (const c of list) {
          const sc = jaccard(tokens, c.__tokens);
          if (sc > (best?.s || 0)) best = { c, s: sc };
        }
        if (best && best.s >= 0.78) {
          best.c.members.push({
            id: r.id, institute: inst,
            text: r.question_text || '',
            explanation: r.explanation_markdown || '',
            answer: r.correct_answer || '',
          });
          if ((r.question_text || '').length > best.c.canonicalText.length) {
            best.c.canonicalText = r.question_text || '';
            best.c.canonicalId = r.id;
          }
        } else {
          list.push({
            __tokens: tokens,
            canonicalId: r.id,
            canonicalText: r.question_text || '',
            year,
            members: [{
              id: r.id, institute: inst,
              text: r.question_text || '',
              explanation: r.explanation_markdown || '',
              answer: r.correct_answer || '',
            }],
          });
          buckets.set(year, list);
        }
      }

      const out: Cluster[] = [];
      let merged = 0;
      for (const list of buckets.values()) {
        for (const c of list) {
          const { __tokens, ...rest } = c;
          out.push(rest as Cluster);
          if (c.members.length > 1) merged += c.members.length - 1;
        }
      }
      setClusters(out.sort((a, b) => b.members.length - a.members.length));
      setStats({ total: rows.length, merged, saved: rows.length - merged });
    } catch (e: any) {
      alert('Dedup failed: ' + e.message);
    } finally { setRunning(false); }
  };

  const setDefault = (clusterId: string, institute: string) => {
    const next = { ...defaults, [clusterId]: institute };
    setDefaults(next);
    localStorage.setItem('dedup_default_explanations', JSON.stringify(next));
  };

  const toggleSubject = (s: string) => {
    setSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-2">
        <Layers className="text-primary" />
        <h1 className="text-3xl font-black">Smart Dedup Manager</h1>
      </div>
      <p className="text-muted mb-6">
        Fuzzy-clusters UPSC PYQ questions across coaching institutes by year & token similarity (≥78%).
      </p>

      <div className="bg-panel border border-border rounded-xl p-5 mb-6 space-y-4">
        <div>
          <div className="text-xs text-muted font-bold tracking-widest mb-2">SUBJECTS</div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { loadSubjects(); setSubjects([]); }}
              className={`px-3 py-1.5 rounded text-xs font-bold border ${subjects.length === 0 ? 'bg-primary text-black border-primary' : 'border-border'}`}>
              All Subjects
            </button>
            <button onClick={loadSubjects}
              className="px-3 py-1.5 rounded text-xs font-bold border border-border">
              {allSubjects.length ? 'Subjects loaded' : 'Load subject list'}
            </button>
            {allSubjects.map(s => (
              <button key={s} onClick={() => toggleSubject(s)}
                className={`px-3 py-1.5 rounded text-xs font-bold border ${subjects.includes(s) ? 'bg-primary text-black border-primary' : 'border-border'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 items-end">
          <div>
            <div className="text-xs text-muted font-bold tracking-widest mb-1">YEAR FROM</div>
            <input type="number" value={yearStart} onChange={e => setYearStart(e.target.value)}
              placeholder="2018" className="bg-bg border border-border rounded px-3 py-2 w-28" />
          </div>
          <div>
            <div className="text-xs text-muted font-bold tracking-widest mb-1">YEAR TO</div>
            <input type="number" value={yearEnd} onChange={e => setYearEnd(e.target.value)}
              placeholder="2024" className="bg-bg border border-border rounded px-3 py-2 w-28" />
          </div>
          <button onClick={runDedup} disabled={running}
            className="ml-auto flex items-center gap-2 bg-primary text-black font-black px-5 py-2.5 rounded disabled:opacity-50">
            {running ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
            {running ? 'Analyzing…' : 'Run Dedup'}
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="Rows scanned" value={stats.total} />
          <Stat label="Duplicates merged" value={stats.merged} />
          <Stat label="Unique after dedup" value={stats.saved} />
        </div>
      )}

      <div className="space-y-3">
        {clusters.filter(c => c.members.length > 1).map(c => (
          <div key={c.canonicalId} className="bg-panel border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black tracking-widest text-primary bg-primary/10 px-2 py-1 rounded">{c.year}</span>
              <span className="text-[10px] font-black tracking-widest text-muted">{c.members.length} INSTITUTES</span>
            </div>
            <div className="text-sm font-semibold mb-3 line-clamp-2">{c.canonicalText.replace(/<[^>]*>/g, '')}</div>
            <div className="flex flex-wrap gap-2">
              {c.members.map(m => {
                const isDefault = defaults[c.canonicalId] === m.institute;
                return (
                  <button key={m.id} onClick={() => setDefault(c.canonicalId, m.institute)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${isDefault ? 'bg-primary text-black border-primary' : 'border-border text-muted hover:text-ink'}`}>
                    {m.institute}
                    {isDefault && <ChevronRight size={12} />}
                  </button>
                );
              })}
            </div>
            {defaults[c.canonicalId] && (
              <div className="text-[10px] text-muted mt-2">
                Default explanation = <span className="text-primary font-bold">{defaults[c.canonicalId]}</span>
              </div>
            )}
          </div>
        ))}
        {!running && clusters.length > 0 && clusters.every(c => c.members.length === 1) && (
          <div className="text-muted text-sm">No duplicate clusters found in this slice.</div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-panel border border-border rounded-xl p-4">
      <div className="text-3xl font-black">{value}</div>
      <div className="text-muted text-[10px] tracking-widest font-bold mt-1">{label.toUpperCase()}</div>
    </div>
  );
}
