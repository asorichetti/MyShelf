/**
 * OCR text → search queries (P03-06). The input is what on-device text
 * recognition returns for a photo of a cover: blocks of lines, each with a
 * bounding box. Larger text is usually the title; short capitalised lines
 * near the top or bottom edge are usually the author; the rest (blurbs,
 * prices, "A NOVEL", "Winner of…") is noise. Pure and deterministic.
 */

export interface OcrFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrLine {
  text: string;
  frame: OcrFrame;
}

export interface OcrBlock {
  text: string;
  frame: OcrFrame;
  lines: OcrLine[];
}

/** What a text recogniser returns for one image (the shape `src/services/recognition` produces). */
export interface OcrResult {
  blocks: OcrBlock[];
}

/** A search to try; the same shape as the metadata service's `SearchQuery`. */
export interface OcrQuery {
  title?: string;
  author?: string;
  text?: string;
}

/** Cover furniture that is never the title or the author. Matched against the cleaned line. */
const NOISE: RegExp[] = [
  /^(a|an|the)?\s*(novel|romance|thriller|memoir|mystery|story|stories|tale)$/i,
  /^(a|an)\s+.+\s+(novel|mystery|thriller|romance|story|adventure)$/i,
  /\bbest-?sell/i,
  /\bwinner\b|\bwinning\b|\bprize\b|\baward\b|\bshortlisted\b|\blonglisted\b/i,
  /\b(introduction|foreword|afterword|preface|translated|illustrated|edited|read|narrated)\s+by\b/i,
  /\bauthor of\b|\bfrom the author\b|\bby the author\b/i,
  /\bnow a (major )?(motion picture|film|tv|netflix|series)/i,
  /\bmillion copies\b|\bcopies sold\b|\bover \d/i,
  /\b(new york|sunday|the) times\b|\bguardian\b|\bobserver\b|\bindependent\b|\btelegraph\b|\bkirkus\b|\bpublishers weekly\b/i,
  /[£$€]\s*\d|\d+[.,]\d\d\s*(€|eur|usd|gbp)?$/i,
  /www\.|https?:|\.(com|co\.uk|org|net)\b|@/i,
  /\b(isbn|edition|paperback|hardcover|hardback|unabridged|abridged|reissue|classics?)\b/i,
  /^(the )?(international|global|instant|#\s*1|number one|no\.?\s*1)\b/i,
  /^(vintage|penguin|picador|corgi|orbit|gollancz|harper|harpercollins|bloomsbury|tor|ace|puffin|pan|faber|random house|ballantine|debolsillo|folio|folio junior|del rey|signet|bantam|scholastic)(\s+(books?|classics|publishers))?$/i,
];

/** Series furniture ("Book One", "Discworld 5"): kept out of the title and author. */
const SERIES_LINE = /^(book|volume|vol\.?|part)\s+([ivxlc]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten)$/i;

const letters = (s: string) => s.replace(/[^\p{L}]/gu, '');

/** Collapses whitespace and trims stray punctuation OCR picks up around a line. */
export function cleanOcrLine(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—•·*_|:;,.'"“”]+|[\s\-–—•·*_|:;,'"“”]+$/g, '')
    .trim();
}

/** True for cover furniture: blurbs, prices, prizes, imprints, "A NOVEL". */
export function isNoiseLine(text: string): boolean {
  const t = cleanOcrLine(text);
  if (letters(t).length < 2) return true;
  if (SERIES_LINE.test(t)) return true;
  if (NOISE.some((re) => re.test(t))) return true;
  // A quoted endorsement or a sentence of blurb: long, and mostly lower-case words.
  if (/^["“'‘]/.test(text.trim())) return true;
  const words = t.split(' ');
  const lower = words.filter((w) => /^[a-z]/.test(w)).length;
  if (words.length >= 7 && lower / words.length > 0.5) return true;
  return false;
}

const NAME_WORD = /^(?:\p{Lu}[\p{L}'’-]*\.?|\p{Lu}\.(?:\p{Lu}\.)*|(?:de|van|von|der|le|la|du|da|di|del|mc|mac)|jr\.?|sr\.?)$/u;

/** Words that start titles but never names ("THE COLOUR", "OF MAGIC"). */
const TITLE_WORDS = new Set(['the', 'of', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'or', 'is', 'it', 'as', 'my', 'his', 'her', 'our', 'your', 'their', 'into', 'over', 'under']);

function isOneName(part: string): boolean {
  const words = part.split(' ').filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  if (words.some((w) => TITLE_WORDS.has(w.toLowerCase()))) return false;
  // ALL-CAPS covers: "TERRY PRATCHETT" is as name-like as "Terry Pratchett".
  return words.every((w) => NAME_WORD.test(w) || NAME_WORD.test(w.charAt(0) + w.slice(1).toLowerCase()));
}

/**
 * The people a line names, if it reads like a byline: 2–4 capitalised words
 * (initials and particles allowed, no digits, no title words like "The" or
 * "Of"), or several such names joined by "&" or "and".
 */
export function namesInLine(text: string): string[] {
  const t = cleanOcrLine(text).replace(/^by\s+/i, '');
  if (!t || /\d/.test(t)) return [];
  const parts = t.split(/\s+(?:&|and|AND)\s+|\s*&\s*/).map((p) => p.trim());
  return parts.every(isOneName) ? parts : [];
}

/** A line that reads like a byline (see `namesInLine`). */
export function isNameLike(text: string): boolean {
  return namesInLine(text).length > 0;
}

/** "THE COLOUR OF MAGIC" → "the colour of magic": queries go out lower-cased, like typed searches. */
function queryText(parts: string[]): string {
  return parts
    .map((p) => cleanOcrLine(p))
    .filter(Boolean)
    .join(' ')
    .replace(/^by\s+/i, '')
    .toLowerCase();
}

interface Line {
  text: string;
  height: number;
  top: number;
  bottom: number;
  left: number;
}

function linesOf(result: OcrResult): Line[] {
  const out: Line[] = [];
  for (const block of result.blocks ?? []) {
    const lines = block.lines?.length ? block.lines : [{ text: block.text, frame: block.frame }];
    for (const l of lines) {
      const text = cleanOcrLine(l.text ?? '');
      if (!text || !l.frame) continue;
      out.push({ text, height: l.frame.height, top: l.frame.y, bottom: l.frame.y + l.frame.height, left: l.frame.x });
    }
  }
  return out;
}

/**
 * Up to three searches for a photographed cover, most likely first:
 * `{ title, author }`, `{ title }`, then `{ text }` (title and author as
 * free text). Empty when nothing on the cover looks like a title.
 */
export function buildQueriesFromOcr(result: OcrResult): OcrQuery[] {
  const all = linesOf(result);
  if (!all.length) return [];
  const imageTop = Math.min(...all.map((l) => l.top));
  const imageBottom = Math.max(...all.map((l) => l.bottom));
  const span = Math.max(1, imageBottom - imageTop);
  const lines = all.filter((l) => !isNoiseLine(l.text));
  if (!lines.length) return [];

  // Author first: a byline near the top or bottom edge. The largest line on
  // the cover is only a byline when something else is at least half its
  // size (an author set bigger than the title); otherwise it is the title.
  const largest = Math.max(...lines.map((l) => l.height));
  const secondLargest = Math.max(0, ...lines.filter((l) => l.height < largest).map((l) => l.height));
  const bylines = lines.filter((l) => isNameLike(l.text) && (l.height < largest || secondLargest >= largest * 0.5));
  const edgeDistance = (l: Line) => Math.min(l.top - imageTop, imageBottom - l.bottom) / span; // 0 at an edge
  // Nearest an edge wins; when two are about as near (title on top, author at the foot), the smaller one is the byline.
  const authorLine = [...bylines].sort((a, b) => {
    const d = edgeDistance(a) - edgeDistance(b);
    return Math.abs(d) > 0.05 ? d : a.height - b.height;
  })[0];
  const author = authorLine ? queryText([namesInLine(authorLine.text)[0]]) : '';

  // Title: the largest remaining line, plus neighbours set nearly as large (a title split across lines).
  const rest = lines.filter((l) => l !== authorLine);
  if (!rest.length) return author ? [{ text: author }] : [];
  const bySize = [...rest].sort((a, b) => b.height - a.height || a.top - b.top);
  const anchor = bySize[0];
  const titleLines = [anchor];
  for (const l of bySize) {
    if (titleLines.length >= 3 || l === anchor) continue;
    const bigEnough = l.height >= anchor.height * 0.7;
    const near = titleLines.some((t) => Math.abs(l.top - t.bottom) <= anchor.height * 1.5 || Math.abs(t.top - l.bottom) <= anchor.height * 1.5);
    if (bigEnough && near) titleLines.push(l);
  }
  titleLines.sort((a, b) => a.top - b.top || a.left - b.left);
  const title = queryText(titleLines.map((l) => l.text));

  const out: OcrQuery[] = [];
  const push = (q: OcrQuery) => {
    const key = JSON.stringify(q);
    if (!out.some((o) => JSON.stringify(o) === key)) out.push(q);
  };
  if (title && author) push({ title, author });
  if (title) push({ title });
  const text = [title, author].filter(Boolean).join(' ');
  if (text) push({ text });
  return out.slice(0, 3);
}

/**
 * The web test harness's "Type the cover text" (P03-07): one typed line is
 * searched as free text; several lines are read like a cover, top line
 * largest, and end with the free-text search of everything typed.
 */
export function queriesFromTypedText(input: string): OcrQuery[] {
  const lines = input
    .split(/\r?\n/)
    .map(cleanOcrLine)
    .filter(Boolean);
  if (!lines.length) return [];
  const all = queryText(lines);
  if (lines.length === 1) return [{ text: all }];
  const lineHeight = (i: number) => (i === 0 ? 60 : 30);
  const result: OcrResult = {
    blocks: lines.map((text, i) => {
      const frame = { x: 0, y: i * 80, width: 600, height: lineHeight(i) };
      return { text, frame, lines: [{ text, frame }] };
    }),
  };
  const queries = buildQueriesFromOcr(result);
  if (!queries.some((q) => q.text === all)) queries.push({ text: all });
  return queries.slice(0, 3);
}
