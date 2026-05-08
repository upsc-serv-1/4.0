/**
 * tags.repo — local-first CRUD for user tags via KVStore.
 *
 * Reads are synchronous from MMKV. Writes update MMKV immediately
 * and enqueue SyncQueue jobs for remote sync.
 */
import { KVStore } from '../lib/kvStore';
import { SyncQueue } from '../services/SyncQueue';

const TAGS_KEY = '@user_tags';

export type Tag = {
  id: string;
  user_id: string;
  name: string;
  color?: string;
  deleted?: boolean;
  _dirty?: boolean;
  updated_at: string;
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export const getTags = (): Tag[] =>
  (KVStore.getJson<Tag[]>(TAGS_KEY) ?? []).filter(t => !t.deleted);

export const getAllTagsRaw = (): Tag[] =>
  KVStore.getJson<Tag[]>(TAGS_KEY) ?? [];

export const upsertTag = (input: Partial<Tag> & { user_id: string; name: string }) => {
  const list = KVStore.getJson<Tag[]>(TAGS_KEY) ?? [];
  const now = new Date().toISOString();
  const id = input.id ?? generateId();
  const row: Tag = {
    ...(list.find(t => t.id === id) ?? {}),
    ...input,
    id,
    updated_at: now,
    _dirty: true,
  } as Tag;
  KVStore.setJson(TAGS_KEY, [...list.filter(t => t.id !== id), row]);

  // Use the existing SyncQueue's tag_add kind for new tags
  const { _dirty, ...payload } = row;
  SyncQueue.enqueue('tag_add', payload);
  return row;
};

export const deleteTag = (id: string) => {
  const list = KVStore.getJson<Tag[]>(TAGS_KEY) ?? [];
  const now = new Date().toISOString();
  KVStore.setJson(
    TAGS_KEY,
    list.map(t => (t.id === id ? { ...t, deleted: true, _dirty: true, updated_at: now } : t)),
  );
  SyncQueue.enqueue('tag_remove', { id, deleted: true, updated_at: now });
};
