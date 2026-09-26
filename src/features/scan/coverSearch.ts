import { closestByTitle, withoutWeakestWord, type OcrQuery } from '@/domain';
import type { BookCandidate, MetadataResult } from '@/services/metadata';

export type CoverSearchStep = 'title-author' | 'author' | 'shortened' | 'title' | 'text';

export interface CoverSearchResult {
  candidates: BookCandidate[];
  /** The query that found them (null when nothing did). */
  used: OcrQuery | null;
  step: CoverSearchStep | null;
  /** Every search sent, in order (at most `maxRequests`). */
  tried: OcrQuery[];
}

export interface CoverSearchOptions {
  signal?: AbortSignal;
  /** The most searches one cover may cost. Default 5. */
  maxRequests?: number;
}

const stepOf = (q: OcrQuery): CoverSearchStep => (q.title && q.author ? 'title-author' : q.title ? 'title' : 'text');

/**
 * Searches for a photographed cover (P03-06), tolerating OCR misreads, in at
 * most five requests:
 *
 * 1. title + author, as read;
 * 2. if that finds nothing, the author alone, keeping the books whose title is
 *    closest to the one read ("PROBLEMATIC SUMMER BROMANCE" still finds
 *    "Problematic Summer Romance");
 * 3. then the title without its likeliest misread word, with the author;
 * 4. then the remaining queries (title alone, then free text).
 *
 * Results are ordered by how close their title is to the cover's, so the
 * edition picker opens on the likeliest book.
 */
export async function searchCover(
  search: (query: OcrQuery, signal?: AbortSignal) => Promise<MetadataResult>,
  queries: readonly OcrQuery[],
  { signal, maxRequests = 5 }: CoverSearchOptions = {},
): Promise<CoverSearchResult> {
  const tried: OcrQuery[] = [];
  const run = async (q: OcrQuery) => {
    tried.push(q);
    return (await search(q, signal)).candidates;
  };
  const found = (candidates: BookCandidate[], used: OcrQuery, step: CoverSearchStep): CoverSearchResult => ({ candidates, used, step, tried });
  const byTitle = (candidates: BookCandidate[], title: string | undefined) => (title ? closestByTitle(candidates, title, { min: 0 }) : candidates);

  const [first, ...rest] = queries;
  if (!first) return { candidates: [], used: null, step: null, tried };
  const plan: { query: OcrQuery; step: CoverSearchStep; keep: (c: BookCandidate[]) => BookCandidate[] }[] = [];
  plan.push({ query: first, step: stepOf(first), keep: (c) => byTitle(c, first.title) });
  if (first.title && first.author) {
    const title = first.title;
    plan.push({ query: { author: first.author }, step: 'author', keep: (c) => closestByTitle(c, title, { min: 0.6 }) });
    const shorter = withoutWeakestWord(title);
    if (shorter) plan.push({ query: { title: shorter, author: first.author }, step: 'shortened', keep: (c) => closestByTitle(c, title, { min: 0.5 }) });
  }
  for (const q of rest) plan.push({ query: q, step: stepOf(q), keep: (c) => byTitle(c, first.title) });

  for (const { query, step, keep } of plan) {
    if (tried.length >= maxRequests || signal?.aborted) break;
    const candidates = keep(await run(query));
    if (candidates.length) return found(candidates, query, step);
  }
  return { candidates: [], used: null, step: null, tried };
}
