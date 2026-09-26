import { isbn10To13, isbn13To10, isValidIsbn, isValidIsbn10, isValidIsbn13, normalizeIsbn } from '@/domain';

describe('normalizeIsbn', () => {
  it('strips separators and upper-cases x', () => {
    expect(normalizeIsbn('978-0-261-10221-7')).toBe('9780261102217');
    expect(normalizeIsbn(' 0-8044-2957-x ')).toBe('080442957X');
    expect(normalizeIsbn('')).toBeNull();
    expect(normalizeIsbn(null)).toBeNull();
  });
});

describe('ISBN validation', () => {
  it.each(['9780261102217', '978-0-441-01359-3', '9791032305690'])('accepts valid ISBN-13 %s', (isbn) => {
    expect(isValidIsbn13(isbn)).toBe(true);
    expect(isValidIsbn(isbn)).toBe(true);
  });

  it.each(['9780261102218', '9770261102217', '978026110221', 'abcdefghijklm'])('rejects invalid ISBN-13 %s', (isbn) => {
    expect(isValidIsbn13(isbn)).toBe(false);
  });

  it.each(['0261102214', '0-441-01359-7', '080442957X'])('accepts valid ISBN-10 %s', (isbn) => {
    expect(isValidIsbn10(isbn)).toBe(true);
  });

  it.each(['0261102215', '08044295X7', '026110221'])('rejects invalid ISBN-10 %s', (isbn) => {
    expect(isValidIsbn10(isbn)).toBe(false);
  });
});

describe('ISBN conversion', () => {
  it('converts 10 -> 13 and back', () => {
    expect(isbn10To13('0261102214')).toBe('9780261102217');
    expect(isbn13To10('9780261102217')).toBe('0261102214');
    expect(isbn10To13('080442957X')).toBe('9780804429573');
    expect(isbn13To10('9780804429573')).toBe('080442957X');
  });

  it('returns null when there is no equivalent', () => {
    expect(isbn13To10('9791032305690')).toBeNull(); // 979 prefixes have no ISBN-10
    expect(isbn10To13('0261102215')).toBeNull();
    expect(isbn13To10('9780261102218')).toBeNull();
  });
});
