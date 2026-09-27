import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { resetCatalogue, setCatalogue, type Catalogue } from '@/i18n';
import { en } from '@/i18n/en';

import { appLanguage, bookLanguagePreference, detectOcrLanguage, detectTextLanguage } from '../bookLanguage';

import type { OcrResult } from '../ocrQuery';

const ocr = (name: string) =>
  (JSON.parse(readFileSync(join(__dirname, '..', '__fixtures__', 'ocr', `${name}.json`), 'utf8')) as { result: OcrResult }).result;

const lines = (...entries: [string, string?][]): OcrResult => ({
  blocks: entries.map(([text, language]) => ({
    text,
    frame: { x: 0, y: 0, width: 100, height: 20 },
    lines: [{ text, frame: { x: 0, y: 0, width: 100, height: 20 }, language }],
  })),
});

afterEach(() => resetCatalogue());

describe('detectTextLanguage', () => {
  it.each<[string, string | null]>([
    ['Cien años de soledad\nGabriel García Márquez', 'es'],
    ['Le Petit Prince', 'fr'],
    ['Der Vorleser', 'de'],
    ['Het Achterhuis', 'nl'],
    ['Il nome della rosa', 'it'],
    ['O Alquimista', 'pt'],
    ['Harry Potter and the Philosopher’s Stone', 'en'],
    ['The Name of the Wind', 'en'],
    ['ノルウェイの森', 'ja'],
    ['Мастер и Маргарита', 'ru'],
    // Nothing to go on: names and title words that are not function words.
    ['PRACTICAL MAGIC\nALICE HOFFMAN', null],
    ['Norwegian Wood', null],
    ['', null],
    // One English and one French word: no clear majority.
    ['The Farthest Shore\nUrsula K. Le Guin', null],
  ])('%p → %p', (text, code) => {
    expect(detectTextLanguage(text)).toBe(code);
  });
});

describe('detectOcrLanguage', () => {
  it('reads the three real ML Kit captures as English, despite single-line misjudgements ("ALICE" as Romanian)', () => {
    expect(detectOcrLanguage(ocr('real-mlkit-problematic-summer-romance'))).toBe('en');
    expect(detectOcrLanguage(ocr('real-mlkit-practical-magic'))).toBe('en');
    expect(detectOcrLanguage(ocr('real-mlkit-nobodys-girl'))).toBe('en');
  });

  it('falls back on the words when the recogniser gives no languages (the hand-written covers)', () => {
    expect(detectOcrLanguage(ocr('cien-anos-debolsillo'))).toBe('es');
    expect(detectOcrLanguage(ocr('petit-prince-folio'))).toBe('fr');
    expect(detectOcrLanguage(ocr('the-hobbit'))).toBe('en');
  });

  it('weighs each line by its letters and ignores "und"', () => {
    expect(detectOcrLanguage(lines(['PROBLEMATIC SUMMER', 'en'], ['ROMANCE', 'und-Latn'], ['2 novel', 'pt']))).toBe('en');
    expect(detectOcrLanguage(lines(['MAGISCHE PRAKTIJKEN', 'nl'], ['ALICE HOFFMAN', 'und']))).toBe('nl');
  });

  it('says nothing without a clear majority or enough to go on', () => {
    expect(detectOcrLanguage(lines(['ALICE', 'ro']))).toBeNull();
    expect(detectOcrLanguage(lines(['PRACTICAL MAGIC', 'en'], ['MAGISCHE PRAKTIJKEN', 'nl']))).toBeNull();
    expect(detectOcrLanguage({ blocks: [] })).toBeNull();
  });
});

describe('bookLanguagePreference', () => {
  it('prefers the language read on the cover', () => {
    expect(bookLanguagePreference('nl')).toEqual({ code: 'nl', detected: true });
  });

  it("otherwise uses the app's language, marked as not detected", () => {
    expect(bookLanguagePreference(null)).toEqual({ code: 'en', detected: false });
    setCatalogue(en as Catalogue, 'fr-FR');
    expect(appLanguage()).toBe('fr');
    expect(bookLanguagePreference(undefined)).toEqual({ code: 'fr', detected: false });
  });
});
