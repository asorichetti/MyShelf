import { catalogueLocale } from '@/i18n';

import { toIso6391 } from './languages';

import type { OcrResult } from './ocrQuery';

/**
 * Which language of a book to prefer when a search or a work offers several
 * editions (the English cover of a novel also published in Dutch should find
 * the English edition). `detected`: read from the cover's own words, so it
 * outranks everything else; otherwise it is the app's language, a weaker hint
 * that a close title can outweigh.
 */
export interface LanguagePreference {
  /** ISO 639-1 code. */
  code: string;
  detected: boolean;
}

/**
 * Short function words that give a language away on a cover or in a typed
 * title. A word shared by several languages ("de") splits its vote. Words
 * that are also common English ("romance", "roman", "as", "do") are left
 * out: an English cover says "A Novel" or "Romance" as often as any.
 */
const STOPWORDS: Record<string, readonly string[]> = {
  en: ['the', 'of', 'and', 'a', 'an', 'to', 'in', 'for', 'with', 'by', 'from', 'my', 'your', 'is', 'at', 'this', 'novel', 'author'],
  fr: ['le', 'la', 'les', 'des', 'du', 'de', 'et', 'un', 'une', 'au', 'aux', 'avec', 'pour', 'dans', 'sur', 'est', 'petit'],
  es: ['el', 'la', 'los', 'las', 'del', 'de', 'y', 'una', 'con', 'por', 'para', 'que', 'su', 'novela'],
  de: ['der', 'die', 'das', 'und', 'ein', 'eine', 'mit', 'von', 'zu', 'im', 'den', 'dem', 'des', 'auf', 'für', 'nicht'],
  nl: ['de', 'het', 'een', 'van', 'en', 'voor', 'met', 'niet', 'op', 'wordt', 'ik'],
  it: ['il', 'lo', 'gli', 'la', 'le', 'della', 'delle', 'dei', 'di', 'e', 'una', 'che', 'per', 'con', 'nel', 'romanzo'],
  pt: ['o', 'os', 'da', 'das', 'dos', 'de', 'e', 'um', 'uma', 'com', 'para', 'não'],
};

/** Letters that belong to one language among those above. */
const LETTERS: [RegExp, string][] = [
  [/[ñ¿¡]/giu, 'es'],
  [/[ß]/giu, 'de'],
  [/[äöü]/giu, 'de'],
  [/[ãõ]/giu, 'pt'],
  [/[èêëîïôûùœ]/giu, 'fr'],
  [/[ìò]/giu, 'it'],
];

/** Writing systems that name the language outright (or nearly). */
const SCRIPTS: [RegExp, string][] = [
  [/[\p{Script=Hiragana}\p{Script=Katakana}]/gu, 'ja'],
  [/\p{Script=Hangul}/gu, 'ko'],
  [/\p{Script=Han}/gu, 'zh'],
  [/\p{Script=Cyrillic}/gu, 'ru'],
  [/\p{Script=Greek}/gu, 'el'],
  [/\p{Script=Hebrew}/gu, 'he'],
  [/\p{Script=Arabic}/gu, 'ar'],
  [/\p{Script=Thai}/gu, 'th'],
];

/** One function word or telling letter is worth this many letters of recogniser opinion. */
const WORD_VOTE = 6;
/** Below this much evidence, say nothing. */
const MIN_EVIDENCE = 6;
/** The winner needs this share of all the evidence. */
const MIN_SHARE = 0.55;

type Votes = Map<string, number>;

function add(votes: Votes, code: string, weight: number) {
  votes.set(code, (votes.get(code) ?? 0) + weight);
}

function voteText(votes: Votes, text: string) {
  const lower = text.normalize('NFC').toLowerCase();
  for (const [pattern, code] of SCRIPTS) {
    const n = lower.match(pattern)?.length ?? 0;
    if (n) add(votes, code, n * 2);
  }
  // Japanese is written with kanji too: kana alone decide between Japanese and Chinese.
  if (votes.has('ja') && votes.has('zh')) {
    add(votes, 'ja', votes.get('zh')!);
    votes.delete('zh');
  }
  for (const [pattern, code] of LETTERS) {
    const n = lower.match(pattern)?.length ?? 0;
    if (n) add(votes, code, n * WORD_VOTE);
  }
  const words = lower.split(/[^\p{L}]+/u).filter(Boolean);
  for (const word of words) {
    const langs = Object.keys(STOPWORDS).filter((code) => STOPWORDS[code].includes(word));
    for (const code of langs) add(votes, code, WORD_VOTE / langs.length);
  }
}

function decide(votes: Votes): string | null {
  const total = [...votes.values()].reduce((a, b) => a + b, 0);
  const [best] = [...votes].sort((a, b) => b[1] - a[1]);
  if (!best || best[1] < MIN_EVIDENCE || best[1] < total * MIN_SHARE) return null;
  return best[0];
}

/**
 * The language of a title or a few lines of cover text ("Cien años de
 * soledad" → `es`), from function words, telling letters and the writing
 * system; null when the text does not say (a name, "PRACTICAL MAGIC").
 */
export function detectTextLanguage(text: string): string | null {
  const votes: Votes = new Map();
  voteText(votes, text);
  return decide(votes);
}

/**
 * The language of a photographed cover: the recogniser's opinion of each
 * line (ML Kit reports one, weighted by the line's letters; "und" is no
 * opinion) plus the same word and letter clues as `detectTextLanguage`.
 * Single short lines are often misjudged ("ALICE" as Romanian), so it takes
 * a clear majority to decide.
 */
export function detectOcrLanguage(result: OcrResult): string | null {
  const votes: Votes = new Map();
  const lines = result.blocks.flatMap((b): { text: string; language?: string }[] => (b.lines.length ? b.lines : [{ text: b.text }]));
  for (const line of lines) {
    const code = toIso6391(line.language);
    const letters = line.text.match(/\p{L}/gu)?.length ?? 0;
    if (code && letters) add(votes, code, letters);
  }
  voteText(votes, lines.map((l) => l.text).join('\n'));
  return decide(votes);
}

/** The app's language as an ISO 639-1 code (English when the locale says nothing). */
export function appLanguage(): string {
  return toIso6391(catalogueLocale()) ?? 'en';
}

/** The language to prefer: the one detected on the cover, else the app's. */
export function bookLanguagePreference(detected: string | null | undefined): LanguagePreference {
  return detected ? { code: detected, detected: true } : { code: appLanguage(), detected: false };
}
