// ==========================================================================
// Taxonomy Store — in-memory cache for taxonomy dropdowns
// ==========================================================================

import { supabase } from './supabase';
import type { TaxonomyItem } from './types';

let cache: TaxonomyItem[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getTaxonomy(): Promise<TaxonomyItem[]> {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;
  const { data } = await supabase.from('jt_taxonomy').select('*').order('subject').order('section_group').order('microtopic');
  cache = (data as TaxonomyItem[]) || [];
  cacheTime = Date.now();
  return cache;
}

export function clearTaxonomyCache(): void {
  cache = null;
  cacheTime = 0;
}

// ── Get distinct subjects from taxonomy ──
export async function getTaxonomySubjects(): Promise<string[]> {
  const items = await getTaxonomy();
  return [...new Set(items.map((i) => i.subject))].sort();
}

// ── Get section groups for a subject ──
export async function getTaxonomySections(subject: string): Promise<string[]> {
  const items = await getTaxonomy();
  return [...new Set(items.filter((i) => i.subject === subject).map((i) => i.section_group))].sort();
}

// ── Get microtopics for a subject + section ──
export async function getTaxonomyMicrotopics(subject: string, section: string): Promise<string[]> {
  const items = await getTaxonomy();
  return [...new Set(items.filter((i) => i.subject === subject && i.section_group === section).map((i) => i.microtopic))].sort();
}

// ── Dropdown options cache ──
let dropdownCache: Record<string, { value: string; label: string }[]> | null = null;

export async function getDropdownOptions(fieldName: string): Promise<{ value: string; label: string }[]> {
  if (!dropdownCache) {
    const { data } = await supabase.from('jt_dropdown_options').select('*').order('sort_order');
    if (data) {
      dropdownCache = {};
      data.forEach((row: any) => {
        if (!dropdownCache![row.field_name]) dropdownCache![row.field_name] = [];
        dropdownCache![row.field_name].push({ value: row.value, label: row.label || row.value });
      });
    }
  }
  return dropdownCache?.[fieldName] || [];
}

export function clearDropdownCache(): void {
  dropdownCache = null;
}