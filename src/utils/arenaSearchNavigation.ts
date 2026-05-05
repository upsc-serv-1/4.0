type ArenaSearchFilters = {
  examStage?: string;
  selectedInstitutes?: string[];
  selectedPrograms?: string[];
  selectedSubjects?: string[];
  selectedSections?: string[];
  selectedMicrotopics?: string[];
  pyqFilter?: string;
  pyqCategory?: string[];
  ncertFilter?: string;
  searchFields?: string[];
  searchMode?: string;
};

const joinSafe = (value: unknown, separator: string) => {
  if (!Array.isArray(value)) return '';
  return value.map((item) => String(item || '').trim()).filter(Boolean).join(separator);
};

export const buildArenaEngineSearchParams = (
  query: string,
  filters: ArenaSearchFilters = {},
  overrides: Record<string, string> = {}
) => {
  const term = String(query || '').trim();

  return {
    mode: 'learning',
    view: 'list',
    timer: 'none',
    query: term,
    searchMode: filters.searchMode || 'Matching',
    searchFields: joinSafe(filters.searchFields, ',') || 'Questions',
    subjects: joinSafe(filters.selectedSubjects, ','),
    section: joinSafe(filters.selectedSections, '|'),
    microtopic: joinSafe(filters.selectedMicrotopics, '|'),
    institutes: joinSafe(filters.selectedInstitutes, ','),
    programs: joinSafe(filters.selectedPrograms, ','),
    examStage: filters.examStage && filters.examStage !== 'All' ? filters.examStage : '',
    pyqFilter: filters.pyqFilter && filters.pyqFilter !== 'All' ? filters.pyqFilter : '',
    pyqCategory: joinSafe(filters.pyqCategory, ','),
    ncertFilter: filters.ncertFilter && filters.ncertFilter !== 'All' ? filters.ncertFilter : '',
    ...overrides,
  };
};
