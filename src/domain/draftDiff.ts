import type { BookDraft } from './bookDraft';

/** The fields "Refresh details" can update. The ISBN (the book's identity) and the user's notes never change. */
export const refreshFields = [
  'cover',
  'title',
  'subtitle',
  'authors',
  'publisher',
  'year',
  'edition',
  'format',
  'pages',
  'language',
  'genres',
  'series',
  'summary',
] as const;

export type RefreshField = (typeof refreshFields)[number];

export const refreshFieldLabels: Record<RefreshField, string> = {
  cover: 'Cover',
  title: 'Title',
  subtitle: 'Subtitle',
  authors: 'Authors',
  publisher: 'Publisher',
  year: 'Year',
  edition: 'Edition',
  format: 'Format',
  pages: 'Pages',
  language: 'Language',
  genres: 'Genres',
  series: 'Series',
  summary: 'Summary',
};

/** One field that differs: `add` fills an empty field, `change` replaces a value. */
export interface FieldChange {
  field: RefreshField;
  kind: 'add' | 'change';
  /** Display text of the current value ('' for none). */
  from: string;
  /** Display text of the proposed value. */
  to: string;
  /** Ticked unless it would overwrite something the user may have typed: additions are, replacements are not. */
  suggested: boolean;
}

/** The book as it is, for the diff: its form draft plus which genres the user chose. */
export interface CurrentBook {
  draft: BookDraft;
  /** Genres the user chose or edited (`user_edited = 1`); a refresh never removes these. */
  userGenres: readonly string[];
}

const same = (a: string, b: string) => a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();
const seriesText = (d: BookDraft) => (d.seriesName.trim() ? `${d.seriesName.trim()}${d.seriesPosition.trim() ? ` #${d.seriesPosition.trim()}` : ''}` : '');

/**
 * The genres a refresh would leave: the user's own genres always stay; the
 * provider's genres are added; other genres (from an earlier lookup) stay
 * only if the provider still lists them. Library spelling wins.
 */
export function refreshedGenres(current: CurrentBook, proposed: readonly string[]): string[] {
  const out: string[] = [];
  const add = (g: string) => {
    if (g.trim() && !out.some((o) => same(o, g))) out.push(g);
  };
  for (const g of current.draft.genres) {
    const mine = current.userGenres.some((u) => same(u, g));
    if (mine || proposed.some((p) => same(p, g))) add(g);
  }
  for (const g of proposed) add(g);
  return out;
}

/**
 * Field-by-field differences between a book and what a lookup proposes
 * ("Summary: add", "Pages: 320 → 336"). Only fields the lookup actually knows
 * are compared: an empty proposal never clears anything. `hasCover` says
 * whether the book already has a cover; a cover is only ever offered to a
 * book without one.
 */
export function diffDrafts(current: CurrentBook, proposed: BookDraft, { hasCover, proposedCover }: { hasCover: boolean; proposedCover: boolean }): FieldChange[] {
  const d = current.draft;
  const changes: FieldChange[] = [];
  const text = (field: RefreshField, from: string, to: string) => {
    if (!to.trim() || same(from, to)) return;
    const kind = from.trim() ? 'change' : 'add';
    changes.push({ field, kind, from: from.trim(), to: to.trim(), suggested: kind === 'add' });
  };

  if (!hasCover && proposedCover) changes.push({ field: 'cover', kind: 'add', from: '', to: 'The real cover', suggested: true });
  text('title', d.title, proposed.title);
  text('subtitle', d.subtitle, proposed.subtitle);
  const authorsFrom = d.authors.map((a) => a.name).join(', ');
  const authorsTo = proposed.authors.map((a) => a.name).join(', ');
  text('authors', authorsFrom, authorsTo);
  text('publisher', d.publisher, proposed.publisher);
  text('year', d.year, proposed.year);
  text('edition', d.edition, proposed.edition);
  text('format', d.format, proposed.format);
  text('pages', d.pages, proposed.pages);
  text('language', d.language, proposed.language);

  if (proposed.genres.length) {
    const next = refreshedGenres(current, proposed.genres);
    const from = d.genres.join(', ');
    const to = next.join(', ');
    if (!same(from, to)) {
      const onlyAdds = d.genres.every((g) => next.some((n) => same(n, g)));
      changes.push({ field: 'genres', kind: d.genres.length ? 'change' : 'add', from, to, suggested: onlyAdds });
    }
  }
  if (proposed.seriesName.trim()) text('series', seriesText(d), seriesText(proposed));
  text('summary', d.summary, proposed.summary);
  return changes;
}

/**
 * The draft after applying the ticked changes: every other field keeps the
 * book's value. Genres follow `refreshedGenres`.
 */
export function applyChanges(current: CurrentBook, proposed: BookDraft, ticked: ReadonlySet<RefreshField>): BookDraft {
  const out: BookDraft = { ...current.draft };
  const take = <K extends keyof BookDraft>(field: RefreshField, key: K) => {
    if (ticked.has(field)) out[key] = proposed[key];
  };
  take('title', 'title');
  take('subtitle', 'subtitle');
  take('authors', 'authors');
  take('publisher', 'publisher');
  take('year', 'year');
  take('edition', 'edition');
  take('format', 'format');
  take('pages', 'pages');
  take('language', 'language');
  take('summary', 'summary');
  if (ticked.has('series')) {
    out.seriesName = proposed.seriesName;
    out.seriesPosition = proposed.seriesPosition;
  }
  if (ticked.has('genres')) out.genres = refreshedGenres(current, proposed.genres);
  return out;
}
