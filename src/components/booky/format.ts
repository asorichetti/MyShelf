/** Values for a tip's `{placeholders}`. */
export type TipVars = Readonly<Record<string, string | number>>;

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

/** The placeholder names in a tip's text, in order of appearance, without repeats. */
export function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]))];
}

/**
 * Fills a tip's `{placeholders}` from `vars`. A missing value becomes an
 * empty string (and a warning), so a caller's slip never shows "{title}" to
 * the user; the catalogue test checks every placeholder has sample data.
 */
export function formatTip(text: string, vars: TipVars = {}): string {
  return text
    .replace(PLACEHOLDER, (_, name: string) => {
      const value = vars[name];
      if (value == null) {
        console.warn(`Booky: no value for {${name}} in "${text}"`);
        return '';
      }
      return String(value);
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** "1 book", "12 books": the phrase most tips count with. */
export const bookCount = (n: number) => (n === 1 ? '1 book' : `${n} books`);
