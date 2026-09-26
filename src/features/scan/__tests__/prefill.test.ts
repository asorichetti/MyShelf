/**
 * @jest-environment node
 */
import { makeCandidate } from '@/services/metadata/candidate';

import { getPrefill, prefillFromCandidate, prefillFromScan, putPrefill, titleCase } from '../prefill';

describe('prefill (P03-11)', () => {
  it('a barcode dead end keeps the exact ISBN, not marked as a guess', () => {
    expect(prefillFromScan({ isbn13: '9791099999993' })).toEqual({ draft: { isbn: '9791099999993' }, guessed: [], candidate: null });
  });

  it('a cover dead end fills the title and author guesses, marked "please check"', () => {
    const p = prefillFromScan({ guess: { title: 'the colour of magic', author: 'terry pratchett' } });
    expect(p.draft).toEqual({ title: 'The Colour Of Magic', authors: [{ name: 'Terry Pratchett', role: 'author', sortName: null }] });
    expect(p.guessed).toEqual(['title', 'authors']);
  });

  it('free text becomes the title guess; nothing known gives an empty prefill', () => {
    expect(prefillFromScan({ guess: { text: 'dune frank herbert' } }).draft).toEqual({ title: 'Dune Frank Herbert' });
    expect(prefillFromScan({})).toEqual({ draft: {}, guessed: [], candidate: null });
  });

  it('"Review before saving" carries the whole candidate', () => {
    const candidate = makeCandidate({ title: 'Mort', authors: ['Terry Pratchett'], source: 'openlibrary', sourceId: 'OL1M', subjects: ['Fantasy fiction'] });
    const p = prefillFromCandidate(candidate, ['fantasy']);
    expect(p.candidate).toBe(candidate);
    expect(p.draft).toMatchObject({ title: 'Mort', genres: ['fantasy'] });
    expect(p.guessed).toEqual([]);
  });

  it('is stored by id for the add form to read', () => {
    const id = putPrefill(prefillFromScan({ isbn13: '9780552166591' }));
    expect(getPrefill(id)?.draft.isbn).toBe('9780552166591');
    expect(getPrefill('nope')).toBeNull();
    expect(getPrefill(undefined)).toBeNull();
  });

  it('title-cases lower-case guesses, keeping apostrophes and accents', () => {
    expect(titleCase("the philosopher's stone")).toBe("The Philosopher's Stone");
    expect(titleCase('cien años de soledad')).toBe('Cien Años De Soledad');
  });
});
