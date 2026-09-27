import {
  cleanSeriesName,
  extractSeries,
  isImprintSeries,
  parsePosition,
  parseRoman,
  parseSeriesFromTitle,
  parseSeriesString,
  type SeriesHintInput,
} from '../seriesParser';

const ol = (raw: string): SeriesHintInput => ({ name: raw, position: null, source: 'openlibrary', raw });
const gb = (position: number): SeriesHintInput => ({ name: null, position, source: 'googlebooks' });

describe('parseSeriesString', () => {
  // The first block is every series string in the recorded Open Library fixtures.
  it.each<[string, string | null, number | null]>([
    ['Discworld, Book 1', 'Discworld', 1],
    ['Harry Potter, #1', 'Harry Potter', 1],
    ['Discworld, part 10', 'Discworld', 10],
    ['Dune chronicles -- bk. 1', 'Dune chronicles', 1],
    ['Discworld (1)', 'Discworld', 1],
    ['Discworld series', 'Discworld', null],
    ['The Discworld series', 'The Discworld', null],
    ['Discworld', 'Discworld', null],
    ['Discworld Vol. 1', 'Discworld', 1],
    ['Świat Dysku, Part I', 'Świat Dysku', 1],
    ['Discworld #1', 'Discworld', 1],
    // The card's examples and common library-catalogue forms.
    ['Discworld ; 5', 'Discworld', 5],
    ['Harry Potter -- 1', 'Harry Potter', 1],
    ['Discworld novel, 5', 'Discworld', 5],
    ['The Expanse #3', 'The Expanse', 3],
    ['A Discworld novel', 'Discworld', null],
    ['Discworld novels ; 12', 'Discworld', 12],
    ['Dune Chronicles, Book Four', 'Dune Chronicles', 4],
    ['Wheel of Time, Book IV', 'Wheel of Time', 4],
    ['Harry Potter ; 2.5', 'Harry Potter', 2.5],
    ['The Expanse #1.5', 'The Expanse', 1.5],
    ['Discworld ; no. 7', 'Discworld', 7],
    ['(Discworld ; 5)', 'Discworld', 5],
    ['Discworld (Book 3)', 'Discworld', 3],
    ['Les Rougon-Macquart ; 7', 'Les Rougon-Macquart', 7],
    ['Tales of the City, Mild', 'Tales of the City, Mild', null],
    ['Discworld 5', 'Discworld', 5],
    ['Penguin Classics', null, null],
    ["Everyman's Library ; 123", null, null],
    ["Oxford World's Classics", null, null],
    ['Folio junior', null, null],
    ['', null, null],
    ['  ;  ', null, null],
  ])('%p → %p #%p', (raw, name, position) => {
    const parsed = parseSeriesString(raw);
    expect(parsed).toEqual(name === null ? null : { name, position });
  });

  it('returns null for null and undefined', () => {
    expect(parseSeriesString(null)).toBeNull();
    expect(parseSeriesString(undefined)).toBeNull();
  });
});

describe('parseSeriesFromTitle', () => {
  it.each<[string, string | null, string | null, number | null]>([
    ['The Way of Kings (The Stormlight Archive, #1)', null, 'The Stormlight Archive', 1],
    ['Leviathan Wakes (The Expanse #1)', null, 'The Expanse', 1],
    ['Guards! Guards! (Discworld Book 8)', null, 'Discworld', 8],
    ['Words of Radiance (Stormlight Archive, #2.5)', null, 'Stormlight Archive', 2.5],
    ['New Spring (The Wheel of Time, #0)', null, 'The Wheel of Time', 0],
    ['Discworld Book 3: Equal Rites', null, 'Discworld', 3],
    ['Stormlight Archive, Book 2 - Words of Radiance', null, 'Stormlight Archive', 2],
    ['The Colour of Magic: A Discworld Novel', null, 'Discworld', null],
    ['Mort', 'A Discworld Novel', 'Discworld', null],
    ['The Shadow Rising', 'Book Four of the Wheel of Time', 'Wheel of Time', 4],
    ['The Great Hunt', 'Book II of The Wheel of Time', 'Wheel of Time', 2],
    ['The Way of Kings', 'The Stormlight Archive, Book 1', 'The Stormlight Archive', 1],
    ['Pride and Prejudice (Penguin Classics)', null, null, null],
    ["Harry Potter and the Philosopher's Stone", null, null, null],
    ['The Martian', null, null, null],
    ['Catch-22', null, null, null],
    ['Dune: Deluxe Edition', null, null, null],
  ])('%p / %p → %p #%p', (title, subtitle, name, position) => {
    const parsed = parseSeriesFromTitle(title, subtitle);
    expect(parsed).toEqual(name === null ? null : { name, position });
  });
});

