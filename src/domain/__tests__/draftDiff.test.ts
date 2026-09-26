import { emptyDraft, type BookDraft } from '../bookDraft';
import { applyChanges, diffDrafts, refreshedGenres, type CurrentBook } from '../draftDiff';

const draft = (patch: Partial<BookDraft>): BookDraft => ({ ...emptyDraft(), ...patch });

const current: CurrentBook = {
  draft: draft({
    title: 'The Farthest Shore',
    authors: [{ name: 'Ursula K. Le Guin', role: 'author', sortName: null }],
    publisher: 'Puffin',
    year: '1972',
    pages: '223',
    format: 'paperback',
    language: 'en',
    genres: ['Fantasy', 'Sea stories'],
    seriesName: 'Earthsea',
    seriesPosition: '3',
    notes: 'Mine',
  }),
  userGenres: ['Sea stories'],
};

const proposed = draft({
  title: 'The  farthest shore',
  authors: [{ name: 'Ursula K. Le Guin', role: 'author', sortName: null }],
  publisher: 'Puffin Books',
  year: '1974',
  pages: '214',
  format: '',
  language: 'en',
  genres: ['Fantasy', "Children's"],
  summary: 'A young prince joins forces with a master wizard.',
});

describe('diffDrafts', () => {
  const changes = diffDrafts(current, proposed, { hasCover: false, proposedCover: true });
  const byField = Object.fromEntries(changes.map((c) => [c.field, c]));

  it('lists additions ticked and replacements unticked', () => {
    expect(byField.summary).toEqual({ field: 'summary', kind: 'add', from: '', to: 'A young prince joins forces with a master wizard.', suggested: true });
    expect(byField.pages).toEqual({ field: 'pages', kind: 'change', from: '223', to: '214', suggested: false });
    expect(byField.year).toMatchObject({ kind: 'change', from: '1972', to: '1974', suggested: false });
    expect(byField.publisher).toMatchObject({ kind: 'change', from: 'Puffin', to: 'Puffin Books' });
  });

  it('offers a cover only to a book without one', () => {
    expect(byField.cover).toMatchObject({ kind: 'add', suggested: true });
    expect(diffDrafts(current, proposed, { hasCover: true, proposedCover: true }).some((c) => c.field === 'cover')).toBe(false);
    expect(diffDrafts(current, proposed, { hasCover: false, proposedCover: false }).some((c) => c.field === 'cover')).toBe(false);
  });

  it('ignores differences of case and spacing, and never clears a field', () => {
    expect(byField.title).toBeUndefined(); // "The  farthest shore" is the same title
    expect(byField.format).toBeUndefined(); // the lookup does not know the format
    expect(byField.series).toBeUndefined(); // nor the series
    expect(byField.authors).toBeUndefined();
    expect(byField.language).toBeUndefined();
  });

  it('keeps the user’s genres and adds the provider’s', () => {
    expect(byField.genres).toMatchObject({ kind: 'change', from: 'Fantasy, Sea stories', to: "Fantasy, Sea stories, Children's", suggested: true });
  });

  it('reports nothing when the lookup agrees', () => {
    expect(diffDrafts(current, current.draft, { hasCover: true, proposedCover: false })).toEqual([]);
  });
});

describe('refreshedGenres', () => {
  it('never removes a user-edited genre, drops a looked-up one the provider no longer lists', () => {
    const book: CurrentBook = { draft: draft({ genres: ['Horror', 'Mystery'] }), userGenres: ['Mystery'] };
    expect(refreshedGenres(book, ['Fantasy'])).toEqual(['Mystery', 'Fantasy']);
    expect(refreshedGenres(book, ['horror'])).toEqual(['Horror', 'Mystery']);
  });

  it('marks a removal as not suggested', () => {
    const book: CurrentBook = { draft: draft({ genres: ['Horror'] }), userGenres: [] };
    const [change] = diffDrafts(book, draft({ genres: ['Fantasy'] }), { hasCover: true, proposedCover: false });
    expect(change).toMatchObject({ field: 'genres', from: 'Horror', to: 'Fantasy', suggested: false });
  });
});

describe('applyChanges', () => {
  it('changes only the ticked fields', () => {
    const out = applyChanges(current, proposed, new Set(['summary']));
    expect(out).toEqual({ ...current.draft, summary: proposed.summary });
  });

  it('applies genres by the refresh rule, and series as a pair', () => {
    const withSeries = draft({ ...proposed, seriesName: 'Earthsea Cycle', seriesPosition: '3' });
    const out = applyChanges(current, withSeries, new Set(['genres', 'series', 'pages']));
    expect(out.genres).toEqual(['Fantasy', 'Sea stories', "Children's"]);
    expect(out.seriesName).toBe('Earthsea Cycle');
    expect(out.pages).toBe('214');
    expect(out.year).toBe('1972');
    expect(out.notes).toBe('Mine');
  });
});
