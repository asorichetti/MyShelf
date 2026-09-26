/** ISBN helpers. ISBNs are stored normalised: digits only, plus a trailing X for ISBN-10. */

/** Strips spaces, hyphens and other separators and upper-cases a trailing x. Returns null when nothing is left. */
export function normalizeIsbn(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const cleaned = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  return cleaned.length ? cleaned : null;
}

export function isValidIsbn10(raw: string): boolean {
  const isbn = normalizeIsbn(raw);
  if (!isbn || !/^\d{9}[\dX]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (isbn[i] === 'X' ? 10 : Number(isbn[i])) * (10 - i);
  return sum % 11 === 0;
}

function isbn13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

export function isValidIsbn13(raw: string): boolean {
  const isbn = normalizeIsbn(raw);
  if (!isbn || !/^97[89]\d{10}$/.test(isbn)) return false;
  return isbn13CheckDigit(isbn.slice(0, 12)) === Number(isbn[12]);
}

export function isValidIsbn(raw: string): boolean {
  return isValidIsbn13(raw) || isValidIsbn10(raw);
}

/** ISBN-10 -> ISBN-13 (978 prefix). Returns null for an invalid ISBN-10. */
export function isbn10To13(raw: string): string | null {
  if (!isValidIsbn10(raw)) return null;
  const core = `978${normalizeIsbn(raw)!.slice(0, 9)}`;
  return `${core}${isbn13CheckDigit(core)}`;
}

/** ISBN-13 -> ISBN-10. Only 978-prefixed ISBNs have an ISBN-10; returns null otherwise. */
export function isbn13To10(raw: string): string | null {
  if (!isValidIsbn13(raw)) return null;
  const isbn = normalizeIsbn(raw)!;
  if (!isbn.startsWith('978')) return null;
  const core = isbn.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(core[i]) * (10 - i);
  const check = (11 - (sum % 11)) % 11;
  return `${core}${check === 10 ? 'X' : check}`;
}
