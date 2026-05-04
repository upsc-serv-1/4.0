import { OfflineManager } from './OfflineManager';

const sources: Record<string, () => any[]> = {
  questions: () => (OfflineManager as any).getOfflineQuestionsEnrichedSync?.()
    ?? (OfflineManager as any).getCollectionSync('questions')
    ?? [],
  tests: () => OfflineManager.getOfflineTestsSync(),
  question_states: () => (OfflineManager as any).getCollectionSync('question_states') ?? [],
  test_attempts: () => (OfflineManager as any).getCollectionSync('test_attempts') ?? [],
  cards: () => (OfflineManager as any).getCollectionSync('cards') ?? [],
  user_cards: () => (OfflineManager as any).getCollectionSync('user_cards') ?? [],
  card_reviews: () => (OfflineManager as any).getCollectionSync('card_reviews') ?? [],
  study_sessions: () => (OfflineManager as any).getCollectionSync('study_sessions') ?? [],
  user_notes: () => (OfflineManager as any).getCollectionSync('user_notes') ?? [],
  user_note_nodes: () => (OfflineManager as any).getCollectionSync('user_note_nodes') ?? [],
  folders: () => (OfflineManager as any).getCollectionSync('folders') ?? [],
  flashcard_branches: () => (OfflineManager as any).getCollectionSync('flashcard_branches') ?? [],
  flashcard_branch_cards: () => (OfflineManager as any).getCollectionSync('flashcard_branch_cards') ?? [],
  draft_attempts: () => (OfflineManager as any).getCollectionSync('draft_attempts') ?? [],
  user_settings: () => (OfflineManager as any).getCollectionSync('user_settings') ?? [],
  user_widgets: () => (OfflineManager as any).getCollectionSync('user_widgets') ?? [],
};

