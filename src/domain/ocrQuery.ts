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
  /** 0–1, when the recogniser reports one. */
  confidence?: number;
  /** The language the recogniser read the line as (BCP-47, "und" when unsure), when it reports one. */
  language?: string;
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
  // A subtitle that says what kind of book it is: "A Memoir of Surviving Abuse", "A Novel of the Sea".
  /^(a|an|the)\s+(memoir|novel|biography|autobiography|true story|history|life|guide|thriller|romance)\b/i,
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

/**
 * Collapses whitespace and drops what OCR picks up around the words: stray
 * symbols at either end ("~ PROBLEMATIC") and tokens with no letters or
 * digits ("PRACTICAL + MAGIC", where "+" was an ampersand's flourish). A lone
 * "&" between names stays.
 */
export function cleanOcrLine(text: string): string {
  const tokens = text
    .replace(/[‘’]/g, "'")
    .split(/\s+/)
    .filter((t) => t === '&' || /[\p{L}\p{N}]/u.test(t));
  while (tokens[0] === '&') tokens.shift();
  while (tokens[tokens.length - 1] === '&') tokens.pop();
  return tokens
    .join(' ')
    .replace(/^[^\p{L}\p{N}"“'‘]+|[\s\-–—•·*_|:;,'"“”~+=^<>\\/]+$/gu, '')
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

/** A word that could be part of a person's name: capitalised (or ALL CAPS), an initial or a particle; never a possessive. */
function isNameWord(w: string): boolean {
  if (TITLE_WORDS.has(w.toLowerCase())) return false;
  if (/['’]s$/i.test(w)) return false; // "NOBODY'S" is a title word
  // ALL-CAPS covers: "TERRY PRATCHETT" is as name-like as "Terry Pratchett".
  return NAME_WORD.test(w) || NAME_WORD.test(w.charAt(0) + w.slice(1).toLowerCase());
}

function isOneName(part: string): boolean {
  const words = part.split(' ').filter(Boolean);
  return words.length >= 2 && words.length <= 4 && words.every(isNameWord);
}

/**
 * The people a line names, if it reads like a byline: 2–4 capitalised words
 * (initials and particles allowed, no digits, no title words like "The" or
 * "Of", no possessives), or several such names joined by "&" or "and".
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

/** One line of text on the cover, or several lines read as one (a name split over two lines). */
interface Unit {
  text: string;
  /** The tallest line's height: the size the text is set in. */
  height: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

function linesOf(result: OcrResult): Unit[] {
  const out: Unit[] = [];
  for (const block of result.blocks ?? []) {
    const lines = block.lines?.length ? block.lines : [{ text: block.text, frame: block.frame }];
    for (const l of lines) {
      const text = cleanOcrLine(l.text ?? '');
      if (!text || !l.frame) continue;
      const f = l.frame;
      out.push({ text, height: f.height, top: f.y, bottom: f.y + f.height, left: f.x, right: f.x + f.width });
    }
  }
  return out.sort((a, b) => a.top - b.top || a.left - b.left);
}

/** Every word could belong to a name ("ALICE", "Virginia Roberts", "&"). */
const nameish = (u: Unit) => {
  const words = u.text.split(' ');
  return words.length <= 3 && words.every((w) => w === '&' || isNameWord(w)) && !/\d/.test(u.text);
};

/**
 * Joins a name set over two or three stacked lines ("ALICE" / "HOFFMAN",
 * "Virginia Roberts" / "Giuffre"): adjacent lines of about the same size,
 * centred on each other, every word name-like, and together a name.
 */
function joinSplitNames(units: Unit[]): Unit[] {
  const out: Unit[] = [];
  for (const u of units) {
    const prev = out[out.length - 1];
    if (prev && nameish(prev) && nameish(u)) {
      const big = Math.max(prev.height, u.height);
      const similar = Math.min(prev.height, u.height) >= big * 0.75;
      const stacked = u.top - prev.bottom <= big * 1.2 && u.top >= prev.top + Math.min(prev.height, u.height) * 0.5;
      const width = Math.max(prev.right - prev.left, u.right - u.left);
      const centred = Math.abs((prev.left + prev.right) / 2 - (u.left + u.right) / 2) <= width * 0.25;
      const joined = `${prev.text} ${u.text}`;
      if (similar && stacked && centred && joined.split(' ').length <= 5 && isNameLike(joined)) {
        out[out.length - 1] = {
          text: joined,
          height: big,
          top: Math.min(prev.top, u.top),
          bottom: Math.max(prev.bottom, u.bottom),
          left: Math.min(prev.left, u.left),
          right: Math.max(prev.right, u.right),
        };
        continue;
      }
    }
    out.push(u);
  }
  return out;
}

/**
 * Up to three searches for a photographed cover, most likely first:
 * `{ title, author }`, `{ title }`, then `{ text }` (title and author as
 * free text). Empty when nothing on the cover looks like a title.
 *
 * The byline is found first: names split over stacked lines are joined; of
 * several name-like texts the smallest is the byline (a title such as
 * "PRACTICAL MAGIC" can look like a name, but is set larger); a lone
 * name-like text that dwarfs everything else is the title, not an author.
 * The title is then the largest remaining text, preferring the top of the
 * cover, with neighbours set nearly as large (a title over two lines).
 */
export function buildQueriesFromOcr(result: OcrResult): OcrQuery[] {
  const all = linesOf(result);
  if (!all.length) return [];
  const imageTop = Math.min(...all.map((l) => l.top));
  const imageBottom = Math.max(...all.map((l) => l.bottom));
  const span = Math.max(1, imageBottom - imageTop);
  const units = joinSplitNames(all.filter((l) => !isNoiseLine(l.text)));
  if (!units.length) return [];

  const largest = Math.max(...units.map((u) => u.height));
  // "MURDER ON THE / ORIENT EXPRESS": a name-like line set in the same size right against a title line continues the title.
  const stackedWith = (u: Unit, v: Unit) => {
    const big = Math.max(u.height, v.height);
    const width = Math.max(u.right - u.left, v.right - v.left);
    return (
      Math.min(u.height, v.height) >= big * 0.75 &&
      Math.min(Math.abs(u.top - v.bottom), Math.abs(v.top - u.bottom)) <= big * 1.2 &&
      Math.abs((u.left + u.right) / 2 - (v.left + v.right) / 2) <= width * 0.35
    );
  };
  const names = units.filter((u) => isNameLike(u.text) && !units.some((v) => v !== u && !isNameLike(v.text) && stackedWith(u, v)));
  const dominant = (u: Unit) => u.height === largest && !units.some((o) => o !== u && o.height >= largest * 0.5);
  const edgeDistance = (u: Unit) => Math.min(u.top - imageTop, imageBottom - u.bottom) / span; // 0 at an edge
  const byline =
    names.length === 1 && dominant(names[0])
      ? undefined
      : [...names].sort((a, b) => {
          const size = a.height - b.height;
          return Math.abs(size) > Math.max(a.height, b.height) * 0.1 ? size : edgeDistance(a) - edgeDistance(b);
        })[0];
  const author = byline ? queryText([namesInLine(byline.text)[0]]) : '';

  const rest = units.filter((u) => u !== byline);
  if (!rest.length) return author ? [{ text: author }] : [];
  // The title: the largest text, preferring the upper part of the cover when something there is nearly as large.
  const upper = imageTop + span * 0.6;
  const biggest = Math.max(...rest.map((u) => u.height));
  const anchor =
    [...rest].filter((u) => u.top < upper && u.height >= biggest * 0.8).sort((a, b) => b.height - a.height || a.top - b.top)[0] ??
    [...rest].sort((a, b) => b.height - a.height || a.top - b.top)[0];
  const titleUnits = [anchor];
  const bySize = [...rest].sort((a, b) => b.height - a.height || a.top - b.top);
  for (const u of bySize) {
    if (titleUnits.length >= 3 || u === anchor) continue;
    const bigEnough = u.height >= anchor.height * 0.7;
    const near = titleUnits.some((t) => Math.abs(u.top - t.bottom) <= anchor.height * 1.5 || Math.abs(t.top - u.bottom) <= anchor.height * 1.5);
    if (bigEnough && near) titleUnits.push(u);
  }
  titleUnits.sort((a, b) => a.top - b.top || a.left - b.left);
  const title = queryText(titleUnits.map((u) => u.text));

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
