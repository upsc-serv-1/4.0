/**
 * pyqPredictive.ts — Deterministic predictive layer for the PYQ Analysis section.
 *
 * Input columns expected on each row (matching `public.questions` Supabase schema):
 *   - subject         (text)
 *   - section_group   (text)
 *   - micro_topic     (text)
 *   - exam_year       (integer)   // resolved upstream via getAnalyticsYear
 *   - is_pyq          (boolean)   // not required here, filtering happens upstream
 *
 * Pure functions only. No network, no React. Easy to unit test.
 */

export type GroupLevel = 'subject' | 'section_group' | 'micro_topic';

export interface PredictiveRow {
  key: string;                 // canonical bucket label
  level: GroupLevel;
  totalQuestions: number;
  byYear: Record<string, number>;
  fwi: number;                 // frequency-weighted importance (raw)
  slope: number;               // questions/year over last 6Y
  trend: 'rising' | 'falling' | 'stable';
  forecast2026: { point: number; low: number; high: number };
  streak: number;              // consecutive years with >=1 question (most recent run)
  hotScore: number;            // 0..100 normalised across the input set
}

export interface PredictiveOptions {
  level: GroupLevel;
  latestYear?: number;         // default: max year present
  halfLifeYears?: number;      // default: 4
  slopeWindow?: number;        // default: 6
  forecastWindow?: number;     // default: 8
  /** Resolves the bucket key from a row. Use the same `getAnalyticsSubject` you have. */
  getSubject?: (q: any) => string;
}

const safeNumber = (n: any) => {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
};

/** linear regression slope of (x, y) pairs */
function slope(xs: number[], ys: number[]): { m: number; b: number; resStd: number } {
  if (xs.length < 2) return { m: 0, b: ys[0] || 0, resStd: 0 };
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const m = den === 0 ? 0 : num / den;
  const b = meanY - m * meanX;
  // residual stdev for confidence band
  let ss = 0;
  for (let i = 0; i < n; i++) {
    const yhat = m * xs[i] + b;
    ss += (ys[i] - yhat) ** 2;
  }
  const resStd = Math.sqrt(ss / Math.max(1, n - 2));
  return { m, b, resStd };
}

function bucketKeyFor(q: any, level: GroupLevel, getSubject?: (q: any) => string): string {
  if (level === 'subject') return (getSubject ? getSubject(q) : (q.subject || 'Miscellaneous')).trim();
  if (level === 'section_group') return String(q.section_group || 'General').trim();
  return String(q.micro_topic || 'Other').trim();
}

/**
 * Compute predictive metrics for the chosen `level`.
 * `rows` are raw question rows from `public.questions`.
 * `getYear` is your existing year resolver (handles fallbacks via `tests` meta).
 */
export function buildPredictive(
  rows: any[],
  getYear: (q: any) => number | null,
  opts: PredictiveOptions
): PredictiveRow[] {
  const halfLife = opts.halfLifeYears ?? 4;
  const slopeWindow = opts.slopeWindow ?? 6;
  const forecastWindow = opts.forecastWindow ?? 8;

  // 1) aggregate counts per bucket per year
  const buckets = new Map<string, Record<string, number>>();
  let latest = opts.latestYear ?? -Infinity;

  for (const q of rows) {
    const y = getYear(q);
    if (!y) continue;
    if (y > latest) latest = y;
    const key = bucketKeyFor(q, opts.level, opts.getSubject);
    if (!buckets.has(key)) buckets.set(key, {});
    const m = buckets.get(key)!;
    const ys = String(y);
    m[ys] = (m[ys] || 0) + 1;
  }
  if (!Number.isFinite(latest) || latest < 0) return [];

  // 2) per-bucket metrics
  const result: PredictiveRow[] = [];
  for (const [key, byYear] of buckets) {
    const yearsPresent = Object.keys(byYear).map(Number).sort((a, b) => a - b);
    const total = Object.values(byYear).reduce((s, v) => s + v, 0);

    // FWI
    let fwi = 0;
    for (const y of yearsPresent) {
      const w = Math.pow(0.5, (latest - y) / halfLife);
      fwi += (byYear[String(y)] || 0) * w;
    }

    // slope window
    const sw = yearsPresent.filter((y) => y >= latest - slopeWindow + 1);
    const swXs = sw;
    const swYs = sw.map((y) => byYear[String(y)] || 0);
    const { m: mSlope } = slope(swXs.length ? swXs : [latest], swYs.length ? swYs : [0]);

    // forecast window
    const fw = yearsPresent.filter((y) => y >= latest - forecastWindow + 1);
    const fwXs = fw;
    const fwYs = fw.map((y) => byYear[String(y)] || 0);
    const { m: mF, b: bF, resStd } = slope(fwXs.length ? fwXs : [latest], fwYs.length ? fwYs : [0]);
    const point = Math.max(0, Math.round(mF * 2026 + bF));
    const band = 1.28 * resStd;
    const forecast2026 = {
      point,
      low: Math.max(0, Math.round(point - band)),
      high: Math.max(point, Math.round(point + band)),
    };

    // streak (consecutive recent years with >=1)
    let streak = 0;
    for (let y = latest; y >= latest - 25; y--) {
      if ((byYear[String(y)] || 0) >= 1) streak++;
      else break;
    }

    const trend: PredictiveRow['trend'] =
      mSlope > 0.4 ? 'rising' : mSlope < -0.3 ? 'falling' : 'stable';

    result.push({
      key,
      level: opts.level,
      totalQuestions: total,
      byYear,
      fwi,
      slope: mSlope,
      trend,
      forecast2026,
      streak,
      hotScore: 0,
    });
  }

  // 3) normalise hotScore to 0..100 across the result set
  const maxFwi = Math.max(1, ...result.map((r) => r.fwi));
  const maxSlope = Math.max(0.001, ...result.map((r) => Math.abs(r.slope)));
  const maxFc = Math.max(1, ...result.map((r) => r.forecast2026.point));
  for (const r of result) {
    const f = r.fwi / maxFwi;
    const s = (r.slope > 0 ? r.slope : 0) / maxSlope;
    const c = r.forecast2026.point / maxFc;
    r.hotScore = Math.round(100 * (0.55 * f + 0.3 * s + 0.15 * c));
  }
  result.sort((a, b) => b.hotScore - a.hotScore);
  return result;
}

/** Convenience: top-N rising buckets only. */
export function risingTopics(predictive: PredictiveRow[], n = 10) {
  return predictive.filter((r) => r.trend === 'rising').slice(0, n);
}

/** Convenience: bucket whose forecast is at least `min` and trend != falling. */
export function probableHotsFor2026(predictive: PredictiveRow[], min = 2, n = 10) {
  return predictive
    .filter((r) => r.trend !== 'falling' && r.forecast2026.point >= min)
    .slice(0, n);
}
