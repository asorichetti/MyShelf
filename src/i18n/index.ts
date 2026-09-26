import { en } from './en';

/**
 * MyShelf's words (P09-11). Every user-facing string lives in a catalogue
 * (`en.ts`, grouped by feature) and is looked up by key:
 *
 *   t('shelf.count', { count: 12 })   // "12 books catalogued"
 *   t('loans.lentTo', { name: 'Sam' }) // "Lent to Sam"
 *
 * Keys are type-checked (a missing key does not compile), and so are the
 * parameters: every `{placeholder}` in the English text must be passed, and
 * a plural message needs a `count`. A plural message is an object of
 * `Intl.PluralRules` categories (`one`, `other`, and `zero`/`two`/`few`/
 * `many` where a language needs them); `other` is required.
 *
 * Numbers in parameters are written with `Intl.NumberFormat` in the
 * catalogue's locale, without grouping ("2000 books", as designed). Never
 * call `t` at module scope: store the key and translate when rendering, so
 * a catalogue or the pseudo-locale set at start-up (or by a test) applies.
 *
 * How to add a language: `docs/localisation.md`.
 */

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/** A message that depends on a count: "1 book" / "{count} books". */
export type PluralMessage = { readonly other: string } & { readonly [C in Exclude<PluralCategory, 'other'>]?: string };

type English = typeof en;

type Join<P extends string, K extends string> = P extends '' ? K : `${P}.${K}`;

type KeysOf<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? Join<P, K> : T[K] extends { other: string } ? Join<P, K> : KeysOf<T[K], Join<P, K>>;
}[keyof T & string];

/** Every key in the catalogue, e.g. `'shelf.count'`. */
export type MessageKey = KeysOf<English>;

type At<T, K extends string> = K extends `${infer H}.${infer R}` ? (H extends keyof T ? At<T[H], R> : never) : K extends keyof T ? T[K] : never;

type Names<S> = S extends `${string}{${infer N}}${infer R}` ? N | Names<R> : never;

type NamesOf<V> = V extends string ? Names<V> : V extends { other: string } ? Names<V[keyof V]> : never;

/** A value for a `{placeholder}`. */
export type ParamValue = string | number;

/** The parameters a key's text needs; `{}` when it has none. */
export type ParamsOf<K extends MessageKey> =
  At<English, K> extends { other: string }
    ? { count: number } & { [N in Exclude<NamesOf<At<English, K>>, 'count'>]: ParamValue }
    : { [N in NamesOf<At<English, K>>]: ParamValue };

type ParamArgs<K extends MessageKey> = [keyof ParamsOf<K>] extends [never] ? [] : [params: ParamsOf<K>];

type Widen<T> = T extends string ? string : T extends { other: string } ? PluralMessage : { readonly [K in keyof T]: Widen<T[K]> };

/** The shape every language's catalogue has: the English one with any text. */
export type Catalogue = Widen<English>;

interface Active {
  catalogue: Catalogue;
  /** BCP 47 tag the catalogue is written in: plural rules and number formatting follow it. */
  locale: string;
  pseudo: boolean;
  flat: Map<string, string | PluralMessage>;
  plural: ((n: number) => PluralCategory) | null;
  number: ((n: number) => string) | null;
}

const isPlural = (v: unknown): v is PluralMessage => typeof v === 'object' && v != null && typeof (v as PluralMessage).other === 'string';

function flatten(tree: object, prefix = '', into = new Map<string, string | PluralMessage>()) {
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string' || isPlural(v)) into.set(key, v);
    else flatten(v as object, key, into);
  }
  return into;
}

function pluralRule(locale: string): Active['plural'] {
  try {
    const rules = new Intl.PluralRules(locale);
    return (n) => rules.select(n) as PluralCategory;
  } catch {
    // Intl.PluralRules is missing on some JavaScript engines: see `pluralCategory`.
    return null;
  }
}

function numberFormat(locale: string): Active['number'] {
  try {
    const format = new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 20 });
    return (n) => format.format(n);
  } catch {
    return null;
  }
}

function activate(catalogue: Catalogue, locale: string, pseudo: boolean): Active {
  return { catalogue, locale, pseudo, flat: flatten(catalogue), plural: pluralRule(locale), number: numberFormat(locale) };
}

let active: Active = activate(en, en.meta.locale, false);

/**
 * Switches every later `t` call to another catalogue (a language, or a test
 * double). Call it at start-up, before the first render: screens translate
 * as they render and do not re-render on a switch.
 */
