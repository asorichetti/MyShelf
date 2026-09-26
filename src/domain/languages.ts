/**
 * Book languages are stored as ISO 639-1 codes (`en`). Open Library uses
 * MARC 21 codes (`/languages/eng`), which are ISO 639-2/B; Google Books
 * already sends ISO 639-1 (sometimes with a region, `en-GB`).
 */
const MARC_TO_ISO6391: Record<string, string> = {
  afr: 'af', alb: 'sq', ara: 'ar', arm: 'hy', baq: 'eu', bel: 'be', ben: 'bn', bos: 'bs', bre: 'br', bul: 'bg',
  cat: 'ca', ces: 'cs', chi: 'zh', cym: 'cy', cze: 'cs', dan: 'da', deu: 'de', dut: 'nl', ell: 'el', eng: 'en',
  epo: 'eo', est: 'et', eus: 'eu', fao: 'fo', fas: 'fa', fin: 'fi', fra: 'fr', fre: 'fr', fry: 'fy', geo: 'ka',
  ger: 'de', gla: 'gd', gle: 'ga', glg: 'gl', gre: 'el', guj: 'gu', heb: 'he', hin: 'hi', hrv: 'hr', hun: 'hu',
  hye: 'hy', ice: 'is', ind: 'id', iri: 'ga', isl: 'is', ita: 'it', jpn: 'ja', kat: 'ka', kaz: 'kk', kor: 'ko',
  kur: 'ku', lat: 'la', lav: 'lv', lit: 'lt', ltz: 'lb', mac: 'mk', mal: 'ml', mao: 'mi', mar: 'mr', may: 'ms',
  mkd: 'mk', mlt: 'mt', mon: 'mn', msa: 'ms', nep: 'ne', nld: 'nl', nno: 'nn', nob: 'nb', nor: 'no', pan: 'pa',
  per: 'fa', pol: 'pl', por: 'pt', ron: 'ro', rum: 'ro', rus: 'ru', san: 'sa', scc: 'sr', scr: 'hr', slk: 'sk',
  slo: 'sk', slv: 'sl', som: 'so', spa: 'es', sqi: 'sq', srp: 'sr', swa: 'sw', swe: 'sv', tam: 'ta', tel: 'te',
  tgl: 'tl', tha: 'th', tib: 'bo', tur: 'tr', ukr: 'uk', urd: 'ur', uzb: 'uz', vie: 'vi', wel: 'cy', yid: 'yi',
  zho: 'zh', zul: 'zu',
};

/**
 * ISO 639-1 code for a MARC/ISO 639-2 code, an Open Library language key
 * (`/languages/fre`) or an ISO 639-1 code with or without a region
 * (`en-GB`). Null for unknown, "multiple" (`mul`) and "undetermined" (`und`).
 */
export function toIso6391(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = code.trim().toLowerCase().replace(/^\/languages\//, '');
  if (/^[a-z]{2}(?:[-_][a-z0-9]+)?$/.test(c)) return c.slice(0, 2);
  return MARC_TO_ISO6391[c] ?? null;
}

/** A language a book can be catalogued in: ISO 639-1 code and English name. */
export interface Language {
  code: string;
  name: string;
}

/** The languages offered in the book form, by English name: every code `toIso6391` can produce. */
export const languages: readonly Language[] = [
  { code: 'af', name: 'Afrikaans' },
  { code: 'sq', name: 'Albanian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hy', name: 'Armenian' },
  { code: 'eu', name: 'Basque' },
  { code: 'be', name: 'Belarusian' },
  { code: 'bn', name: 'Bengali' },
  { code: 'bs', name: 'Bosnian' },
  { code: 'br', name: 'Breton' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'ca', name: 'Catalan' },
  { code: 'zh', name: 'Chinese' },
  { code: 'hr', name: 'Croatian' },
  { code: 'cs', name: 'Czech' },
  { code: 'da', name: 'Danish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'en', name: 'English' },
  { code: 'eo', name: 'Esperanto' },
  { code: 'et', name: 'Estonian' },
  { code: 'fo', name: 'Faroese' },
  { code: 'fi', name: 'Finnish' },
  { code: 'fr', name: 'French' },
  { code: 'fy', name: 'Frisian' },
  { code: 'gl', name: 'Galician' },
  { code: 'ka', name: 'Georgian' },
  { code: 'de', name: 'German' },
  { code: 'el', name: 'Greek' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'he', name: 'Hebrew' },
  { code: 'hi', name: 'Hindi' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'is', name: 'Icelandic' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ga', name: 'Irish' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'kk', name: 'Kazakh' },
  { code: 'ko', name: 'Korean' },
  { code: 'ku', name: 'Kurdish' },
  { code: 'la', name: 'Latin' },
  { code: 'lv', name: 'Latvian' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'lb', name: 'Luxembourgish' },
  { code: 'mk', name: 'Macedonian' },
  { code: 'ms', name: 'Malay' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'mt', name: 'Maltese' },
  { code: 'mr', name: 'Marathi' },
  { code: 'mn', name: 'Mongolian' },
  { code: 'mi', name: 'Māori' },
  { code: 'ne', name: 'Nepali' },
  { code: 'no', name: 'Norwegian' },
  { code: 'nb', name: 'Norwegian Bokmål' },
  { code: 'nn', name: 'Norwegian Nynorsk' },
  { code: 'fa', name: 'Persian' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'sa', name: 'Sanskrit' },
  { code: 'gd', name: 'Scottish Gaelic' },
  { code: 'sr', name: 'Serbian' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'so', name: 'Somali' },
  { code: 'es', name: 'Spanish' },
  { code: 'sw', name: 'Swahili' },
  { code: 'sv', name: 'Swedish' },
  { code: 'tl', name: 'Tagalog' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'th', name: 'Thai' },
  { code: 'bo', name: 'Tibetan' },
  { code: 'tr', name: 'Turkish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ur', name: 'Urdu' },
  { code: 'uz', name: 'Uzbek' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'cy', name: 'Welsh' },
  { code: 'yi', name: 'Yiddish' },
  { code: 'zu', name: 'Zulu' },
];

const byCode = new Map(languages.map((l) => [l.code, l]));

/** Whether a value is shaped like an ISO 639-1 code (lookups may bring codes outside the list). */
export function isLanguageCode(code: string): boolean {
  return /^[a-z]{2}$/.test(code);
}

/** "en" -> "English"; codes without a name are shown as they are. */
export function languageName(code: string): string {
  return byCode.get(code)?.name ?? code;
}
