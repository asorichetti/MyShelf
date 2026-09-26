import { act, renderHook, waitFor } from '@testing-library/react-native';

import { booksRepo, groupsRepo, StaticDatabaseProvider, type Db } from '@/db';
import { subscribe } from '@/features/events';
import { useGroups } from '@/features/groups/useGroups';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(() => db.close());

const wrapper = ({ children }: { children: React.ReactNode }) => <StaticDatabaseProvider db={db}>{children}</StaticDatabaseProvider>;

async function renderGroups() {
  const hook = renderHook(() => useGroups(), { wrapper });
  await waitFor(() => expect(hook.result.current.groups).not.toBeNull());
  return hook;
}

describe('useGroups', () => {
  it('lists groups with counts and covers', async () => {
    const { result } = await renderGroups();
    expect(result.current.groups!.map((g) => [g.name, g.count, g.covers.length])).toEqual([['Holiday reads', 3, 3]]);
  });

  it('creates, updates and deletes groups, announcing each change', async () => {
    const events = jest.fn();
    const off = subscribe('groups-changed', events);
    const { result } = await renderGroups();
    let id = 0;
    await act(async () => {
      id = (await result.current.create({ name: 'Favourites', colour: 'lavender', icon: 'heart' })).id;
    });
    await waitFor(() => expect(result.current.groups!.map((g) => g.name)).toEqual(['Favourites', 'Holiday reads']));
    await act(async () => void (await result.current.update(id, { name: 'Faves' })));
    await waitFor(() => expect(result.current.groups!.map((g) => g.name)).toEqual(['Faves', 'Holiday reads']));
    await act(async () => void (await result.current.remove(id)));
    await waitFor(() => expect(result.current.groups!.map((g) => g.name)).toEqual(['Holiday reads']));
    expect(events).toHaveBeenCalledTimes(3);
    off();
  });

  it('adds several books at once (three selected books make three memberships)', async () => {
    const { result } = await renderGroups();
    const [dune] = await booksRepo.findBooksByIsbn(db, '9780441172719');
    const [mort] = await booksRepo.findBooksByIsbn(db, '9780552131063');
    const [pride] = await booksRepo.findBooksByIsbn(db, '9780141439518');
    let group = 0;
    await act(async () => {
      group = (await result.current.create({ name: 'Favourites' })).id;
    });
    let added = 0;
    await act(async () => {
      added = await result.current.addBooks(group, [dune.id, mort.id, pride.id]);
    });
    expect(added).toBe(3);
    expect(await groupsRepo.listGroupBookIds(db, group)).toEqual([dune.id, mort.id, pride.id]);
    await waitFor(() => expect(result.current.groups!.find((g) => g.id === group)?.count).toBe(3));
  });
});
