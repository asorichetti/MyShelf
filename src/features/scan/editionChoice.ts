import { bookMatchKey, normaliseText, type LanguagePreference } from '@/domain';
import { rankEditions, type BookCandidate } from '@/services/metadata';
import { coverUrlFromId } from '@/services/metadata/openLibraryMap';

/** One work in the picker: the search result (or first volume) and the editions known for it. */
export interface WorkGroup {
  key: string;
  /** What the group header shows: the work (a search result) or its first volume. */
  work: BookCandidate;
  /** Editions that came with the results (Google Books volumes, ISBN hits). */
  members: BookCandidate[];
}

const groupKey = (c: BookCandidate) => c.workKey ?? `t:${bookMatchKey(c.title, c.authors[0])}`;
const titleKey = (c: BookCandidate) => bookMatchKey(c.title, c.authors[0]);

/**
 * Groups search results by work: Open Library works by their key, and any
 * other result (a Google Books volume) with the work of the same title and
 * first author, else on its own. Order follows the ranking.
 */
export function groupByWork(candidates: readonly BookCandidate[]): WorkGroup[] {
  const groups: WorkGroup[] = [];
  for (const c of candidates) {
    const sameWork = (g: WorkGroup) => !g.work.workKey || !c.workKey || g.work.workKey === c.workKey;
    const existing = groups.find((g) => g.key === groupKey(c)) ?? groups.find((g) => titleKey(g.work) === titleKey(c) && sameWork(g));
    if (existing) {
      if (c.kind === 'edition') existing.members.push(c);
      else if (existing.work.kind === 'edition') {
        // A work outranks its volume as the header, and its key lists the editions.
        existing.work = c;
        existing.key = groupKey(c);
      }
      continue;
    }
    groups.push({ key: groupKey(c), work: c, members: c.kind === 'edition' ? [c] : [] });
  }
  return groups;
}

const editionKey = (c: BookCandidate) => c.isbn13 ?? c.isbn10 ?? `${c.source}:${c.sourceId}`;

/** One entry per edition: by ISBN, else by provider record. */
export function dedupeEditions(list: readonly BookCandidate[]): BookCandidate[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    const key = editionKey(c);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface OrderEditionsOptions {
  /** The language to prefer (read on the cover, else the app's). */
  language?: LanguagePreference | null;
  /** The title read on the cover; the work's title when there is none. */
  title?: string | null;
}

/**
 * A work's editions as the picker lists them: the ones that came with the
 * search and the ones loaded for the work, once each, likeliest first
 * (`rankEditions`: the cover's language, the title, a cover, a fuller record).
 */
export function orderEditions(group: WorkGroup, loaded: readonly BookCandidate[], { language, title }: OrderEditionsOptions = {}): BookCandidate[] {
  return rankEditions(dedupeEditions([...group.members, ...loaded]), { language, title: title ?? group.work.title });
}

/**
 * A work's editions loaded page by page ("Show more editions"): the first
 * page with the search's own editions as `orderEditions` ranks them, then
 * each later page ranked on its own and added after, less editions already
 * listed. What is on screen keeps its place as more arrive.
 */
export function orderEditionPages(group: WorkGroup, pages: readonly (readonly BookCandidate[])[], options: OrderEditionsOptions = {}): BookCandidate[] {
  const [first = [], ...later] = pages;
  const list = orderEditions(group, first, options);
  const seen = new Set(list.map(editionKey));
  for (const page of later) {
    const fresh = dedupeEditions(page).filter((e) => !seen.has(editionKey(e)));
    fresh.forEach((e) => seen.add(editionKey(e)));
    list.push(...rankEditions(fresh, { language: options.language, title: options.title ?? group.work.title }));
  }
  return list;
}

/**
 * Whether an edition matches what was typed to find it: every word must
 * match. Four digits are a year; more digits (hyphens and spaces ignored
 * inside a word) are part of an ISBN; anything else is found in the
 * publisher, edition name, title or subtitle, ignoring case and accents.
 */
export function editionMatches(edition: BookCandidate, text: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = normaliseText([edition.publisher, edition.edition, edition.title, edition.subtitle].filter(Boolean).join(' '), { dropArticle: false });
  const isbns = [edition.isbn13, edition.isbn10].filter((i): i is string => Boolean(i));
  return words.every((word) => {
    const digits = word.replace(/[-‐]/g, '');
    if (/^\d{4}$/.test(digits)) return edition.publicationYear === Number(digits);
    if (/^\d{5,}[\dXx]?$/.test(digits)) return isbns.some((i) => i.includes(digits.toUpperCase()));
    const needle = normaliseText(word, { dropArticle: false });
    return !needle || haystack.includes(needle);
  });
}

const firstCoverId = (c: BookCandidate) => c.coverRefs.olEditionCoverIds[0];

/**
 * An edition picked from a work, with what the work and its other editions
 * know filled in: subjects, series hints, summary, key and authors where it
 * has none, the work's cover to show where it has none, and every cover the
 * chain can fall back on. Editions from a
 * work's `editions.json` come without the work, so on their own they know
 * only their own cover ids: the work's cover (the search result's `cover_i`)
 * is added, then the other editions' covers (in `siblings` order, the
 * picker's ranking, so same-language art comes first) as a last resort
 * marked as another edition's art.
 */
export function enrichEdition(edition: BookCandidate, group: WorkGroup | null, siblings: readonly BookCandidate[] = []): BookCandidate {
  if (!group) return edition;
  const others = [group.work, ...group.members].filter((c) => c !== edition);
  const subjects = edition.subjects.length ? edition.subjects : [...new Set(others.flatMap((c) => c.subjects))];
  const hints = [...edition.seriesHints, ...others.flatMap((c) => c.seriesHints)];
  const refs = edition.coverRefs;
  const workCoverIds = refs.olWorkCoverIds.length ? refs.olWorkCoverIds : (others.find((c) => c.coverRefs.olWorkCoverIds.length)?.coverRefs.olWorkCoverIds ?? []);
  const known = new Set([...refs.olEditionCoverIds, ...workCoverIds]);
  const otherEditionCoverIds = [
    ...new Set(
      siblings
        .filter((s) => s !== edition && s.sourceId !== edition.sourceId)
        .map(firstCoverId)
        .filter((id): id is number => id !== undefined && !known.has(id)),
    ),
  ];
  return {
    ...edition,
    subjects,
    seriesHints: hints.filter((h, i) => hints.findIndex((x) => x.name === h.name && x.position === h.position) === i),
    summary: edition.summary ?? others.find((c) => c.summary)?.summary ?? null,
    workKey: edition.workKey ?? group.work.workKey,
    authors: edition.authors.length ? edition.authors : group.work.authors,
    // What "Review before saving" shows on the card: the work's cover when the edition has none.
    coverUrl: edition.coverUrl ?? coverUrlFromId(workCoverIds[0]),
    coverRefs: {
      ...refs,
      olWorkCoverIds: workCoverIds,
      olOtherEditionCoverIds: refs.olOtherEditionCoverIds?.length ? refs.olOtherEditionCoverIds : otherEditionCoverIds,
    },
  };
}
