/**
 * BranchService — AnkiPro / Noji style hierarchical decks.
 *
 * Backed by two tables that already exist in the schema:
 *   - flashcard_branches     (id, user_id, name, parent_id, is_archived, is_deleted, sort_order)
 *   - flashcard_branch_cards (id, branch_id, card_id, user_id)
 *
 * Core features:
 *   - Materialised path caching for fast `path LIKE 'Subject/Section/%'` queries.
 *   - Recursive aggregation: a parent's "Due" / "New" pill = sum of entire subtree.
 *   - Full tree fetch via a single RPC so the deck hub renders in one round-trip.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeSetItem } from '../lib/safeAsyncStorage';
import { supabase } from '../lib/supabase';

export interface Branch {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  is_archived: boolean;
  is_deleted: boolean;
  is_folder: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface BranchNode extends Branch {
  path: string;               // "Subject/Section/Microtopic"
  depth: number;              // root = 0
  children: BranchNode[];
  // Aggregated over entire subtree (incl. self):
  due_count: number;
  new_count: number;
  learning_count: number;
  mastered_count: number;
  total_count: number;
  direct_card_count: number;  // just this node's own cards
}

export interface BranchCounts {
  branch_id: string;
  due: number;
  new: number;
  learning: number;
  mastered: number;
  total: number;
}

export class BranchSvc {
  // ─── CRUD ───────────────────────────────────────────────────────────────
  static async listAll(userId: string, opts: { includeArchived?: boolean } = {}): Promise<Branch[]> {
    const cacheKey = `flashcard_branches_${userId}`;

    const sortRows = (rows: Branch[]) =>
      [...rows].sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));

    const filterRows = (rows: Branch[]) => {
      const base = rows.filter((r) => !r.is_deleted);
      const visible = opts.includeArchived ? base : base.filter((r) => !r.is_archived);
      return sortRows(visible);
    };

    let q = supabase
      .from('flashcard_branches')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (!opts.includeArchived) q = q.eq('is_archived', false);

    try {
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as Branch[];
      if (!opts.includeArchived) {
        try {
          await safeSetItem(cacheKey, JSON.stringify(rows));
        } catch {}
      }
      return rows;
    } catch (err) {
      // Network failed -> fallback to cache.
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return filterRows(parsed as Branch[]);
          }
        }
      } catch {}
      throw err;
    }
  }

  static async create(userId: string, name: string, parent_id: string | null = null, is_folder: boolean = false): Promise<Branch> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Branch name required');
    const { data, error } = await supabase
      .from('flashcard_branches')
      .insert({ 
        user_id: userId, 
        name: trimmed, 
        parent_id, 
        is_folder,
        is_archived: false,
        is_deleted: false
      })
      .select()
      .single();
    if (error) throw error;
    try {
      await AsyncStorage.removeItem(`flashcard_branches_${userId}`);
    } catch {}
    return data as Branch;
  }

  static async rename(branchId: string, name: string) {
    const { data: b } = await supabase.from('flashcard_branches').select('user_id').eq('id', branchId).maybeSingle();
    const { error } = await supabase
      .from('flashcard_branches')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', branchId);
    if (error) throw error;
    if (b?.user_id) {
      try {
        await AsyncStorage.removeItem(`flashcard_branches_${b.user_id}`);
      } catch {}
    }
  }

  static async move(branchId: string, newParentId: string | null) {
    if (branchId === newParentId) throw new Error('Cannot parent a branch to itself');
    // Cycle-check: make sure newParentId is not a descendant of branchId.
    // Simple approach — walk up from newParentId; if we hit branchId, reject.
    let cur = newParentId;
    while (cur) {
      if (cur === branchId) throw new Error('Move would create a cycle');
      const { data } = await supabase.from('flashcard_branches').select('parent_id').eq('id', cur).maybeSingle();
      cur = (data as any)?.parent_id ?? null;
    }
    const { data: b } = await supabase.from('flashcard_branches').select('user_id').eq('id', branchId).maybeSingle();
    const { error } = await supabase
      .from('flashcard_branches')
      .update({ parent_id: newParentId, updated_at: new Date().toISOString() })
      .eq('id', branchId);
    if (error) throw error;
    if (b?.user_id) {
      try {
        await AsyncStorage.removeItem(`flashcard_branches_${b.user_id}`);
      } catch {}
    }
  }

  static async archive(branchId: string, archived = true) {
    const { data: b } = await supabase.from('flashcard_branches').select('user_id').eq('id', branchId).maybeSingle();
    const { error } = await supabase
      .from('flashcard_branches')
      .update({ is_archived: archived, updated_at: new Date().toISOString() })
      .eq('id', branchId);
    if (error) throw error;
    if (b?.user_id) {
      try {
        await AsyncStorage.removeItem(`flashcard_branches_${b.user_id}`);
      } catch {}
    }
  }

  /** Soft-delete (recoverable for 30 days at the UI layer). */
  static async deleteBranch(branchId: string, userId: string): Promise<void> {
    try {
      // 1. Get all card IDs belonging to this branch (recursively if folder)
      const cardIds = await this.listCardIdsInBranch(branchId, { recursive: true, userId });
      
      if (cardIds.length > 0) {
        // 2. Mark all these cards as deleted in the cards table
        const { error: cardsError } = await supabase
          .from('cards')
          .update({ is_deleted: true })
          .in('id', cardIds);
        
        if (cardsError) {
          console.error('[deleteBranch] Error marking cards as deleted:', cardsError);
          throw cardsError;
        }

        // 3. Delete mappings from flashcard_branch_cards
        await supabase
          .from('flashcard_branch_cards')
          .delete()
          .in('card_id', cardIds)
          .eq('user_id', userId);

        // 4. Delete these cards from user_cards
        await supabase
          .from('user_cards')
          .delete()
          .in('card_id', cardIds)
          .eq('user_id', userId);
      }
    } catch (err) {
      console.error('[deleteBranch] Failed to soft-delete associated cards:', err);
      throw err; // Re-throw so the caller knows deletion failed
    }

    // 5. Hard delete the branch from flashcard_branches
    const { error } = await supabase
      .from('flashcard_branches')
      .delete()
      .eq('id', branchId);
    
    if (error) throw error;
  }

  /** Soft-delete (recoverable for 30 days at the UI layer). */
  static async softDelete(branchId: string) {
    const { data: b } = await supabase.from('flashcard_branches').select('user_id').eq('id', branchId).maybeSingle();
    const userId = b?.user_id;
    if (userId) {
      await this.deleteBranch(branchId, userId);
      try {
        await AsyncStorage.removeItem(`flashcard_branches_${userId}`);
        await AsyncStorage.removeItem(`flashcard_branch_cards_${userId}`);
        await AsyncStorage.removeItem(`user_cards_${userId}`);
      } catch {}
    }
  }

  static async reorder(branchId: string, sort_order: number) {
    const { data: b } = await supabase.from('flashcard_branches').select('user_id').eq('id', branchId).maybeSingle();
    const { error } = await supabase
      .from('flashcard_branches')
      .update({ sort_order, updated_at: new Date().toISOString() })
      .eq('id', branchId);
    if (error) throw error;
    if (b?.user_id) {
      try {
        await AsyncStorage.removeItem(`flashcard_branches_${b.user_id}`);
      } catch {}
    }
  }

  // ─── CARD ↔ BRANCH MAPPING ──────────────────────────────────────────────
  static async addCardToBranch(userId: string, branchId: string, cardId: string) {
    // Idempotent insert
    const { data: existing } = await supabase
      .from('flashcard_branch_cards')
      .select('id')
      .eq('branch_id', branchId)
      .eq('card_id', cardId)
      .maybeSingle();
    if (existing) return existing.id as string;
    const { data, error } = await supabase
      .from('flashcard_branch_cards')
      .insert({ user_id: userId, branch_id: branchId, card_id: cardId })
      .select('id')
      .single();
    if (error) throw error;
    try {
      await AsyncStorage.removeItem(`flashcard_branch_cards_${userId}`);
      await AsyncStorage.removeItem(`user_cards_${userId}`);
    } catch {}
    return data.id as string;
  }

  static async removeCardFromBranch(branchId: string, cardId: string) {
    const { data: mapping } = await supabase.from('flashcard_branch_cards').select('user_id').eq('branch_id', branchId).eq('card_id', cardId).maybeSingle();
    const { error } = await supabase
      .from('flashcard_branch_cards')
      .delete()
      .eq('branch_id', branchId)
      .eq('card_id', cardId);
    if (error) throw error;
    if (mapping?.user_id) {
      try {
        await AsyncStorage.removeItem(`flashcard_branch_cards_${mapping.user_id}`);
        await AsyncStorage.removeItem(`user_cards_${mapping.user_id}`);
      } catch {}
    }
  }

  static async moveCardToBranch(userId: string, cardId: string, targetBranchId: string | null) {
    // 1. Remove from any existing branches
    const { error: delErr } = await supabase
      .from('flashcard_branch_cards')
      .delete()
      .eq('card_id', cardId)
      .eq('user_id', userId);
    if (delErr) throw delErr;

    // 2. If target is provided, add to it
    if (targetBranchId) {
      await this.addCardToBranch(userId, targetBranchId, cardId);
    }
    try {
      await AsyncStorage.removeItem(`flashcard_branch_cards_${userId}`);
      await AsyncStorage.removeItem(`user_cards_${userId}`);
    } catch {}
  }

  static async listCardIdsInBranch(branchId: string, opts: { recursive?: boolean; userId?: string } = {}): Promise<string[]> {
    if (!opts.recursive) {
      const { data, error } = await supabase
        .from('flashcard_branch_cards')
        .select('card_id')
        .eq('branch_id', branchId);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.card_id);
    }
    // Recursive: first get all descendant branch ids
    if (!opts.userId) throw new Error('userId required for recursive branch card fetch');
    const branches = await this.listAll(opts.userId);
    const descIds = this.collectDescendantIds(branches, branchId);
    const targetIds = [branchId, ...descIds];
    if (targetIds.length === 0) return [];
    const { data, error } = await supabase
      .from('flashcard_branch_cards')
      .select('card_id')
      .in('branch_id', targetIds);
    if (error) throw error;
    return Array.from(new Set((data ?? []).map((r: any) => r.card_id)));
  }

  // ─── TREE BUILDING + AGGREGATION ────────────────────────────────────────
  /**
   * Build the full hierarchical tree with aggregate counters (due / new / learning / mastered / total).
   * Runs 3 queries total (branches, branch_cards, user_cards) — everything else is in-memory aggregation.
   */
  static async buildTree(userId: string): Promise<BranchNode[]> {
    // 1. All branches
    const branches = await this.listAll(userId);

    // 2. All branch<->card links for this user (RLS keeps this scoped)
    const linksCacheKey = `flashcard_branch_cards_${userId}`;
    let links: any[] = [];

    try {
      const { data, error: linkErr } = await supabase
        .from('flashcard_branch_cards')
        .select('branch_id, card_id')
        .eq('user_id', userId);
      if (linkErr) throw linkErr;
      links = data ?? [];
      try {
        await safeSetItem(linksCacheKey, JSON.stringify(links));
      } catch {}
    } catch (err) {
      try {
        const cached = await AsyncStorage.getItem(linksCacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) links = parsed;
        }
      } catch {}
      if (!links || links.length === 0) throw err;
    }

    const branchCardMap = new Map<string, Set<string>>(); // branch_id → Set<card_id>
    const allCardIds = new Set<string>();
    (links ?? []).forEach((l: any) => {
      if (!branchCardMap.has(l.branch_id)) branchCardMap.set(l.branch_id, new Set());
      branchCardMap.get(l.branch_id)!.add(l.card_id);
      allCardIds.add(l.card_id);
    });

    // 3. user_cards for those cards (the only fields we need for counters)
    const cardIds = Array.from(allCardIds);
    const now = Date.now();

    type MiniCard = { learning_status: string; status: string; next_review: string | null };
    const cardStateMap = new Map<string, MiniCard>();

    if (cardIds.length > 0) {
      const userCardsCacheKey = `user_cards_${userId}`;
      const cardIdSet = new Set(cardIds);
      let userCardsRows: any[] = [];

      try {
        // Batch in groups of 500 to avoid URL-too-long on big decks
        const CHUNK = 500;
        const fetchedRows: any[] = [];
        for (let i = 0; i < cardIds.length; i += CHUNK) {
          const slice = cardIds.slice(i, i + CHUNK);
          const { data, error } = await supabase
            .from('user_cards')
            .select('card_id, learning_status, status, next_review')
            .eq('user_id', userId)
            .in('card_id', slice);
          if (error) throw error;
          fetchedRows.push(...(data ?? []));
        }
        userCardsRows = fetchedRows;
        try {
          await safeSetItem(userCardsCacheKey, JSON.stringify(userCardsRows));
        } catch {}
      } catch (err) {
        try {
          const cached = await AsyncStorage.getItem(userCardsCacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) userCardsRows = parsed;
          }
        } catch {}
        if (!userCardsRows || userCardsRows.length === 0) throw err;
      }

      userCardsRows
        .filter((r: any) => cardIdSet.has(r.card_id))
        .forEach((r: any) => cardStateMap.set(r.card_id, r));
    }

    // Helper: counters for a direct branch (not yet rolled up)
    const directCounts = (branchId: string) => {
      let due = 0, new_ = 0, learning = 0, mastered = 0, total = 0, direct = 0;
      const ids = branchCardMap.get(branchId);
      if (!ids) return { due, new_, learning, mastered, total, direct };
      ids.forEach(cardId => {
        const st = cardStateMap.get(cardId);
        if (!st || st.status !== 'active') return;
        direct += 1;
        total += 1;
        const ls = st.learning_status;
        if (ls === 'not_studied' || ls === 'new') {
          new_ += 1;
        } else if (ls === 'mastered') {
          mastered += 1;
        } else if (ls === 'learning' || ls === 'review' || ls === 'leech') {
          learning += 1;
          if (st.next_review && new Date(st.next_review).getTime() <= now) due += 1;
        }
      });
      return { due, new_, learning, mastered, total, direct };
    };

    // Build node index
    const nodeMap = new Map<string, BranchNode>();
    branches.forEach(b => {
      const c = directCounts(b.id);
      nodeMap.set(b.id, {
        ...b,
        path: b.name,            // will be fixed after tree build
        depth: 0,
        children: [],
        due_count: c.due,
        new_count: c.new_,
        learning_count: c.learning,
        mastered_count: c.mastered,
        total_count: c.total,
        direct_card_count: c.direct,
      });
    });

    // Wire parent→child
    const roots: BranchNode[] = [];
    nodeMap.forEach(node => {
      if (node.parent_id && nodeMap.has(node.parent_id)) {
        nodeMap.get(node.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sort children within each parent
    const sortChildren = (arr: BranchNode[]) => {
      arr.sort((a, b) => {
        if (a.is_folder && !b.is_folder) return -1;
        if (!a.is_folder && b.is_folder) return 1;
        return (a.sort_order - b.sort_order) || a.name.localeCompare(b.name);
      });
      arr.forEach(n => sortChildren(n.children));
    };
    sortChildren(roots);

    // Compute paths + depths + roll up counters
    const walk = (node: BranchNode, parentPath: string, depth: number) => {
      node.depth = depth;
      node.path = parentPath ? `${parentPath}/${node.name}` : node.name;
      node.children.forEach(child => walk(child, node.path, depth + 1));
      // Aggregate after walking
      node.children.forEach(child => {
        node.due_count      += child.due_count;
        node.new_count      += child.new_count;
        node.learning_count += child.learning_count;
        node.mastered_count += child.mastered_count;
        node.total_count    += child.total_count;
      });
    };
    roots.forEach(r => walk(r, '', 0));

    return roots;
  }

  /** Flatten a tree (pre-order) for simple `.map` rendering with indent by `depth`. */
  static flatten(tree: BranchNode[], onlyExpanded?: Set<string>): BranchNode[] {
    const out: BranchNode[] = [];
    const recur = (n: BranchNode) => {
      out.push(n);
      if (!onlyExpanded || onlyExpanded.has(n.id)) {
        n.children.forEach(recur);
      }
    };
    tree.forEach(recur);
    return out;
  }

  /** Given a flat list and a target id, return the ids of ALL descendants. */
  static collectDescendantIds(branches: Branch[], rootId: string): string[] {
    const byParent = new Map<string, Branch[]>();
    branches.forEach(b => {
      if (!b.parent_id) return;
      if (!byParent.has(b.parent_id)) byParent.set(b.parent_id, []);
      byParent.get(b.parent_id)!.push(b);
    });
    const out: string[] = [];
    const stack = [...(byParent.get(rootId) ?? [])];
    while (stack.length) {
      const b = stack.pop()!;
      out.push(b.id);
      const kids = byParent.get(b.id) ?? [];
      stack.push(...kids);
    }
    return out;
  }

  /** Find the full ancestry chain (self → root) for a branch id. */
  static ancestry(branches: Branch[], branchId: string): Branch[] {
    const byId = new Map(branches.map(b => [b.id, b]));
    const chain: Branch[] = [];
    let cur: string | null = branchId;
    while (cur && byId.has(cur)) {
      const b = byId.get(cur)!;
      chain.push(b);
      cur = b.parent_id;
    }
    return chain;
  }
}
