import { normaliseText } from './text';

/** Levenshtein distance, for short strings (titles). */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

/**
 * How alike two titles are, 0–1, forgiving what OCR gets wrong: case,
 * accents, punctuation and a leading article are ignored, and a misread
 * letter ("BROMANCE" for "ROMANCE") costs little. The better of a character
 * edit similarity and a word overlap (Dice) score, so a missing subtitle does
 * not sink an otherwise exact title either.
 */
export function titleSimilarity(a: string, b: string): number {
  const x = normaliseText(a);
  const y = normaliseText(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const edit = 1 - editDistance(x, y) / Math.max(x.length, y.length);
  const wx = new Set(x.split(' '));
  const wy = new Set(y.split(' '));
  const shared = [...wx].filter((w) => wy.has(w)).length;
  const dice = (2 * shared) / (wx.size + wy.size);
  // A title that starts with the other ("Dune" / "Dune Messiah") is a partial match at best.
  const prefix = y.startsWith(x) || x.startsWith(y) ? Math.min(x.length, y.length) / Math.max(x.length, y.length) : 0;
  return Math.max(edit, dice, prefix);
}

/**
 * The candidates whose title is closest to what the cover says, best first,
 * dropping those below `min`. Ties keep their original (search) order.
 */
export function closestByTitle<T extends { title: string }>(candidates: readonly T[], title: string, { min = 0.6 }: { min?: number } = {}): T[] {
  return candidates
    .map((c, i) => ({ c, i, score: titleSimilarity(c.title, title) }))
    .filter((s) => s.score >= min)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((s) => s.c);
}

/**
 * The title without the word OCR most likely misread: the last word (misreads
 * gather where the art crowds the lettering, and the recorded captures bear
 * that out). Null for titles too short to shorten usefully (under three words).
 */
export function withoutWeakestWord(title: string): string | null {
  const words = title.trim().split(/\s+/);
  return words.length >= 3 ? words.slice(0, -1).join(' ') : null;
}
