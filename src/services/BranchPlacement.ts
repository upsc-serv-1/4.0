/**
 * BranchPlacement — places a flashcard into the deck hierarchy.
 *
 * Two modes:
 *   - autoPlace(userId, cardId, hint): creates/uses Subject → Section Group → Microtopic
 *     branches and links the card to the leaf branch.
 *   - placeAt(userId, cardId, branchId): links the card to a specific branch.
 *
 * Branches are idempotent — looking up by (user_id, parent_id, name) before insert.
 */

import { supabase } from '../lib/supabase';
import { BranchSvc, Branch } from './BranchService';

export interface PlacementHint {
  subject?: string | null;
  section_group?: string | null;
  microtopic?: string | null;
  isMains?: boolean;
}

export class BranchPlacement {
  /** Find a branch by exact (user_id, parent_id, name) — case-insensitive. */
  static async findChild(userId: string, parentId: string | null, name: string): Promise<Branch | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    let q = supabase
      .from('flashcard_branches')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .ilike('name', trimmed);
    if (parentId === null) q = q.is('parent_id', null);
    else q = q.eq('parent_id', parentId);
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) return null;
    return (data as Branch) ?? null;
  }

  /** Get-or-create a branch as a child of `parentId` (null = root). */
  static async ensureBranch(userId: string, parentId: string | null, name: string): Promise<Branch> {
    const trimmed = (name || '').trim() || 'General';
    const existing = await this.findChild(userId, parentId, trimmed);
    if (existing) return existing;
    return BranchSvc.create(userId, trimmed, parentId);
  }

  /**
   * Search ALL of user's branches (across the entire tree) for a leaf whose
   * (microtopic, section, subject) hierarchy matches semantically — regardless
   * of where it lives. This stabilises auto-placement after the user moves a
   * deck into a folder: the microtopic deck retains its identity even when its
   * parent_id changes.
   */
  static async findExistingLeaf(
    userId: string,
    subject: string,
    section: string,
    micro: string,
    rootParentId: string | null = null,
  ): Promise<Branch | null> {
    const norm = (s: string) => (s || '').trim().toLowerCase();
    const wantMicro = norm(micro);
    const wantSection = norm(section);
    const wantSubject = norm(subject);

    const { data, error } = await supabase
      .from('flashcard_branches')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false);
    if (error || !data) return null;

    const byId: Record<string, Branch> = {};
    (data as Branch[]).forEach((b) => { byId[b.id] = b; });

    const ancestorNames = (b: Branch): string[] => {
      const names: string[] = [];
      let cur: Branch | undefined = b;
      let depth = 0;
      while (cur && depth < 10) {
        names.push(norm(cur.name));
        if (rootParentId && cur.parent_id === rootParentId) {
          break;
        }
        if (!cur.parent_id) break;
        cur = byId[cur.parent_id];
        depth++;
      }
      return names; // [self, parent, grandparent, ...]
    };

    // Prefer leaf candidates whose hierarchy matches micro -> section -> subject
    // anywhere up the chain. Falls back to micro-only match if hierarchy is sparse.
    const leafMatches = (data as Branch[]).filter((b) => norm(b.name) === wantMicro);
    for (const leaf of leafMatches) {
      // Validate root parent constraint
      if (rootParentId) {
        let belongs = false;
        let cur: Branch | undefined = leaf;
        let depth = 0;
        while (cur && depth < 10) {
          if (cur.parent_id === rootParentId) {
            belongs = true;
            break;
          }
          if (!cur.parent_id) break;
          cur = byId[cur.parent_id];
          depth++;
        }
        if (!belongs) continue;
      } else {
        // Non-mains cards should NOT go inside the mains folder
        let belongsToMains = false;
        let cur: Branch | undefined = leaf;
        let depth = 0;
        while (cur && depth < 10) {
          if (norm(cur.name) === 'mains') {
            belongsToMains = true;
            break;
          }
          if (!cur.parent_id) break;
          cur = byId[cur.parent_id];
          depth++;
        }
        if (belongsToMains) continue;
      }

      const names = ancestorNames(leaf);
      const hasSection = names.includes(wantSection);
      const hasSubject = names.includes(wantSubject);
      if (hasSection && hasSubject) return leaf;
    }
    // If no perfect hierarchy match but exactly one leaf with this name exists,
    // use it (covers cases where user flattened the structure).
    if (leafMatches.length === 1 && !rootParentId) return leafMatches[0];
    return null;
  }

  /**
   * Auto-place a card into Subject → Section Group → Microtopic branch hierarchy.
   * Falls back to "General" segments for missing fields.
   * Returns the leaf branch the card was added to.
   *
   * Stable identity: if a microtopic deck for this hierarchy already exists
   * anywhere in the user's tree (even after being moved into a folder), it is
   * reused. New branches are only created when no semantic match is found.
   */
  static async autoPlace(userId: string, cardId: string, hint: PlacementHint): Promise<Branch> {
    const subject = (hint.subject || 'General').trim() || 'General';
    const section = (hint.section_group || 'General').trim() || 'General';
    const micro   = (hint.microtopic || 'General').trim() || 'General';

    let rootParentId: string | null = null;
    if (hint.isMains) {
      const mainsRootBranch = await this.ensureBranch(userId, null, 'mains');
      rootParentId = mainsRootBranch.id;
    }

    // 1) Try to find an existing leaf with matching semantic hierarchy.
    const existingLeaf = await this.findExistingLeaf(userId, subject, section, micro, rootParentId);
    if (existingLeaf) {
      await BranchSvc.addCardToBranch(userId, existingLeaf.id, cardId);
      return existingLeaf;
    }

    // 2) Fallback: build the canonical Subject -> Section -> Microtopic path.
    const subjectBranch = await this.ensureBranch(userId, rootParentId, subject);
    const sectionBranch = await this.ensureBranch(userId, subjectBranch.id, section);
    const leaf = await this.ensureBranch(userId, sectionBranch.id, micro);

    await BranchSvc.addCardToBranch(userId, leaf.id, cardId);
    return leaf;
  }

  /** Link an existing card to a specific branch (manual placement). */
  static async placeAt(userId: string, cardId: string, branchId: string): Promise<void> {
    await BranchSvc.addCardToBranch(userId, branchId, cardId);
  }

  /** Move a card from one branch to another. */
  static async moveCard(userId: string, cardId: string, fromBranchId: string, toBranchId: string): Promise<void> {
    if (fromBranchId === toBranchId) return;
    await BranchSvc.addCardToBranch(userId, toBranchId, cardId);
    await BranchSvc.removeCardFromBranch(fromBranchId, cardId);
  }

  /** Build a human-readable path for a leaf branch (for confirmation toasts). */
  static buildPathLabel(leaf: { path?: string; name: string }): string {
    return leaf.path && leaf.path.length > 0 ? leaf.path : leaf.name;
  }
}
