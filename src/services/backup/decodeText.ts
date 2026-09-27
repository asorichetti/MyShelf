/**
 * The text of a file the user picked, whatever it was saved as. Spreadsheet
 * apps do not all write UTF-8: Excel on Windows saves "CSV" in the
 * Windows-1252 code page and "Unicode Text" in UTF-16. Reading those as
 * UTF-8 turns every accent into "�" (or every other character into a NUL),
 * so the bytes are decoded by what they are:
 *
 * - a byte order mark says UTF-8, UTF-16LE or UTF-16BE;
 * - otherwise valid UTF-8 is UTF-8 (plain ASCII included);
 * - anything else is Windows-1252, which every byte sequence decodes as.
 *
 * Written out rather than left to `TextDecoder`, which not every JavaScript
 * engine the app runs on has for all of these encodings. A UTF-8 byte order
 * mark is kept (as U+FEFF), as the readers after this expect and strip it.
 */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return decodeUtf16(bytes, 2, true);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return decodeUtf16(bytes, 2, false);
  return decodeUtf8(bytes) ?? decodeWindows1252(bytes);
}

/** Code units are turned into a string this many at a time (below engines' argument limits). */
const CHUNK = 8192;

function fromCodeUnits(units: number[], out: string[]): void {
  out.push(String.fromCharCode(...units));
  units.length = 0;
}

function decodeUtf16(bytes: Uint8Array, start: number, littleEndian: boolean): string {
  const out: string[] = [];
  const units: number[] = [];
  for (let i = start; i + 1 < bytes.length; i += 2) {
    units.push(littleEndian ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1]);
    if (units.length >= CHUNK) fromCodeUnits(units, out);
  }
  fromCodeUnits(units, out);
  return out.join('');
}

/** Strict UTF-8 (no overlong forms, surrogates or code points past U+10FFFF); null when the bytes are not UTF-8. */
export function decodeUtf8(bytes: Uint8Array): string | null {
  const out: string[] = [];
  const units: number[] = [];
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    let cp: number;
    let extra: number;
    let min: number;
    if (b < 0x80) {
      cp = b;
      extra = 0;
      min = 0;
    } else if (b >= 0xc2 && b <= 0xdf) {
      cp = b & 0x1f;
      extra = 1;
      min = 0x80;
    } else if (b >= 0xe0 && b <= 0xef) {
      cp = b & 0x0f;
      extra = 2;
      min = 0x800;
    } else if (b >= 0xf0 && b <= 0xf4) {
      cp = b & 0x07;
      extra = 3;
      min = 0x10000;
    } else {
      return null;
    }
    for (let k = 1; k <= extra; k++) {
      const c = bytes[i + k];
      if (c === undefined || (c & 0xc0) !== 0x80) return null;
      cp = (cp << 6) | (c & 0x3f);
    }
    if (cp < min || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return null;
    if (cp >= 0x10000) {
      const v = cp - 0x10000;
      units.push(0xd800 | (v >> 10), 0xdc00 | (v & 0x3ff));
    } else {
      units.push(cp);
    }
    if (units.length >= CHUNK) fromCodeUnits(units, out);
    i += extra + 1;
  }
  fromCodeUnits(units, out);
  return out.join('');
}

/** Windows-1252's 0x80-0x9F (where it differs from Latin-1); unassigned bytes keep their Latin-1 value. */
const CP1252_HIGH = [
  0x20ac, 0x81, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x8d, 0x017d, 0x8f,
  0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x9d, 0x017e, 0x0178,
];

function decodeWindows1252(bytes: Uint8Array): string {
  const out: string[] = [];
  const units: number[] = [];
  for (const b of bytes) {
    units.push(b >= 0x80 && b <= 0x9f ? CP1252_HIGH[b - 0x80] : b);
    if (units.length >= CHUNK) fromCodeUnits(units, out);
  }
  fromCodeUnits(units, out);
  return out.join('');
}
