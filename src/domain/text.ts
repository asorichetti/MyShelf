/** Text normalisation for matching titles, authors and series names across providers. */

/** Letters that Unicode decomposition does not split into base + accent. */
const FOLD: Record<string, string> = { ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', ł: 'l', đ: 'd', ð: 'd', þ: 'th', ı: 'i' };

/** Leading articles dropped for matching (English, French, Spanish, Italian, German, Dutch). */
const LEADING_ARTICLE = /^(?:the|a|an|le|la|les|el|los|las|il|lo|gli|un|une|una|uno|der|die|das|ein|eine|het)\s+(?=\S)/;

/** "Éric" → "Eric", "Łódź" → "Lodz". */
export function stripDiacritics(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ßæœøłđðþı]/gi, (c) => {
      const lower = FOLD[c.toLowerCase()];
      return c === c.toLowerCase() ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    });
}

/**
 * A matching key: lower case, no diacritics, `&` as "and", apostrophes
 * dropped, other punctuation as spaces, whitespace collapsed, and a leading
 * article removed ("The Colour of Magic" → "colour of magic").
 */
export function normaliseText(text: string, { dropArticle = true }: { dropArticle?: boolean } = {}): string {
  let s = stripDiacritics(text).toLowerCase();
  s = s.replace(/^l['’]\s*/, '');
  s = s.replace(/&/g, ' and ');
  s = s.replace(/['’`]/g, '');
  s = s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (dropArticle) s = s.replace(LEADING_ARTICLE, '');
  return s;
}

/** Title key: the main title (before a `:` subtitle), normalised. */
export function titleKey(title: string): string {
  const main = title.split(/\s*:\s+|\s+[-–—]\s+/)[0] || title;
  return normaliseText(main);
}

/**
 * Author key: the normalised surname, so "J.R.R. Tolkien", "J. R. R.
 * Tolkien" and "Tolkien, J. R. R." all match. Inverted names ("Last,
 * First") are recognised by the comma.
 */
export function authorKey(name: string): string {
  const trimmed = name.trim();
  const comma = trimmed.indexOf(',');
  const surname = comma > 0 ? trimmed.slice(0, comma) : trimmed;
  const words = normaliseText(surname, { dropArticle: false }).split(' ').filter(Boolean);
  if (!words.length) return '';
  return comma > 0 ? words.join(' ') : words[words.length - 1];
}

/** True when two author names are probably the same person (same surname key). */
export function sameAuthor(a: string, b: string): boolean {
  const ka = authorKey(a);
  const kb = authorKey(b);
  if (!ka || !kb) return false;
  // Inverted names keep a multi-word surname ("garcia marquez"); compare last words too.
  return ka === kb || ka.split(' ').pop() === kb.split(' ').pop();
}

/** De-duplication key for a book: title key + first author's surname. */
export function bookMatchKey(title: string, firstAuthor: string | null | undefined): string {
  return `${titleKey(title)}|${firstAuthor ? authorKey(firstAuthor).split(' ').pop() : ''}`;
}
