/**
 * @jest-environment node
 */
import { booksRepo, groupsRepo, type Db } from '@/db';
import { createTestDb } from '@/testing/createTestDb';

let db: Db;
let ids: number[];
beforeEach(async () => {
  db = await createTestDb();
  ids = [];
  for (const title of ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']) ids.push((await booksRepo.createBook(db, { title, coverUri: `https://example.test/${title}.jpg` })).id);
});
afterEach(() => db.close());

const [A, B, C, D, E] = [0, 1, 2, 3, 4];
const positions = (groupId: number) =>
  db.all<{ book_id: number; position: number }>('SELECT book_id, position FROM group_books WHERE group_id = ? ORDER BY position', [groupId]);

async function contiguous(groupId: number) {
  expect((await positions(groupId)).map((p) => p.position)).toEqual((await positions(groupId)).map((_, i) => i));
}

describe('groups repository', () => {
  it('creates, updates and deletes a group, keeping the books', async () => {
    const g = await groupsRepo.createGroup(db, { name: '  Favourites ', colour: 'lavender', icon: 'heart' });
    expect(g).toMatchObject({ name: 'Favourites', colour: 'lavender', icon: 'heart' });
    expect(await groupsRepo.updateGroup(db, g.id, { name: 'Faves', colour: 'sage' })).toMatchObject({ name: 'Faves', colour: 'sage', icon: 'heart' });
    await groupsRepo.addBooksToGroup(db, g.id, [ids[A]]);
    expect(await groupsRepo.deleteGroup(db, g.id)).toBe(true);
    expect(await booksRepo.countBooks(db)).toBe(5);
    expect(await positions(g.id)).toEqual([]);
  });

  it('appends books in the order given; adding a member again is a no-op', async () => {
    const g = await groupsRepo.createGroup(db, { name: 'Signed' });
    expect(await groupsRepo.addBooksToGroup(db, g.id, [ids[C], ids[A]])).toBe(2);
    expect(await groupsRepo.addBooksToGroup(db, g.id, [ids[A], ids[B], ids[B]])).toBe(1);
    expect(await groupsRepo.listGroupBookIds(db, g.id)).toEqual([ids[C], ids[A], ids[B]]);
    await contiguous(g.id);
  });

  it('keeps positions contiguous after removing books', async () => {
    const g = await groupsRepo.createGroup(db, { name: 'Kids' });
    await groupsRepo.addBooksToGroup(db, g.id, ids);
    expect(await groupsRepo.removeBookFromGroup(db, g.id, ids[B])).toBe(true);
    expect(await groupsRepo.removeBooksFromGroup(db, g.id, [ids[D], ids[D], 999])).toBe(1);
    expect(await groupsRepo.listGroupBookIds(db, g.id)).toEqual([ids[A], ids[C], ids[E]]);
    await contiguous(g.id);
    expect(await groupsRepo.removeBookFromGroup(db, g.id, ids[B])).toBe(false);
  });

  it('reorders, ignoring strangers and keeping unlisted members at the end', async () => {
    const g = await groupsRepo.createGroup(db, { name: 'Summer' });
    await groupsRepo.addBooksToGroup(db, g.id, [ids[A], ids[B], ids[C], ids[D]]);
    expect(await groupsRepo.reorderGroup(db, g.id, [ids[D], ids[B], ids[E]])).toEqual([ids[D], ids[B], ids[A], ids[C]]);
    expect(await groupsRepo.listGroupBookIds(db, g.id)).toEqual([ids[D], ids[B], ids[A], ids[C]]);
    await contiguous(g.id);
  });

  it('lists groups with counts and the first three covers in order', async () => {
    const g = await groupsRepo.createGroup(db, { name: 'Holiday', colour: 'honey', icon: 'sun' });
    await groupsRepo.createGroup(db, { name: 'Empty' });
    await groupsRepo.addBooksToGroup(db, g.id, [ids[D], ids[A], ids[C], ids[B]]);
    const [empty, holiday] = await groupsRepo.listGroupsWithStats(db);
    expect(empty).toMatchObject({ name: 'Empty', count: 0, covers: [] });
    expect(holiday).toMatchObject({ name: 'Holiday', colour: 'honey', icon: 'sun', count: 4 });
    expect(holiday.covers.map((c) => c.title)).toEqual(['Delta', 'Alpha', 'Charlie']);
    expect(holiday.covers[0].coverUri).toBe('https://example.test/Delta.jpg');
  });

  it('lists the groups a book is in', async () => {
    const a = await groupsRepo.createGroup(db, { name: 'b-side' });
    const b = await groupsRepo.createGroup(db, { name: 'A-list' });
    await groupsRepo.addBooksToGroup(db, a.id, [ids[A]]);
    await groupsRepo.addBooksToGroup(db, b.id, [ids[A]]);
    expect((await groupsRepo.listGroupsForBook(db, ids[A])).map((g) => g.name)).toEqual(['A-list', 'b-side']);
  });

  it('lists a group’s books as shelf items in the group’s order', async () => {
    const g = await groupsRepo.createGroup(db, { name: 'Order' });
    await groupsRepo.addBooksToGroup(db, g.id, [ids[E], ids[A]]);
    const items = await booksRepo.listBookItems(db, { scope: { groupId: g.id }, groupOrder: true });
    expect(items.map((i) => i.title)).toEqual(['Echo', 'Alpha']);
    const sorted = await booksRepo.listBookItems(db, { scope: { groupId: g.id } });
    expect(sorted.map((i) => i.title)).toEqual(['Alpha', 'Echo']);
  });
});
