import { act, renderHook, waitFor } from '@testing-library/react-native';

import { groupsRepo, StaticDatabaseProvider, type Db } from '@/db';
import { useGroup } from '@/features/groups/useGroup';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';

let db: Db;
let groupId: number;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'demo');
  groupId = (await groupsRepo.listGroups(db))[0].id;
});
afterEach(() => db.close());

const wrapper = ({ children }: { children: React.ReactNode }) => <StaticDatabaseProvider db={db}>{children}</StaticDatabaseProvider>;
const titles = (state: ReturnType<typeof useGroup>['state']) => (state.status === 'ready' ? state.items.map((i) => i.title) : []);

async function renderGroup(id: number | null = groupId) {
  const hook = renderHook(() => useGroup(id), { wrapper });
  await waitFor(() => expect(hook.result.current.state.status).not.toBe('loading'));
  return hook;
}

describe('useGroup', () => {
  it('loads the group and its books in the group’s order', async () => {
    const { result } = await renderGroup();
    expect(result.current.state.status).toBe('ready');
    expect(titles(result.current.state)).toEqual(['Good Omens', 'Murder on the Orient Express', 'Pride and Prejudice']);
  });

  it('moves a book and keeps the order (it persists)', async () => {
    const { result } = await renderGroup();
    await act(async () => result.current.move(2, 0));
    expect(titles(result.current.state)).toEqual(['Pride and Prejudice', 'Good Omens', 'Murder on the Orient Express']);
    const again = await renderGroup();
    expect(titles(again.result.current.state)).toEqual(['Pride and Prejudice', 'Good Omens', 'Murder on the Orient Express']);
  });

  it('takes books out of the group', async () => {
    const { result } = await renderGroup();
    const state = result.current.state;
    if (state.status !== 'ready') throw new Error('not ready');
    await act(async () => void (await result.current.removeBooks([state.items[0].id])));
    await waitFor(() => expect(titles(result.current.state)).toEqual(['Murder on the Orient Express', 'Pride and Prejudice']));
  });

  it('reports a missing group', async () => {
    expect((await renderGroup(9999)).result.current.state.status).toBe('missing');
    expect((await renderGroup(null)).result.current.state.status).toBe('missing');
  });
});
