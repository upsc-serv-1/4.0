import { OfflineManager } from './OfflineManager';

export type MasterFilters = {
  subjectIds:   string[];
  sectionIds:   string[];
  instituteIds: string[];
  programmeIds: string[];
  examStage?:   'prelims' | 'mains' | 'all';
  ncert?:       boolean;       // true => only NCERT-tagged
  yearFrom?:    number;
  yearTo?:      number;
  search?:      string;
};

const matchesFilters = (q: any, f: MasterFilters) => {
  if (f.subjectIds?.length && !f.subjectIds.includes(q.subject)) return false;
  if (f.sectionIds?.length && !f.sectionIds.includes(q.section_group)) return false;
  if (f.instituteIds?.length && !f.instituteIds.includes(q._institute)) return false;
  if (f.programmeIds?.length && !f.programmeIds.includes(q._program_id)) return false;
  if (f.examStage && f.examStage !== 'all' && q.exam_stage !== f.examStage) return false;
  if (f.ncert && !q.is_ncert) return false;
  if (f.yearFrom && q.exam_year && q.exam_year < f.yearFrom) return false;
  if (f.yearTo && q.exam_year && q.exam_year > f.yearTo) return false;
  if (f.search) {
    const s = f.search.toLowerCase();
    const hay = `${q.question_text ?? ''} ${q.subject ?? ''} ${q.micro_topic ?? ''}`.toLowerCase();
    if (!hay.includes(s)) return false;
  }
  return true;
};

export const MasterFilterService = {
  filteredQuestions(filters: MasterFilters) {
    const all = (OfflineManager as any).getOfflineQuestionsEnrichedSync?.() ?? [];
    return all.filter((q: any) => matchesFilters(q, filters));
  },

  questionCount(filters: MasterFilters) {
    return this.filteredQuestions(filters).length;
  },

  // Group questions by their tags, returning only tags the user asked for.
  questionsByTag(filters: MasterFilters, tagIds: string[] | 'all') {
    const tags = (OfflineManager as any).getOfflineTagsSync?.() ?? [];
    const wanted = tagIds === 'all' ? tags.map((t: any) => t.id) : tagIds;
    const qs = this.filteredQuestions(filters);
    return wanted.map((id: string) => {
      const tag = tags.find((t: any) => t.id === id);
      return {
        tag: tag?.name ?? id,
        questions: qs.filter((q: any) => (q.tag_ids ?? []).includes(id)),
      };
    }).filter((g: any) => g.questions.length > 0);
  },

  decks() {
    const cards = (OfflineManager as any).getOfflineFlashcardsSync?.() ?? [];
    const map = new Map<string, { deck_id: string; name: string; count: number }>();
    cards.forEach((c: any) => {
      const id = c.deck_id ?? 'default';
      const name = c.deck_name ?? 'Default deck';
      const cur = map.get(id) ?? { deck_id: id, name, count: 0 };
      cur.count += 1;
      map.set(id, cur);
    });
    return Array.from(map.values());
  },

  cardsForDecks(deckIds: string[] | 'all') {
    const all = (OfflineManager as any).getOfflineFlashcardsSync?.() ?? [];
    if (deckIds === 'all') return all;
    return all.filter((c: any) => deckIds.includes(c.deck_id ?? 'default'));
  },

  noteFolders() {
    const notes = (OfflineManager as any).getOfflineNotesSync?.() ?? [];
    const map = new Map<string, { folder_id: string; name: string; count: number }>();
    notes.forEach((n: any) => {
      const id = n.folder_id ?? 'root';
      const name = n.folder_name ?? 'Unfiled';
      const cur = map.get(id) ?? { folder_id: id, name, count: 0 };
      cur.count += 1;
      map.set(id, cur);
    });
    return Array.from(map.values());
  },

  notesForFolders(folderIds: string[] | 'all') {
    const all = (OfflineManager as any).getOfflineNotesSync?.() ?? [];
    return folderIds === 'all'
      ? all
      : all.filter((n: any) => folderIds.includes(n.folder_id ?? 'root'));
  },
};
