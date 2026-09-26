import { allMessages, hasMessage, placeholdersOf, t, translate, type MessageKey } from '@/i18n';

/** Values for a tip's `{placeholders}`. */
export type TipVars = Readonly<Record<string, string | number>>;

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

/**
 * A catalogue message in the active language with its `{placeholders}`
 * left in, ready for `formatTip` (a tip's text, before the event's values).
 */
export function messageTemplate(key: MessageKey): string {
  const message = allMessages().get(key);
  const names = typeof message === 'string' ? placeholdersOf(message) : [];
  return translate(key, Object.fromEntries(names.map((name) => [name, `{${name}}`])));
}

/**
 * An object whose fields read their words from the catalogue each time
 * they are read, never at import: a catalogue switched later (or the test's
 * pseudo-locale) applies. Placeholders stay in (see `messageTemplate`).
 */
export function catalogueWords<K extends string>(keys: Readonly<Record<K, MessageKey>>): Readonly<Record<K, string>> {
  const words = {} as Record<K, string>;
  for (const [field, key] of Object.entries(keys) as [K, MessageKey][]) {
    Object.defineProperty(words, field, { get: () => messageTemplate(key), enumerable: true });
  }
  return words;
}

/** The placeholder names in a tip's text (or a catalogue key's message), in order of appearance, without repeats. */
export function placeholders(text: string): string[] {
  return placeholdersOf(hasMessage(text) ? messageTemplate(text) : text);
}

/**
 * Fills a tip's `{placeholders}` from `vars`; `text` may also be a catalogue
 * key. A missing value becomes an empty string (and a warning), so a
 * caller's slip never shows "{title}" to the user; the catalogue test
 * checks every placeholder has sample data.
 */
export function formatTip(text: string, vars: TipVars = {}): string {
  const template = hasMessage(text) ? messageTemplate(text) : text;
  return template
    .replace(PLACEHOLDER, (_, name: string) => {
      const value = vars[name];
      if (value == null) {
        console.warn(`Booky: no value for {${name}} in "${template}"`);
        return '';
      }
      return String(value);
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** "1 book", "12 books": the phrase most tips count with. */
export const bookCount = (n: number) => t('common.books', { count: n });
