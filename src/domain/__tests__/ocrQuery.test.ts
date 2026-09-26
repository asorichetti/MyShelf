import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildQueriesFromOcr, cleanOcrLine, isNameLike, isNoiseLine, queriesFromTypedText, type OcrResult } from '../ocrQuery';

interface OcrFixture {
  description: string;
  expected: { title: string; author: string | null };
  result: OcrResult;
}

const dir = join(__dirname, '..', '__fixtures__', 'ocr');
const fixtures = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(join(dir, f), 'utf8')) as OcrFixture] as const);

const line = (text: string, y: number, height: number) => {
  const frame = { x: 40, y, width: 800, height };
  return { text, frame, lines: [{ text, frame }] };
};

describe('buildQueriesFromOcr on synthetic covers', () => {
  it('has the fifteen cover fixtures', () => {
    expect(fixtures).toHaveLength(15);
  });

  // Acceptance (P03-06): the first query is right for at least 12 of 15 covers.
  const firstRight = fixtures.filter(([, f]) => {
    const [first] = buildQueriesFromOcr(f.result);
    if (!first) return false;
    const titleOk = (first.title ?? first.text ?? '') === f.expected.title;
    const authorOk = f.expected.author ? first.author === f.expected.author : first.author === undefined;
    return titleOk && authorOk;
  });

  it('gets the first query right for at least 12 of the 15', () => {
    expect(firstRight.length).toBeGreaterThanOrEqual(12);
  });

  it.each(fixtures)('%s: %#', (_name, f) => {
    const queries = buildQueriesFromOcr(f.result);
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.length).toBeLessThanOrEqual(3);
    // Whatever else happens, the title is in one of the queries, and noise never is.
    expect(queries.some((q) => q.title === f.expected.title || q.text?.startsWith(f.expected.title))).toBe(true);
    for (const q of queries) expect(JSON.stringify(q)).not.toMatch(/bestseller|novel of all|introduction|£|winner|penguin classics|corgi/i);
    if (f.expected.author) expect(queries[0]).toEqual({ title: f.expected.title, author: f.expected.author });
  });
});

describe('buildQueriesFromOcr', () => {
  it('orders the queries title + author, title, then free text', () => {
    const result = { blocks: [line('TERRY PRATCHETT', 40, 60), line('MORT', 300, 200)] };
    expect(buildQueriesFromOcr(result)).toEqual([
      { title: 'mort', author: 'terry pratchett' },
      { title: 'mort' },
      { text: 'mort terry pratchett' },
    ]);
  });

  it('returns nothing for an empty or all-noise photo', () => {
    expect(buildQueriesFromOcr({ blocks: [] })).toEqual([]);
    expect(buildQueriesFromOcr({ blocks: [line('£7.99', 10, 40), line('www.example.com', 60, 30)] })).toEqual([]);
  });

  it('reads blocks without separate lines', () => {
    const frame = { x: 0, y: 0, width: 500, height: 100 };
    expect(buildQueriesFromOcr({ blocks: [{ text: 'Dune', frame, lines: [] }] })[0]).toEqual({ title: 'dune' });
  });
});

describe('line helpers', () => {
  it.each([
    ['A NOVEL', true],
    ['A Discworld Novel', true],
    ['#1 NEW YORK TIMES BESTSELLER', true],
    ['Winner of the Booker Prize', true],
    ['Introduction by Vivien Jones', true],
    ['£8.99', true],
    ['www.penguin.co.uk', true],
    ['“A triumph” — The Guardian', true],
    ['it was the best of times and it was the worst', true],
    ['Book One', true],
    ['PENGUIN CLASSICS', true],
    ['THE COLOUR', false],
    ['Terry Pratchett', false],
    ['Pride and Prejudice', false],
  ])('isNoiseLine(%j) is %s', (text, noise) => {
    expect(isNoiseLine(text)).toBe(noise);
  });

  it.each([
    ['TERRY PRATCHETT', true],
    ['Ursula K. Le Guin', true],
    ['J. R. R. TOLKIEN', true],
    ['Antoine de Saint-Exupéry', true],
    ['by Jane Austen', true],
    ['DUNE', false],
    ['The Nice and Accurate Prophecies of Agnes Nutter, Witch', false],
    ['NEIL GAIMAN & TERRY PRATCHETT', true],
    ['THE COLOUR', false],
    ['OF MAGIC', false],
    ['Catch 22', false],
  ])('isNameLike(%j) is %s', (text, name) => {
    expect(isNameLike(text)).toBe(name);
  });

  it('cleans stray punctuation and spaces', () => {
    expect(cleanOcrLine('  — THE   COLOUR ,  ')).toBe('THE COLOUR');
  });
});

describe('queriesFromTypedText (web harness)', () => {
  it('searches one typed line as free text', () => {
    expect(queriesFromTypedText('THE COLOUR OF MAGIC TERRY PRATCHETT')).toEqual([{ text: 'the colour of magic terry pratchett' }]);
  });

  it('reads several lines like a cover, top line largest, and ends with everything as free text', () => {
    expect(queriesFromTypedText('Mort\nTerry Pratchett')).toEqual([
      { title: 'mort', author: 'terry pratchett' },
      { title: 'mort' },
      { text: 'mort terry pratchett' },
    ]);
  });

  it('is empty for blank input', () => {
    expect(queriesFromTypedText('  \n ')).toEqual([]);
  });
});