describe('extractSeries', () => {
  it('uses an Open Library series with a position at high confidence', () => {
    expect(extractSeries({ title: 'The Colour of Magic', seriesHints: [ol('Discworld, Book 1')] })).toEqual({
      name: 'Discworld',
      position: 1,
      confidence: 'high',
    });
  });

  it('accepts a hint the provider already parsed', () => {
    const hint: SeriesHintInput = { name: 'Harry Potter', position: 1, source: 'openlibrary', raw: 'Harry Potter, #1' };
    expect(extractSeries({ title: "Harry Potter and the Philosopher's Stone", seriesHints: [hint] })).toEqual({
      name: 'Harry Potter',
      position: 1,
      confidence: 'high',
    });
  });

  it('is medium confidence for a named series with no position', () => {
    expect(extractSeries({ title: 'Mort', seriesHints: [ol('Discworld series')] })).toEqual({
      name: 'Discworld',
      position: null,
      confidence: 'medium',
    });
  });

  it('fills a missing position from Google Books', () => {
    expect(extractSeries({ title: 'Mort', seriesHints: [ol('Discworld'), gb(4)] })).toEqual({
      name: 'Discworld',
      position: 4,
      confidence: 'medium',
    });
  });

  it('prefers the Open Library position over Google Books', () => {
    expect(extractSeries({ title: 'Mort', seriesHints: [ol('Discworld ; 4'), gb(9)] })).toMatchObject({ position: 4 });
  });

  it('ignores a Google Books position with no series name', () => {
    expect(extractSeries({ title: 'The Martian', seriesHints: [gb(1)] })).toBeNull();
  });

  it('merges hints naming the same series and keeps the one with a position', () => {
    const hints = [ol('The Discworld series'), ol('Discworld (1)'), ol('Discworld')];
    expect(extractSeries({ title: 'The Colour of Magic', seriesHints: hints })).toEqual({
      name: 'Discworld',
      position: 1,
      confidence: 'high',
    });
  });

  it('drops imprint series and falls back to the title', () => {
    const hints = [ol('Penguin Classics'), ol("Everyman's Library")];
    expect(extractSeries({ title: 'Leviathan Wakes (The Expanse #1)', seriesHints: hints })).toEqual({
      name: 'The Expanse',
      position: 1,
      confidence: 'medium',
    });
    expect(extractSeries({ title: 'Pride and Prejudice', seriesHints: hints })).toBeNull();
  });

  it('is low confidence for a title pattern without a position', () => {
    expect(extractSeries({ title: 'Mort', subtitle: 'A Discworld Novel' })).toEqual({
      name: 'Discworld',
      position: null,
      confidence: 'low',
    });
  });

  it('prefers a provider series over a disagreeing title pattern', () => {
    expect(
      extractSeries({ title: 'Dune (Great SF Reads, #3)', seriesHints: [ol('Dune chronicles -- bk. 1')] }),
    ).toEqual({ name: 'Dune chronicles', position: 1, confidence: 'high' });
  });

  it('returns null when there is nothing to go on', () => {
    expect(extractSeries({ title: 'The Martian' })).toBeNull();
    expect(extractSeries({ title: 'The Martian', seriesHints: [] })).toBeNull();
  });
});

describe('parsePosition', () => {
  it.each<[string | null, number | null]>([
    ['5', 5],
    ['#5', 5],
    ['2.5', 2.5],
    ['2,5', 2.5],
    ['IV', 4],
    ['xii', 12],
    ['three', 3],
    ['Third', 3],
    ['0', 0],
    ['#0', 0],
    ['-1', null],
    ['IIII', null],
    ['D', null],
    ['mild', null],
    ['', null],
    [null, null],
  ])('%p → %p', (text, expected) => {
    expect(parsePosition(text)).toBe(expected);
  });

  it('parses roman numerals', () => {
    expect([parseRoman('ix'), parseRoman('XL'), parseRoman('mcmlxxxiv'), parseRoman(''), parseRoman('abc')]).toEqual([
      9, 40, 1984, null, null,
    ]);
  });
});

describe('isImprintSeries / cleanSeriesName', () => {
  it.each([
    ['Penguin Classics', true],
    ['penguin modern classics', true],
    ["Everyman's Library", true],
    ["Oxford World's Classics", true],
    ['Vintage Classics', true],
    ['Le Livre de Poche', true],
    ['Collins Classics', true],
    ['Discworld', false],
    ['The Expanse', false],
    ['Harry Potter', false],
  ])('%p imprint: %p', (name, expected) => {
    expect(isImprintSeries(name)).toBe(expected);
  });

  it.each([
    ['A Discworld Novel', 'Discworld'],
    ['Discworld series', 'Discworld'],
    ['  "Discworld" ', 'Discworld'],
    ['Dune chronicles', 'Dune chronicles'],
  ])('cleans %p → %p', (raw, clean) => {
    expect(cleanSeriesName(raw)).toBe(clean);
  });
});
