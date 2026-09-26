import {
  authorsRepo,
  BookAlreadyOnLoanError,
  booksRepo,
  BorrowerHasLoansError,
  genresRepo,
  groupsRepo,
  loansRepo,
  seriesRepo,
  settingsRepo,
  type Db,
} from '@/db';
import type { Book } from '@/domain';
import { openTestDatabase } from '@/testing/db';

let db: Db;
beforeEach(async () => {
  db = await openTestDatabase();
});
afterEach(() => db.close());

const titles = (books: Book[]) => books.map((b) => b.title);
const book = (title: string, extra: Partial<Parameters<typeof booksRepo.createBook>[1]> = {}) =>
  booksRepo.createBook(db, { title, ...extra });

describe('books repository', () => {
  it('creates a book with defaults and timestamps', async () => {
    const b = await book('  The Hobbit ', { isbn13: '978-0-261-10221-7', format: 'paperback', pageCount: 310 });
    expect(b).toMatchObject({
      title: 'The Hobbit',
      isbn13: '9780261102217',
      format: 'paperback',
      pageCount: 310,
      subtitle: null,
      seriesId: null,
    });
    expect(b.id).toBeGreaterThan(0);
    expect(b.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(await booksRepo.getBook(db, b.id)).toEqual(b);
  });

  it('stores every field', async () => {
    const s = await seriesRepo.createSeries(db, 'Discworld');
    const input = {
      title: 'Guards! Guards!',
      subtitle: 'A Discworld Novel',
      isbn13: '9780552134637',
      isbn10: '055213463X',
      edition: 'First',
      publisher: 'Corgi',
      publicationYear: 1989,
      pageCount: 416,
      summary: 'Dragons.',
      coverUri: 'file:///cover.jpg',
      language: 'en',
      format: 'paperback' as const,
      seriesId: s.id,
      seriesPosition: 8,
      source: 'openlibrary',
      sourceId: 'OL123M',
      notes: 'Signed',
    };
    expect(await booksRepo.createBook(db, input)).toMatchObject(input);
  });

  it('returns null for missing books', async () => {
    expect(await booksRepo.getBook(db, 999)).toBeNull();
    expect(await booksRepo.updateBook(db, 999, { title: 'x' })).toBeNull();
    expect(await booksRepo.deleteBook(db, 999)).toBe(false);
  });

  it('lists A-Z case-insensitively and counts', async () => {
    await book('emma');
    await book('Anna Karenina');
    await book('Dune');
    expect(titles(await booksRepo.listBooks(db))).toEqual(['Anna Karenina', 'Dune', 'emma']);
    expect(await booksRepo.countBooks(db)).toBe(3);
  });

  it('finds by ISBN-13 or ISBN-10, normalising input', async () => {
    const b = await book('Dune', { isbn13: '9780441013593', isbn10: '0441013597' });
    expect(titles(await booksRepo.findBooksByIsbn(db, '978-0441013593'))).toEqual(['Dune']);
    expect((await booksRepo.findBooksByIsbn(db, '0 441 01359 7'))[0].id).toBe(b.id);
    expect(await booksRepo.findBooksByIsbn(db, '---')).toEqual([]);
  });

  it('searches titles, subtitles and author names', async () => {
    const a = await authorsRepo.createAuthor(db, 'Ursula K. Le Guin');
    const b = await book('A Wizard of Earthsea');
    await authorsRepo.setBookAuthors(db, b.id, [{ authorId: a.id }]);
    await book('Dune', { subtitle: 'Arrakis 100%' });
    expect(titles(await booksRepo.searchBooks(db, 'wizard'))).toEqual(['A Wizard of Earthsea']);
    expect(titles(await booksRepo.searchBooks(db, 'le guin'))).toEqual(['A Wizard of Earthsea']);
    expect(titles(await booksRepo.searchBooks(db, '100%'))).toEqual(['Dune']);
    expect(titles(await booksRepo.searchBooks(db, '_'))).toEqual([]);
  });

  it('updates only the given fields and bumps updated_at', async () => {
    const b = await book('Emma', { publisher: 'Penguin' });
    await db.run("UPDATE books SET updated_at = '2000-01-01T00:00:00.000Z' WHERE id = ?", [b.id]);
    const u = await booksRepo.updateBook(db, b.id, { subtitle: 'A Novel', notes: null });
    expect(u).toMatchObject({ title: 'Emma', subtitle: 'A Novel', publisher: 'Penguin', notes: null });
    expect(u!.updatedAt > '2000-01-01T00:00:00.000Z').toBe(true);
    expect(u!.createdAt).toBe(b.createdAt);
  });

  it('deletes a book and cascades its links and loans', async () => {
    const b = await book('Gone');
    const a = await authorsRepo.createAuthor(db, 'Someone');
    const g = await genresRepo.createGenre(db, 'Mystery');
    const grp = await groupsRepo.createGroup(db, { name: 'Favourites' });
    const p = await loansRepo.createBorrower(db, 'Sam');
    await authorsRepo.setBookAuthors(db, b.id, [{ authorId: a.id }]);
    await genresRepo.setBookGenres(db, b.id, [g.id]);
    await groupsRepo.addBookToGroup(db, grp.id, b.id);
    await loansRepo.lendBook(db, { bookId: b.id, borrowerId: p.id, lentOn: '2026-01-01' });
    expect(await booksRepo.deleteBook(db, b.id)).toBe(true);
    for (const t of ['book_authors', 'book_genres', 'group_books', 'loans']) {
      expect(await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`)).toEqual({ n: 0 });
    }
    // The author, genre, group and borrower themselves remain.
    expect(await authorsRepo.getAuthor(db, a.id)).not.toBeNull();
    expect(await genresRepo.getGenre(db, g.id)).not.toBeNull();
    expect(await groupsRepo.getGroup(db, grp.id)).not.toBeNull();
    expect(await loansRepo.getBorrower(db, p.id)).not.toBeNull();
  });

  it('rejects invalid ISBN lengths', async () => {
    await expect(book('Bad', { isbn13: '12345' })).rejects.toThrow(/CHECK/);
  });
});

describe('authors repository', () => {
  it('creates authors with a library sort name', async () => {
    const a = await authorsRepo.createAuthor(db, 'J. R. R. Tolkien');
    expect(a).toEqual({ id: a.id, name: 'J. R. R. Tolkien', sortName: 'Tolkien, J. R. R.' });
    expect(await authorsRepo.getAuthor(db, a.id)).toEqual(a);
    expect((await authorsRepo.createAuthor(db, 'Homer')).sortName).toBe('Homer');
    expect((await authorsRepo.createAuthor(db, 'Le Guin, Ursula', 'Le Guin, Ursula')).sortName).toBe('Le Guin, Ursula');
  });

  it('finds or creates by case-insensitive name', async () => {
    const a = await authorsRepo.findOrCreateAuthor(db, 'Terry Pratchett');
    expect((await authorsRepo.findOrCreateAuthor(db, 'terry pratchett ')).id).toBe(a.id);
    expect(await authorsRepo.findAuthorByName(db, 'Nobody')).toBeNull();
    expect(await authorsRepo.listAuthors(db)).toHaveLength(1);
  });

  it('lists by sort name', async () => {
    await authorsRepo.createAuthor(db, 'Zadie Smith');
    await authorsRepo.createAuthor(db, 'Jane Austen');
    await authorsRepo.createAuthor(db, 'Ann Leckie');
    expect((await authorsRepo.listAuthors(db)).map((a) => a.name)).toEqual(['Jane Austen', 'Ann Leckie', 'Zadie Smith']);
  });

  it('updates and deletes', async () => {
    const a = await authorsRepo.createAuthor(db, 'Iain Banks');
    expect(await authorsRepo.updateAuthor(db, a.id, { name: 'Iain M. Banks' })).toEqual({
      id: a.id,
      name: 'Iain M. Banks',
      sortName: 'Banks, Iain M.',
    });
    expect(await authorsRepo.updateAuthor(db, a.id, { sortName: 'BANKS' })).toMatchObject({ sortName: 'BANKS' });
    expect(await authorsRepo.updateAuthor(db, 999, { name: 'x' })).toBeNull();
    expect(await authorsRepo.deleteAuthor(db, a.id)).toBe(true);
    expect(await authorsRepo.deleteAuthor(db, a.id)).toBe(false);
  });

  it('sets a book’s credited authors in order with roles', async () => {
    const b = await book('Good Omens');
    const p = await authorsRepo.createAuthor(db, 'Terry Pratchett');
    const g = await authorsRepo.createAuthor(db, 'Neil Gaiman');
    const i = await authorsRepo.createAuthor(db, 'Some Illustrator');
    await authorsRepo.setBookAuthors(db, b.id, [{ authorId: g.id }, { authorId: p.id }]);
    await authorsRepo.setBookAuthors(db, b.id, [{ authorId: p.id }, { authorId: g.id }, { authorId: i.id, role: 'illustrator' }]);
    const credits = await authorsRepo.listAuthorsForBook(db, b.id);
    expect(credits.map((c) => [c.name, c.role, c.position])).toEqual([
      ['Terry Pratchett', 'author', 0],
      ['Neil Gaiman', 'author', 1],
      ['Some Illustrator', 'illustrator', 2],
    ]);
  });

  it('rolls back setBookAuthors on a bad author id', async () => {
    const b = await book('X');
    const a = await authorsRepo.createAuthor(db, 'Real Person');
    await authorsRepo.setBookAuthors(db, b.id, [{ authorId: a.id }]);
    await expect(authorsRepo.setBookAuthors(db, b.id, [{ authorId: 999 }])).rejects.toThrow(/FOREIGN KEY/);
    expect((await authorsRepo.listAuthorsForBook(db, b.id)).map((c) => c.id)).toEqual([a.id]);
  });

  it('lists an author’s books, series in order first', async () => {
    const a = await authorsRepo.createAuthor(db, 'Terry Pratchett');
    const s = await seriesRepo.createSeries(db, 'Discworld');
    const b2 = await book('The Light Fantastic', { seriesId: s.id, seriesPosition: 2 });
    const b1 = await book('The Colour of Magic', { seriesId: s.id, seriesPosition: 1 });
    const solo = await book('Strata', { publicationYear: 1981 });
    for (const b of [b2, b1, solo]) await authorsRepo.setBookAuthors(db, b.id, [{ authorId: a.id }]);
    expect(titles(await authorsRepo.listBooksByAuthor(db, a.id))).toEqual(['The Colour of Magic', 'The Light Fantastic', 'Strata']);
  });

  it('groups books by author, co-written books under each, authorless last', async () => {
    const austen = await authorsRepo.createAuthor(db, 'Jane Austen');
    const p = await authorsRepo.createAuthor(db, 'Terry Pratchett');
    const g = await authorsRepo.createAuthor(db, 'Neil Gaiman');
    const emma = await book('Emma');
    const omens = await book('Good Omens');
    await book('Anonymous Diary');
    await authorsRepo.setBookAuthors(db, emma.id, [{ authorId: austen.id }]);
    await authorsRepo.setBookAuthors(db, omens.id, [{ authorId: p.id }, { authorId: g.id }]);
    const groups = await authorsRepo.groupBooksByAuthor(db);
    expect(groups.map((gr) => [gr.key?.name ?? null, titles(gr.books)])).toEqual([
      ['Jane Austen', ['Emma']],
      ['Neil Gaiman', ['Good Omens']],
      ['Terry Pratchett', ['Good Omens']],
      [null, ['Anonymous Diary']],
    ]);
  });
});

describe('genres repository', () => {
  it('creates, gets, lists, renames and deletes', async () => {
    const f = await genresRepo.createGenre(db, ' Fantasy ');
    expect(f.name).toBe('Fantasy');
    await genresRepo.createGenre(db, 'crime');
    expect(await genresRepo.getGenre(db, f.id)).toEqual(f);
    expect((await genresRepo.listGenres(db)).map((g) => g.name)).toEqual(['crime', 'Fantasy']);
    expect(await genresRepo.renameGenre(db, f.id, 'High Fantasy')).toEqual({ id: f.id, name: 'High Fantasy' });
    expect(await genresRepo.renameGenre(db, 999, 'x')).toBeNull();
    expect(await genresRepo.deleteGenre(db, f.id)).toBe(true);
    expect(await genresRepo.getGenre(db, f.id)).toBeNull();
  });

  it('treats names as unique case-insensitively', async () => {
    const f = await genresRepo.createGenre(db, 'Fantasy');
    await expect(genresRepo.createGenre(db, 'FANTASY')).rejects.toThrow(/UNIQUE/);
    expect((await genresRepo.findOrCreateGenre(db, 'fantasy')).id).toBe(f.id);
    expect(await genresRepo.findGenreByName(db, 'Horror')).toBeNull();
  });

  it('sets, adds and removes book genres with the user-edited flag', async () => {
    const b = await book('Dune');
    const sf = await genresRepo.createGenre(db, 'Science Fiction');
    const cl = await genresRepo.createGenre(db, 'Classics');
    const ad = await genresRepo.createGenre(db, 'Adventure');
    await genresRepo.setBookGenres(db, b.id, [sf.id, cl.id, sf.id]);
    expect(await genresRepo.listGenresForBook(db, b.id)).toEqual([
      { id: cl.id, name: 'Classics', userEdited: false },
      { id: sf.id, name: 'Science Fiction', userEdited: false },
    ]);
    await genresRepo.addBookGenre(db, b.id, ad.id, { userEdited: true });
    await genresRepo.addBookGenre(db, b.id, sf.id, { userEdited: true });
    await genresRepo.addBookGenre(db, b.id, sf.id); // a later lookup must not clear the user's flag
    expect((await genresRepo.listGenresForBook(db, b.id)).map((g) => [g.name, g.userEdited])).toEqual([
      ['Adventure', true],
      ['Classics', false],
      ['Science Fiction', true],
    ]);
    expect(await genresRepo.removeBookGenre(db, b.id, cl.id)).toBe(true);
    expect(await genresRepo.removeBookGenre(db, b.id, cl.id)).toBe(false);
    await genresRepo.setBookGenres(db, b.id, [cl.id], { userEdited: true });
    expect(await genresRepo.listGenresForBook(db, b.id)).toEqual([{ id: cl.id, name: 'Classics', userEdited: true }]);
  });

  it('deleting a genre unlinks it from books', async () => {
    const b = await book('Dune');
    const sf = await genresRepo.createGenre(db, 'SF');
    await genresRepo.setBookGenres(db, b.id, [sf.id]);
    await genresRepo.deleteGenre(db, sf.id);
    expect(await genresRepo.listGenresForBook(db, b.id)).toEqual([]);
    expect(await booksRepo.getBook(db, b.id)).not.toBeNull();
  });

  it('lists books in a genre and groups the whole shelf by genre', async () => {
    const sf = await genresRepo.createGenre(db, 'Science Fiction');
    const cl = await genresRepo.createGenre(db, 'classics');
    const dune = await book('Dune');
    const emma = await book('Emma');
    const frank = await book('Frankenstein');
    await book('Untagged');
    await genresRepo.setBookGenres(db, dune.id, [sf.id]);
    await genresRepo.setBookGenres(db, emma.id, [cl.id]);
    await genresRepo.setBookGenres(db, frank.id, [sf.id, cl.id]);
    expect(titles(await genresRepo.listBooksByGenre(db, sf.id))).toEqual(['Dune', 'Frankenstein']);
    const groups = await genresRepo.groupBooksByGenre(db);
    expect(groups.map((g) => [g.key?.name ?? null, titles(g.books)])).toEqual([
      ['classics', ['Emma', 'Frankenstein']],
      ['Science Fiction', ['Dune', 'Frankenstein']],
      [null, ['Untagged']],
    ]);
  });
});

describe('series repository', () => {
  it('creates, finds, lists, updates and deletes', async () => {
    const s = await seriesRepo.createSeries(db, 'Earthsea', 6);
    expect(s).toEqual({ id: s.id, name: 'Earthsea', totalCount: 6 });
    expect(await seriesRepo.getSeries(db, s.id)).toEqual(s);
    expect((await seriesRepo.findOrCreateSeries(db, 'earthsea')).id).toBe(s.id);
    expect(await seriesRepo.findSeriesByName(db, 'Nope')).toBeNull();
    await seriesRepo.createSeries(db, 'Discworld');
    expect((await seriesRepo.listSeries(db)).map((x) => x.name)).toEqual(['Discworld', 'Earthsea']);
    expect(await seriesRepo.updateSeries(db, s.id, { totalCount: 7 })).toEqual({ ...s, totalCount: 7 });
    expect(await seriesRepo.updateSeries(db, 999, { name: 'x' })).toBeNull();
    expect(await seriesRepo.deleteSeries(db, s.id)).toBe(true);
    expect(await seriesRepo.getSeries(db, s.id)).toBeNull();
  });

  it('orders a series by position, unnumbered books last', async () => {
    const s = await seriesRepo.createSeries(db, 'Discworld');
    const c = await book('Mort');
    const a = await book('The Colour of Magic');
    const n = await book('A Discworld Companion');
    const h = await book('Equal Rites');
    const half = await book('Troll Bridge');
    await seriesRepo.setBookSeries(db, c.id, s.id, 4);
    await seriesRepo.setBookSeries(db, a.id, s.id, 1);
    await seriesRepo.setBookSeries(db, n.id, s.id, null);
    await seriesRepo.setBookSeries(db, h.id, s.id, 3);
    await seriesRepo.setBookSeries(db, half.id, s.id, 3.5);
    expect(titles(await seriesRepo.listBooksInSeries(db, s.id))).toEqual([
      'The Colour of Magic',
      'Equal Rites',
      'Troll Bridge',
      'Mort',
      'A Discworld Companion',
    ]);
    expect((await booksRepo.getBook(db, half.id))!.seriesPosition).toBe(3.5);
  });

  it('removing a book from a series clears its position', async () => {
    const s = await seriesRepo.createSeries(db, 'S');
    const b = await book('B');
    await seriesRepo.setBookSeries(db, b.id, s.id, 2);
    await seriesRepo.setBookSeries(db, b.id, null, 2);
    expect(await booksRepo.getBook(db, b.id)).toMatchObject({ seriesId: null, seriesPosition: null });
  });

  it('deleting a series keeps its books as standalones', async () => {
    const s = await seriesRepo.createSeries(db, 'S');
    const b = await book('B', { seriesId: s.id, seriesPosition: 1 });
    await seriesRepo.deleteSeries(db, s.id);
    expect(await booksRepo.getBook(db, b.id)).toMatchObject({ seriesId: null });
  });

  it('groups books by series in reading order, standalones last', async () => {
    const d = await seriesRepo.createSeries(db, 'Dune Chronicles', 6);
    const e = await seriesRepo.createSeries(db, 'Earthsea');
    await book('Children of Dune', { seriesId: d.id, seriesPosition: 3 });
    await book('Dune', { seriesId: d.id, seriesPosition: 1 });
    await book('Tehanu', { seriesId: e.id, seriesPosition: 4 });
    await book('Standalone');
    const groups = await seriesRepo.groupBooksBySeries(db);
    expect(groups.map((g) => [g.key?.name ?? null, titles(g.books)])).toEqual([
      ['Dune Chronicles', ['Dune', 'Children of Dune']],
      ['Earthsea', ['Tehanu']],
      [null, ['Standalone']],
    ]);
    expect(groups[0].key).toEqual({ id: d.id, name: 'Dune Chronicles', totalCount: 6 });
  });
});

describe('groups repository', () => {
  it('creates, gets, lists, updates and deletes', async () => {
    const g = await groupsRepo.createGroup(db, { name: 'Summer reads', colour: '#653D9E', icon: 'sun' });
    expect(g).toMatchObject({ name: 'Summer reads', colour: '#653D9E', icon: 'sun' });
    expect(g.createdAt).toMatch(/^\d{4}-/);
    expect(await groupsRepo.getGroup(db, g.id)).toEqual(g);
    await groupsRepo.createGroup(db, { name: 'Book club' });
    expect((await groupsRepo.listGroups(db)).map((x) => x.name)).toEqual(['Book club', 'Summer reads']);
    expect(await groupsRepo.updateGroup(db, g.id, { name: 'Holiday', icon: null })).toMatchObject({
      name: 'Holiday',
      colour: '#653D9E',
      icon: null,
    });
    expect(await groupsRepo.updateGroup(db, 999, { name: 'x' })).toBeNull();
    expect(await groupsRepo.deleteGroup(db, g.id)).toBe(true);
    expect(await groupsRepo.getGroup(db, g.id)).toBeNull();
  });

  it('adds books in shelf order, repositions and removes them', async () => {
    const g = await groupsRepo.createGroup(db, { name: 'Club' });
    const a = await book('Zed');
    const b = await book('Alpha');
    const c = await book('Middle');
    await groupsRepo.addBookToGroup(db, g.id, a.id);
    await groupsRepo.addBookToGroup(db, g.id, b.id);
    await groupsRepo.addBookToGroup(db, g.id, c.id);
    expect(titles(await groupsRepo.listBooksInGroup(db, g.id))).toEqual(['Zed', 'Alpha', 'Middle']);
    await groupsRepo.addBookToGroup(db, g.id, c.id, -1);
    await groupsRepo.addBookToGroup(db, g.id, a.id); // re-adding without a position keeps it where it is
    expect(titles(await groupsRepo.listBooksInGroup(db, g.id))).toEqual(['Middle', 'Zed', 'Alpha']);
    expect(await groupsRepo.removeBookFromGroup(db, g.id, a.id)).toBe(true);
    expect(await groupsRepo.removeBookFromGroup(db, g.id, a.id)).toBe(false);
    expect(titles(await groupsRepo.listBooksInGroup(db, g.id))).toEqual(['Middle', 'Alpha']);
  });

  it('lists a book’s groups and deleting a group keeps its books', async () => {
    const g1 = await groupsRepo.createGroup(db, { name: 'B group' });
    const g2 = await groupsRepo.createGroup(db, { name: 'A group' });
    const b = await book('Shared');
    await groupsRepo.addBookToGroup(db, g1.id, b.id);
    await groupsRepo.addBookToGroup(db, g2.id, b.id);
    expect((await groupsRepo.listGroupsForBook(db, b.id)).map((g) => g.name)).toEqual(['A group', 'B group']);
    await groupsRepo.deleteGroup(db, g1.id);
    expect((await groupsRepo.listGroupsForBook(db, b.id)).map((g) => g.name)).toEqual(['A group']);
    expect(await booksRepo.getBook(db, b.id)).not.toBeNull();
  });

  it('groups books by user group, including empty groups', async () => {
    const club = await groupsRepo.createGroup(db, { name: 'Book club' });
    await groupsRepo.createGroup(db, { name: 'Empty shelf' });
    const x = await book('Second');
    const y = await book('First');
    await groupsRepo.addBookToGroup(db, club.id, y.id);
    await groupsRepo.addBookToGroup(db, club.id, x.id);
    const groups = await groupsRepo.groupBooksByGroup(db);
    expect(groups.map((g) => [g.key?.name, titles(g.books)])).toEqual([
      ['Book club', ['First', 'Second']],
      ['Empty shelf', []],
    ]);
    expect(groups[0].key).toEqual(club);
  });
});

describe('borrowers and loans repository', () => {
  it('creates, lists, updates and deletes borrowers', async () => {
    const s = await loansRepo.createBorrower(db, ' Sam ', 'sam@example.com');
    await loansRepo.createBorrower(db, 'alex');
    expect(s).toEqual({ id: s.id, name: 'Sam', contact: 'sam@example.com' });
    expect(await loansRepo.getBorrower(db, s.id)).toEqual(s);
    expect((await loansRepo.listBorrowers(db)).map((b) => b.name)).toEqual(['alex', 'Sam']);
    expect(await loansRepo.updateBorrower(db, s.id, { contact: null })).toEqual({ ...s, contact: null });
    expect(await loansRepo.updateBorrower(db, 999, { name: 'x' })).toBeNull();
    expect(await loansRepo.deleteBorrower(db, s.id)).toBe(true);
    expect(await loansRepo.getBorrower(db, s.id)).toBeNull();
  });

  it('lends and returns a book', async () => {
    const b = await book('Emma');
    const p = await loansRepo.createBorrower(db, 'Sam');
    const loan = await loansRepo.lendBook(db, { bookId: b.id, borrowerId: p.id, lentOn: '2026-09-01', dueOn: '2026-09-15', note: 'Careful' });
    expect(loan).toEqual({ id: loan.id, bookId: b.id, borrowerId: p.id, lentOn: '2026-09-01', dueOn: '2026-09-15', returnedOn: null, note: 'Careful' });
    expect(await loansRepo.getLoan(db, loan.id)).toEqual(loan);
    expect(await loansRepo.getOpenLoanForBook(db, b.id)).toEqual(loan);
    const returned = await loansRepo.returnLoan(db, loan.id, '2026-09-10');
    expect(returned?.returnedOn).toBe('2026-09-10');
    expect(await loansRepo.getOpenLoanForBook(db, b.id)).toBeNull();
    expect(await loansRepo.returnLoan(db, loan.id, '2026-09-11')).toBeNull();
  });

  it('allows only one open loan per book', async () => {
    const b = await book('Emma');
    const other = await book('Dune');
    const sam = await loansRepo.createBorrower(db, 'Sam');
    const kim = await loansRepo.createBorrower(db, 'Kim');
    const first = await loansRepo.lendBook(db, { bookId: b.id, borrowerId: sam.id, lentOn: '2026-01-01' });
    await expect(loansRepo.lendBook(db, { bookId: b.id, borrowerId: kim.id, lentOn: '2026-01-02' })).rejects.toBeInstanceOf(
      BookAlreadyOnLoanError,
    );
    // The constraint is enforced by the schema itself, not just the repository.
    await expect(
      db.run("INSERT INTO loans (book_id, borrower_id, lent_on) VALUES (?, ?, '2026-01-02')", [b.id, kim.id]),
    ).rejects.toThrow(/UNIQUE constraint failed: loans\.book_id/);
    // Other books are unaffected, and once returned the book can go out again.
    await loansRepo.lendBook(db, { bookId: other.id, borrowerId: kim.id, lentOn: '2026-01-02' });
    await loansRepo.returnLoan(db, first.id, '2026-01-05');
    const again = await loansRepo.lendBook(db, { bookId: b.id, borrowerId: kim.id, lentOn: '2026-01-06' });
    expect(again.borrowerId).toBe(kim.id);
    expect((await loansRepo.listLoansForBook(db, b.id)).map((l) => l.borrowerName)).toEqual(['Kim', 'Sam']);
  });

  it('rejects due and return dates before the lend date', async () => {
    const b = await book('Emma');
    const p = await loansRepo.createBorrower(db, 'Sam');
    await expect(loansRepo.lendBook(db, { bookId: b.id, borrowerId: p.id, lentOn: '2026-02-01', dueOn: '2026-01-01' })).rejects.toThrow(/CHECK/);
    const l = await loansRepo.lendBook(db, { bookId: b.id, borrowerId: p.id, lentOn: '2026-02-01' });
    await expect(loansRepo.returnLoan(db, l.id, '2026-01-01')).rejects.toThrow(/CHECK/);
  });

  it('lists open loans soonest-due first and overdue loans', async () => {
    const p = await loansRepo.createBorrower(db, 'Sam');
    const mk = async (title: string, dueOn: string | null, returned = false) => {
      const b = await book(title);
      const l = await loansRepo.lendBook(db, { bookId: b.id, borrowerId: p.id, lentOn: '2026-01-01', dueOn });
      if (returned) await loansRepo.returnLoan(db, l.id, '2026-01-02');
    };
    await mk('No due date', null);
    await mk('Due later', '2026-12-01');
    await mk('Overdue', '2026-02-01');
    await mk('Returned', '2026-01-10', true);
    expect((await loansRepo.listOpenLoans(db)).map((l) => l.bookTitle)).toEqual(['Overdue', 'Due later', 'No due date']);
    const overdue = await loansRepo.listOverdueLoans(db, '2026-09-25');
    expect(overdue.map((l) => [l.bookTitle, l.borrowerName])).toEqual([['Overdue', 'Sam']]);
  });

  it('lists a borrower’s loans with open ones first', async () => {
    const p = await loansRepo.createBorrower(db, 'Sam');
    const a = await book('Old');
    const b = await book('Current');
    const old = await loansRepo.lendBook(db, { bookId: a.id, borrowerId: p.id, lentOn: '2026-03-01' });
    await loansRepo.returnLoan(db, old.id, '2026-03-05');
    await loansRepo.lendBook(db, { bookId: b.id, borrowerId: p.id, lentOn: '2026-01-01' });
    expect((await loansRepo.listLoansForBorrower(db, p.id)).map((l) => l.bookTitle)).toEqual(['Current', 'Old']);
  });

  it('updates and deletes loans', async () => {
    const b = await book('Emma');
    const p = await loansRepo.createBorrower(db, 'Sam');
    const l = await loansRepo.lendBook(db, { bookId: b.id, borrowerId: p.id, lentOn: '2026-01-01' });
    expect(await loansRepo.updateLoan(db, l.id, { dueOn: '2026-01-20', note: 'Extended' })).toMatchObject({ dueOn: '2026-01-20', note: 'Extended' });
    expect(await loansRepo.updateLoan(db, 999, { note: 'x' })).toBeNull();
    expect(await loansRepo.deleteLoan(db, l.id)).toBe(true);
    expect(await loansRepo.getLoan(db, l.id)).toBeNull();
  });

  it('keeps loan history by refusing to delete a borrower with loans', async () => {
    const b = await book('Emma');
    const p = await loansRepo.createBorrower(db, 'Sam');
    const l = await loansRepo.lendBook(db, { bookId: b.id, borrowerId: p.id, lentOn: '2026-01-01' });
    await loansRepo.returnLoan(db, l.id, '2026-01-02');
    await expect(loansRepo.deleteBorrower(db, p.id)).rejects.toBeInstanceOf(BorrowerHasLoansError);
    await loansRepo.deleteLoan(db, l.id);
    expect(await loansRepo.deleteBorrower(db, p.id)).toBe(true);
  });
});

describe('settings repository', () => {
  it('gets, sets, overwrites, lists and deletes', async () => {
    expect(await settingsRepo.getSetting(db, 'theme')).toBeNull();
    await settingsRepo.setSetting(db, 'theme', 'light');
    await settingsRepo.setSetting(db, 'theme', 'dark');
    await settingsRepo.setSetting(db, 'booky.tips', 'on');
    expect(await settingsRepo.getSetting(db, 'theme')).toBe('dark');
    expect(await settingsRepo.listSettings(db)).toEqual({ 'booky.tips': 'on', theme: 'dark' });
    expect(await settingsRepo.deleteSetting(db, 'theme')).toBe(true);
    expect(await settingsRepo.deleteSetting(db, 'theme')).toBe(false);
  });
});
