import { OfflineManager } from './OfflineManager';
import { LocalQuery } from './LocalQuery';

/** True when the iPad already has cached questions for this course (or any course). */
export function isCatalogLocalReady(course?: string): boolean {
  if (course) {
    return OfflineManager.getOfflineQuestionsForCourseSync(course).length > 0;
  }
  return OfflineManager.getOfflineQuestionsAllSync().length > 0;
}

/**
 * Study-path catalog reads. Always local (MMKV via LocalQuery).
 * Never hits the Supabase `questions` / `tests` tables.
 */
export function catalogFrom(table: string) {
  return LocalQuery.from(table);
}
