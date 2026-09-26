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
