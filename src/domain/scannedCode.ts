import { isbn10To13, isValidIsbn10, isValidIsbn13 } from './isbn';

/**
 * Barcode reads (P03-03). A book's barcode is an EAN-13 in the "Bookland"
 * ranges 978 and 979, and those 13 digits *are* its ISBN-13 (an ISBN-10 book
 * prints 978 + its first nine digits + a new check digit). Other symbologies
 * (EAN-8, UPC-A, UPC-E) and other EAN-13 prefixes are product codes: the app
 * only says "that's not a book's barcode".
 */

/** The symbologies the scanner listens for (expo-camera `BarcodeType` names). */
export const bookBarcodeTypes = ['ean13', 'ean8', 'upc_a'] as const;

export type ScannedCode =
  /** A book: the ISBN-13 to look up. */
  | { kind: 'isbn'; isbn13: string }
  /** A valid product barcode that is not a book's (grocery EAN, UPC). */
  | { kind: 'product'; data: string }
  /** Unreadable or a failed checksum: keep scanning silently. */
  | { kind: 'invalid'; data: string };

function eanCheckDigitValid(digits: string): boolean {
  let sum = 0;
  const n = digits.length;
  for (let i = 0; i < n - 1; i++) {
    // Weights run 3,1,3,1… from the digit next to the check digit.
    const fromRight = n - 1 - i;
    sum += Number(digits[i]) * (fromRight % 2 === 1 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === Number(digits[n - 1]);
}

/**
 * Classifies one barcode read. `type` is the symbology the camera reported
 * (lower-case expo-camera names, or Android's `EAN_13`-style names); `data`
 * is the decoded text. Surrounding spaces and hyphens are ignored.
 */
export function parseScannedCode(read: { type?: string | null; data: string }): ScannedCode {
  const data = (read.data ?? '').trim();
  const digits = data.replace(/[\s-]/g, '');
  const type = (read.type ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!/^\d+$/.test(digits)) {
    // A typed or OCR'd ISBN-10 can end in X; a barcode never does.
    if (/^\d{9}[\dXx]$/.test(digits) && isValidIsbn10(digits)) return { kind: 'isbn', isbn13: isbn10To13(digits)! };
    return { kind: 'invalid', data };
  }

  // "ean13", Android's "EAN_13", iOS's "org.gs1.EAN-13" all end the same way once cleaned.
  if (digits.length === 13 && (type === '' || type.endsWith('ean13'))) {
    if (!eanCheckDigitValid(digits)) return { kind: 'invalid', data };
    return /^97[89]/.test(digits) && isValidIsbn13(digits) ? { kind: 'isbn', isbn13: digits } : { kind: 'product', data: digits };
  }
  if (digits.length === 13) {
    // A 13-digit read reported as another symbology: trust the digits.
    if (/^97[89]/.test(digits) && isValidIsbn13(digits)) return { kind: 'isbn', isbn13: digits };
    return eanCheckDigitValid(digits) ? { kind: 'product', data: digits } : { kind: 'invalid', data };
  }
  if (digits.length === 10 && isValidIsbn10(digits)) return { kind: 'isbn', isbn13: isbn10To13(digits)! };
  // UPC-A (12 digits) and EAN-8 (8 digits) are product codes when their check digit holds.
  if ((digits.length === 12 || digits.length === 8) && eanCheckDigitValid(digits)) return { kind: 'product', data: digits };
  // UPC-E (6-8 digits, compressed) cannot be checked cheaply; it is never a book.
  if (type === 'upce' && digits.length >= 6 && digits.length <= 8) return { kind: 'product', data: digits };
  return { kind: 'invalid', data };
}

/**
 * Drops repeat reads of the same code within `windowMs` (the camera reports
 * a barcode many times a second while it stays in view). Pure: pass the
 * previous accepted read and the time.
 */
export function isRepeatRead(
  previous: { data: string; at: number } | null,
  data: string,
  now: number,
  windowMs = 3000,
): boolean {
  return previous !== null && previous.data === data && now - previous.at < windowMs;
}
