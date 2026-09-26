import { formatIsbn13 } from '../isbnFormat';

describe('formatIsbn13', () => {
  it.each([
    ['9780552166591', '978-0-552-16659-1'], // Corgi: 3-digit registrant
    ['9780747532699', '978-0-7475-3269-9'], // Bloomsbury: 4 digits
    ['9780141439518', '978-0-14-143951-8'], // Penguin: 2 digits
    ['9780345339706', '978-0-345-33970-6'],
    ['9781857231380', '978-1-85723-138-0'], // Orbit: 5 digits in group 1
    ['9781405922180', '978-1-4059-2218-0'],
    ['978-0-552-16659-1', '978-0-552-16659-1'],
  ])('%s -> %s', (raw, want) => {
    expect(formatIsbn13(raw)).toBe(want);
  });

  it('does not guess the ranges of other groups', () => {
    expect(formatIsbn13('9782070612758')).toBe('978-2070612758');
    expect(formatIsbn13('9791099999993')).toBe('979-1099999993');
  });

  it('leaves anything that is not a valid ISBN-13 alone', () => {
    expect(formatIsbn13('0345339703')).toBe('0345339703');
    expect(formatIsbn13('9780000000000')).toBe('9780000000000');
    expect(formatIsbn13('')).toBe('');
  });
});