export function setCatalogue(catalogue: Catalogue, locale: string = catalogue.meta.locale): void {
  active = activate(catalogue, locale, active.pseudo);
}

/** Back to English (tests reset with this). */
export function resetCatalogue(): void {
  active = activate(en, en.meta.locale, false);
}

/**
 * The pseudo-locale: every message comes back wrapped in "[[ ]]", so any
 * text on screen without the brackets was not translated (the strings test
 * renders key screens this way).
 */
export function setPseudoLocale(on: boolean): void {
  active = { ...active, pseudo: on };
}

/** The locale the active catalogue is written in, e.g. "en-GB". */
export function catalogueLocale(): string {
  return active.locale;
}

/**
 * The plural category of `n` in the catalogue's language. Engines without
 * `Intl.PluralRules` fall back to the English rule (one for exactly 1).
 */
export function pluralCategory(n: number): PluralCategory {
  return active.plural ? active.plural(n) : n === 1 ? 'one' : 'other';
}

/** `n` in the catalogue's locale, without thousands separators ("2000", "2.5"). */
export function formatNumber(n: number): string {
  return active.number ? active.number(n) : String(n);
}

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

/** The placeholder names in a message, in order, without repeats. */
export function placeholdersOf(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]))];
}

function render(key: string, params: Readonly<Record<string, ParamValue>> | undefined): string {
  const message = active.flat.get(key);
  if (message == null) {
    // Only reachable through `translate` with a key built at runtime.
    console.warn(`i18n: no message "${key}"`);
    return key;
  }
  let text: string;
  if (typeof message === 'string') text = message;
  else {
    const count = Number(params?.count);
    text = message[pluralCategory(count)] ?? message.other;
  }
  text = text.replace(PLACEHOLDER, (_, name: string) => {
    const value = params?.[name];
    if (value == null) {
      console.warn(`i18n: no value for {${name}} in "${key}"`);
      return '';
    }
    return typeof value === 'number' ? formatNumber(value) : value;
  });
  return active.pseudo ? `[[${text}]]` : text;
}

/** The text for `key`, with its `{placeholders}` filled from `params`. */
export function t<K extends MessageKey>(key: K, ...params: ParamArgs<K>): string {
  return render(key, params[0] as Record<string, ParamValue> | undefined);
}

/**
 * Like `t`, for a key held in data (a tip's text, an option's label), where
 * the parameters cannot be checked against the key at compile time.
 */
export function translate(key: MessageKey, params?: Readonly<Record<string, ParamValue>>): string {
  return render(key, params);
}

/** Whether `key` is in the active catalogue (for keys built at runtime). */
export function hasMessage(key: string): key is MessageKey {
  return active.flat.has(key);
}

/** Every key and its message in the active catalogue (for tests and tooling). */
export function allMessages(): ReadonlyMap<string, string | PluralMessage> {
  return active.flat;
}

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;

/** The catalogue's short name for a month, 0 = January ("Jan"). */
export function monthName(month: number): string {
  return t(`dates.months.${MONTH_KEYS[month]}`);
}

const dayFormats = new Map<string, Intl.DateTimeFormat | null>();

function dayFormat(withYear: boolean): Intl.DateTimeFormat | null {
  const id = `${active.locale}|${withYear}`;
  if (!dayFormats.has(id)) {
    let format: Intl.DateTimeFormat | null = null;
    try {
      format = new Intl.DateTimeFormat(active.locale, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
      if (typeof format.formatToParts !== 'function') format = null;
    } catch {
      format = null;
    }
    dayFormats.set(id, format);
  }
  return dayFormats.get(id) ?? null;
}

/**
 * A calendar day in the app's own style: "12 Oct 2026", or "12 Oct" without
 * the year (loan stamps). The order and digits come from
 * `Intl.DateTimeFormat` in the catalogue's locale; the month's name comes
 * from the catalogue, because engines disagree on it ("Sep" or "Sept") and
 * the stamps are designed around three letters. Without `formatToParts` the
 * catalogue's `dates.dayMonthYear` / `dates.dayMonth` pattern is used.
 */
export function formatDay(date: Date, { year = true }: { year?: boolean } = {}): string {
  const month = monthName(date.getMonth());
  const format = dayFormat(year);
  if (format) {
    try {
      return format
        .formatToParts(date)
        .map((p) => (p.type === 'month' ? month : p.value))
        .join('');
    } catch {
      // Fall through to the catalogue's pattern.
    }
  }
  const parts = { day: date.getDate(), month, year: date.getFullYear() };
  return year ? t('dates.dayMonthYear', parts) : t('dates.dayMonth', parts);
}
