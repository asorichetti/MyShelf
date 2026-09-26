import { useCallback, useEffect, useState } from 'react';

import { groupsRepo, useDatabase, type GroupSummary } from '@/db';
import type { Group, NewGroup } from '@/domain';
import { emit, useLibraryEvent } from '@/features/events';

export interface GroupsState {
  /** Every group A-Z with its count and first covers; null until loaded. */
  groups: GroupSummary[] | null;
  create: (group: NewGroup) => Promise<Group>;
  update: (id: number, patch: Partial<NewGroup>) => Promise<Group | null>;
  remove: (id: number) => Promise<boolean>;
  /** Adds books to the end of a group; resolves to how many were new to it. */
  addBooks: (groupId: number, bookIds: readonly number[]) => Promise<number>;
  reload: () => void;
}

/**
 * The user's groups, for the Groups tab and the group picker. Every write
 * emits `groups-changed`, and the list reloads on that and on
 * `library-changed` (a deleted book leaves its groups).
 */
export function useGroups(): GroupsState {
  const db = useDatabase();
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    groupsRepo
      .listGroupsWithStats(db)
      .then((list) => active && setGroups(list))
      .catch((e) => console.error('Could not load the groups', e));
    return () => {
      active = false;
    };
  }, [db, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useLibraryEvent(['groups-changed', 'library-changed'], reload);

  const create = useCallback(
    async (group: NewGroup) => {
      const created = await groupsRepo.createGroup(db, group);
      emit('groups-changed');
      return created;
    },
    [db],
  );
  const update = useCallback(
    async (id: number, patch: Partial<NewGroup>) => {
      const updated = await groupsRepo.updateGroup(db, id, patch);
      emit('groups-changed');
      return updated;
    },
    [db],
  );
  const remove = useCallback(
    async (id: number) => {
      const removed = await groupsRepo.deleteGroup(db, id);
      emit('groups-changed');
      return removed;
    },
    [db],
  );
  const addBooks = useCallback(
    async (groupId: number, bookIds: readonly number[]) => {
      const added = await groupsRepo.addBooksToGroup(db, groupId, bookIds);
      emit('groups-changed');
      return added;
    },
    [db],
  );

  return { groups, create, update, remove, addBooks, reload };
}
