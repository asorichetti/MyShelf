import { isValidIsbn13, normalizeIsbn } from './isbn';

/**
 * Registrant (publisher) ranges for the English-language groups 978-0 and
 * 978-1, from the International ISBN Agency's range table: a range's lower
 * bound, as a 7-digit prefix, and the registrant length it implies.
 */
const RANGES: Record<string, [number, number][]> = {
  '9780': [
    [0, 2],
    [2000000, 3],
    [7000000, 4],
    [8500000, 5],
    [9000000, 6],
    [9500000, 7],
  ],
  '9781': [
    [0, 2],
    [1000000, 3],
    [4000000, 4],
    [5500000, 5],
    [8698000, 6],
    [9990000, 7],
  ],
};

/**
 * An ISBN-13 with hyphens, as printed above a barcode: "978-0-552-16659-1".
 * The English-language groups (978-0, 978-1) are split exactly; other
 * groups, whose ranges vary, are shown as "978-2070612758" rather than
 * guessed. Anything that is not a valid ISBN-13 comes back unchanged.
 */
export function formatIsbn13(raw: string): string {
  const isbn = normalizeIsbn(raw);
  if (!isbn || !isValidIsbn13(isbn)) return raw;
  const ranges = RANGES[isbn.slice(0, 4)];
  if (!ranges) return `${isbn.slice(0, 3)}-${isbn.slice(3)}`;
  const seven = Number(isbn.slice(4, 11));
  let length = 2;
  for (const [lower, len] of ranges) if (seven >= lower) length = len;
  const registrant = isbn.slice(4, 4 + length);
  const publication = isbn.slice(4 + length, 12);
  return `${isbn.slice(0, 3)}-${isbn[3]}-${registrant}-${publication}-${isbn[12]}`;
}
