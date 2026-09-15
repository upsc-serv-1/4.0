import { OfflineManager } from './OfflineManager';
import { LocalQuery } from './LocalQuery';

/** True when the iPad already has cached questions for this course (or any course). */
export function isCatalogLocalReady(course?: string): boolean {
  if (course) {
    return OfflineManager.getOfflineQuestionsForCourseSync(course).length > 0;
  }
  return OfflineManager.getOfflineQuestionsAllSync().length > 0;
}

/** How many questions are cached locally for a course (0 when not downloaded). */
export function localCatalogCount(course?: string): number {
  if (course) return OfflineManager.getOfflineQuestionsForCourseSync(course).length;
  return OfflineManager.getOfflineQuestionsAllSync().length;
}

/**
 * Study-path catalog reads. Always local (MMKV via LocalQuery).
 * Never hits the Supabase `questions` / `tests` tables.
 */
export function catalogFrom(table: string) {
  return LocalQuery.from(table);
}

/** Local tests for a course, straight from the downloaded catalogue. */
export function localTests(course?: string): any[] {
  const tests = OfflineManager.getOfflineTestsSync();
  if (!course) return tests;
  return tests.filter((t: any) => t.course === course);
}

/**
 * Enriched local questions (includes the joined `tests` object so filters like
 * institute/program/series keep working offline).
 */
export function localQuestionsEnriched(course?: string): any[] {
  if (!course) return OfflineManager.getOfflineQuestionsEnrichedSync();

  const rows = OfflineManager.getOfflineQuestionsForCourseSync(course);
  const tById = new Map(OfflineManager.getOfflineTestsSync().map((t: any) => [t.id, t]));
  return rows.map((q: any) => {
    const t = tById.get(q.test_id);
    return {
      ...q,
      tests: t ?? null,
      _institute: t?.institute ?? null,
      _program_id: t?.program_id ?? null,
      _program_name: t?.program_name ?? null,
      _series: t?.series ?? null,
      _level: t?.level ?? null,
      _launch_year: t?.launch_year ?? null,
      _paper_type: t?.paper_type ?? null,
      _provider: t?.provider ?? null,
    };
  });
}

/** Facet lists derived from the local test catalogue (no network). */
export function localFacets() {
  return OfflineManager.getOfflineFacets();
}
