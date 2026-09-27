/**
 * CSV reading and writing (RFC 4180) for the spreadsheet export and import
 * (P08-04, P08-05): quoted fields with doubled quotes, commas and line
 * breaks inside quotes, CRLF or LF line endings, a UTF-8 byte order mark,
 * and comma, semicolon or tab delimiters (spreadsheet apps in many
 * countries save with semicolons).
 */

export type CsvDelimiter = ',' | ';' | '\t';
export const CSV_DELIMITERS: readonly CsvDelimiter[] = [',', ';', '\t'];

const BOM = '﻿';

/** Drops a UTF-8 byte order mark. */
export function stripBom(text: string): string {
  return text.startsWith(BOM) ? text.slice(1) : text;
}

/**
 * The delimiter of the header line: whichever of comma, semicolon and tab
 * appears most often outside quotes (comma on a tie or when none does).
 */
export function detectDelimiter(text: string): CsvDelimiter {
  const counts = new Map<CsvDelimiter, number>(CSV_DELIMITERS.map((d) => [d, 0]));
  let quoted = false;
  for (const ch of stripBom(text)) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === '\n' || ch === '\r')) break;
    else if (!quoted && counts.has(ch as CsvDelimiter)) counts.set(ch as CsvDelimiter, counts.get(ch as CsvDelimiter)! + 1);
  }
  let best: CsvDelimiter = ',';
  for (const d of CSV_DELIMITERS) if (counts.get(d)! > counts.get(best)!) best = d;
  return best;
}

export class CsvParseError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
    this.name = 'CsvParseError';
  }
}

/**
 * Parses CSV text into rows of fields. A field is quoted when it starts with
 * a quote; inside, `""` is a quote and line breaks are kept. Completely
 * empty lines are skipped. Throws `CsvParseError` for a quote that never
 * closes (a cut-off file).
 */
export function parseCsv(text: string, delimiter: CsvDelimiter = detectDelimiter(text)): string[][] {
  const src = stripBom(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let line = 1;
  let quotedField = false;
  let fieldStartLine = 1;

  const endField = () => {
    row.push(field);
    field = '';
    quotedField = false;
  };
  const endRow = () => {
    endField();
    if (!(row.length === 1 && row[0] === '' )) rows.push(row);
    row = [];
  };

  while (i < src.length) {
    const ch = src[i];
    if (field === '' && !quotedField && ch === '"') {
      // A quoted field: read to the closing quote.
      quotedField = true;
      fieldStartLine = line;
      i++;
      let closed = false;
      while (i < src.length) {
        const c = src[i];
        if (c === '"') {
          if (src[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          i++;
          closed = true;
          break;
        }
        if (c === '\n') line++;
        field += c;
        i++;
      }
      if (!closed) throw new CsvParseError(`A quoted field starting on line ${fieldStartLine} never ends`, fieldStartLine);
      // Anything between the closing quote and the delimiter is kept (lenient, like spreadsheet apps).
      continue;
    }
    if (ch === delimiter) {
      endField();
      i++;
    } else if (ch === '\r' || ch === '\n') {
      endRow();
      i += ch === '\r' && src[i + 1] === '\n' ? 2 : 1;
      line++;
    } else {
      field += ch;
      i++;
    }
  }
  if (field !== '' || quotedField || row.length) endRow();
  return rows;
}

const NEEDS_QUOTES = /[",\r\n;\t]|^\s|\s$/;

/**
 * Text a spreadsheet app would run as a formula ("=HYPERLINK(…)", "+1",
 * "-2", "@SUM(…)", or one of those after a tab or line break it trims).
 */
const FORMULA_START = /^[=+\-@\t\r]/;

/** Starts like a formula once any leading apostrophes are set aside, so text that already began with "'=" survives a round trip too. */
const formulaLike = (text: string) => FORMULA_START.test(text.replace(/^'+/, ''));

/**
 * Text that opens a spreadsheet as a formula gets a leading apostrophe, the
 * usual guard against CSV injection: Excel, Numbers and LibreOffice show the
 * text as typed instead of running it. `unescapeFormula` takes it off again
 * when MyShelf reads the file back.
 */
export function escapeFormula(text: string): string {
  return formulaLike(text) ? `'${text}` : text;
}

/** Undoes `escapeFormula`: one apostrophe in front of a formula-like start is dropped. */
export function unescapeFormula(text: string): string {
  return text.startsWith("'") && formulaLike(text) ? text.slice(1) : text;
}

/**
 * One field, quoted when it holds a delimiter, a quote, a line break or edge
 * spaces. Text that a spreadsheet would run as a formula is neutralised
 * (`escapeFormula`); numbers are written as they are.
 */
export function csvField(value: string | number | null | undefined): string {
  if (value == null) return '';
  const s = typeof value === 'number' ? String(value) : escapeFormula(value);
  return NEEDS_QUOTES.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Rows as CSV text with CRLF line endings, as RFC 4180 asks. With `bom`, the
 * text starts with a UTF-8 byte order mark so Excel reads accents right.
 */
export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[], { bom = false }: { bom?: boolean } = {}): string {
  return (bom ? BOM : '') + rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}
