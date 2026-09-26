import { authorsRepo, booksRepo, genresRepo, groupsRepo, libraryRepo, loansRepo, seriesRepo, settingsRepo, type Db } from '@/db';
import { addDays, isbn13To10, today } from '@/domain';

import { fixtures, type FixtureName } from './fixtures';

/**
 * Replaces the whole library with a named fixture, in one transaction (a
 * failure leaves the previous library untouched). Loan dates are relative to
 * `today()`, so freeze it first with `setToday` for fully fixed dates.
 * Shared by the E2E route and Jest.
 */
export async function loadFixture(db: Db, name: FixtureName): Promise<void> {
  const fixture = fixtures[name];
  const now = today();
  await db.transaction(async (tx) => {
    await libraryRepo.wipeLibrary(tx);
    const bookIds = new Map<string, number>();
    const authorIds = new Map<string, number>();
    const genreIds = new Map<string, number>();
    const seriesIds = new Map<string, number>();
    const pendingSeries: number[] = [];
    const cached = async (cache: Map<string, number>, key: string, make: () => Promise<{ id: number }>) => {
      const hit = cache.get(key);
      if (hit != null) return hit;
      const { id } = await make();
      cache.set(key, id);
      return id;
    };

    for (const { authors = [], genres = [], series, ...fields } of fixture.books) {
      const seriesId = series ? await cached(seriesIds, series.name, () => seriesRepo.findOrCreateSeries(tx, series.name)) : null;
      const book = await booksRepo.createBook(tx, {
        source: 'manual',
        ...fields,
        isbn10: fields.isbn10 ?? (fields.isbn13 ? isbn13To10(fields.isbn13) : null),
        seriesId,
        seriesPosition: series?.position ?? null,
      });
      bookIds.set(book.title, book.id);
      if (series?.detected) pendingSeries.push(book.id);
      const links = [];
      for (const a of authors) {
        const { name, role } = typeof a === 'string' ? { name: a, role: 'author' as const } : a;
        links.push({ authorId: await cached(authorIds, name, () => authorsRepo.findOrCreateAuthor(tx, name)), role });
      }
      if (links.length) await authorsRepo.setBookAuthors(tx, book.id, links);
      const gids = [];
      for (const g of genres) gids.push(await cached(genreIds, g, () => genresRepo.findOrCreateGenre(tx, g)));
      if (gids.length) await genresRepo.setBookGenres(tx, book.id, gids);
    }

    const idOf = (title: string) => {
      const id = bookIds.get(title);
      if (id == null) throw new Error(`Fixture ${name}: no book titled "${title}"`);
      return id;
    };

    const borrowerIds = new Map<string, number>();
    for (const loan of fixture.loans ?? []) {
      const borrowerId = await cached(borrowerIds, loan.borrower, () => loansRepo.createBorrower(tx, loan.borrower));
      const lentOn = addDays(now, -loan.lentDaysAgo);
      const created = await loansRepo.lendBook(tx, {
        bookId: idOf(loan.book),
        borrowerId,
        lentOn,
        dueOn: loan.dueInDays == null ? null : addDays(now, loan.dueInDays),
        note: loan.note ?? null,
      });
      if (loan.returnedDaysAgo != null) await loansRepo.returnLoan(tx, created.id, addDays(now, -loan.returnedDaysAgo));
    }

    // Settings survive the wipe, but these name books, series and loans by id: start them afresh.
    await settingsRepo.setSetting(tx, 'series.pendingConfirmBookIds', pendingSeries);
    await settingsRepo.setSetting(tx, 'series.dismissedBookIds', []);
    // What Booky has already said names series and loans too; the first-run experience only when the fixture asks.
    await settingsRepo.setSetting(tx, 'booky.seen', []);
    await settingsRepo.setSetting(tx, 'onboarding.done', fixture.onboarding ?? null);

    for (const group of fixture.groups ?? []) {
      const { id } = await groupsRepo.createGroup(tx, { name: group.name, colour: group.colour, icon: group.icon });
      for (const title of group.books) await groupsRepo.addBookToGroup(tx, id, idOf(title));
    }
  });
}