const stripQuotes = (v: string) => v.trim().replace(/^["']|["']$/g, '');
const parseList = (raw: string) => raw
  .replace(/^\(|\)$/g, '')
  .replace(/^\{|\}$/g, '')
  .replace(/^\[|\]$/g, '')
  .split(',')
  .map(stripQuotes)
  .filter((x) => x.length > 0);

const normalize = (v: any) => {
  if (v === true || v === false || v == null) return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null') return null;
  return stripQuotes(String(v));
};

const ilike = (hay: any, pattern: string) => {
  const v = String(hay ?? '').toLowerCase();
  const p = stripQuotes(pattern).toLowerCase().replace(/^%|%$/g, '');
  if (pattern.startsWith('%') && pattern.endsWith('%')) return v.includes(p);
  if (pattern.endsWith('%')) return v.startsWith(p);
  if (pattern.startsWith('%')) return v.endsWith(p);
  return v === p;
};

const splitTopLevel = (expr: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of expr) {
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    if (ch === ')' || ch === '}' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf) parts.push(buf);
  return parts;
};

const matchOrExpr = (row: any, expr: string): boolean =>
  splitTopLevel(expr).some((part) => {
    const m = part.match(/^([^.]+)\.([a-z]+)\.(.*)$/);
    if (!m) return false;
    const [, col, op, raw] = m;
    const v = row?.[col];
    const val = normalize(raw);
    switch (op) {
      case 'eq': return normalize(v) === val;
      case 'neq': return normalize(v) !== val;
      case 'gt': return Number(v) > Number(raw);
      case 'gte': return Number(v) >= Number(raw);
      case 'lt': return Number(v) < Number(raw);
      case 'lte': return Number(v) <= Number(raw);
      case 'is': return val === null ? v == null : normalize(v) === val;
      case 'ilike':
      case 'like': return ilike(v, raw);
      case 'in': return parseList(raw).includes(String(normalize(v)));
      case 'cs': {
        const list = parseList(raw);
        return Array.isArray(v) && list.every((x) => v.map(String).includes(String(x)));
      }
      case 'cd': {
        const list = parseList(raw);
        return Array.isArray(v) && v.every((x: any) => list.includes(String(x)));
      }
      default: return false;
    }
  });

class Query {
  private rows: any[];
  private filters: { col: string; op: string; val: any }[] = [];
  private orFilters: string[] = [];
  private orderRules: { col: string; asc: boolean }[] = [];
  private rangeFrom?: number;
  private rangeTo?: number;
  private wantCount = false;
  private singleRow = false;
  private maybeSingleRow = false;

  constructor(table: string) {
    const src = sources[table];
    this.rows = src ? src().filter((r: any) => !r.deleted && !r.is_deleted) : [];
  }

  select(_cols: string = '*', opts?: { count?: 'exact'; head?: boolean }) {
    if (opts?.count === 'exact') this.wantCount = true;
    return this;
  }
  eq(c: string, v: any) { this.filters.push({ col: c, op: 'eq', val: v }); return this; }
  neq(c: string, v: any) { this.filters.push({ col: c, op: 'neq', val: v }); return this; }
  gt(c: string, v: any) { this.filters.push({ col: c, op: 'gt', val: v }); return this; }
  gte(c: string, v: any) { this.filters.push({ col: c, op: 'gte', val: v }); return this; }
  lt(c: string, v: any) { this.filters.push({ col: c, op: 'lt', val: v }); return this; }
  lte(c: string, v: any) { this.filters.push({ col: c, op: 'lte', val: v }); return this; }
  is(c: string, v: any) { this.filters.push({ col: c, op: 'is', val: v }); return this; }
  in(c: string, v: any[]) { this.filters.push({ col: c, op: 'in', val: v }); return this; }
  ilike(c: string, p: string) { this.filters.push({ col: c, op: 'ilike', val: p }); return this; }
  like(c: string, p: string) { this.filters.push({ col: c, op: 'like', val: p }); return this; }
  contains(c: string, v: any[]) { this.filters.push({ col: c, op: 'cs', val: v }); return this; }
  not(c: string, op: string, v: any) {
    this.filters.push({ col: c, op: op === 'eq' ? 'neq' : 'neq', val: v });
    return this;
  }
  or(expr: string) { this.orFilters.push(expr); return this; }
  order(c: string, o?: { ascending?: boolean }) {
    this.orderRules.push({ col: c, asc: o?.ascending !== false });
    return this;
  }
  limit(n: number) { this.rangeFrom = 0; this.rangeTo = n - 1; return this; }
  range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this; }
  single() { this.singleRow = true; return this; }
  maybeSingle() { this.maybeSingleRow = true; return this; }

  private apply(): any[] {
    let out = this.rows;
    for (const f of this.filters) {
      out = out.filter((r: any) => {
        const v = r?.[f.col];
        switch (f.op) {
          case 'eq': return normalize(v) === normalize(f.val);
          case 'neq': return normalize(v) !== normalize(f.val);
          case 'gt': return Number(v) > Number(f.val);
          case 'gte': return Number(v) >= Number(f.val);
          case 'lt': return Number(v) < Number(f.val);
          case 'lte': return Number(v) <= Number(f.val);
          case 'is': return f.val == null ? v == null : normalize(v) === normalize(f.val);
          case 'in': return (f.val as any[]).map((x) => String(normalize(x))).includes(String(normalize(v)));
          case 'ilike':
          case 'like': return ilike(v, f.val);
          case 'cs': return Array.isArray(v) && (f.val as any[]).every((x) => v.map(String).includes(String(x)));
          default: return true;
        }
      });
    }
    for (const expr of this.orFilters) out = out.filter((r: any) => matchOrExpr(r, expr));

    if (this.orderRules.length > 0) {
      const rules = this.orderRules;
      out = [...out].sort((a, b) => {
        for (const rule of rules) {
          const av = a?.[rule.col];
          const bv = b?.[rule.col];
          const asc = rule.asc ? 1 : -1;
          let cmp = 0;
          if (av == null && bv == null) cmp = 0;
          else if (av == null) cmp = -1;
          else if (bv == null) cmp = 1;
          else if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
          else cmp = String(av).localeCompare(String(bv));
          if (cmp !== 0) return cmp * asc;
        }
        return 0;
      });
    }
    return out;
  }

  then<T = any>(
    onFulfilled?: (v: { data: any; count: number | null; error: null }) => T,
    onRejected?: (reason: any) => T,
  ) {
    try {
      const all = this.apply();
      const total = all.length;
      let data: any = all;
      if (this.rangeFrom !== undefined && this.rangeTo !== undefined) {
        data = all.slice(this.rangeFrom, this.rangeTo + 1);
      }
      if (this.singleRow || this.maybeSingleRow) data = all[0] ?? null;
      const value = { data, count: this.wantCount ? total : null, error: null };
      return Promise.resolve(onFulfilled ? onFulfilled(value) : (value as any));
    } catch (err) {
      if (onRejected) return Promise.resolve(onRejected(err));
      return Promise.reject(err);
    }
  }
}

export const LocalQuery = { from(table: string) { return new Query(table); } };
export default LocalQuery;
