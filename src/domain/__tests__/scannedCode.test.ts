import { isRepeatRead, parseScannedCode } from '../scannedCode';

describe('parseScannedCode', () => {
  it.each([
    ['ean13', '9780552166591', '9780552166591'], // Bookland 978
    ['ean13', '9791099999993', '9791099999993'], // 979-10 (France)
    ['ean13', '9798602405101', '9798602405101'], // 979-8 (US, new range)
    ['org.gs1.EAN-13', '9780141439518', '9780141439518'], // iOS-style type name
    ['EAN_13', '978-0-14-143951-8', '9780141439518'], // Android-style name, hyphens
    ['', '9780345339706', '9780345339706'], // type unknown: the digits decide
  ])('%s %s is the ISBN %s', (type, data, isbn13) => {
    expect(parseScannedCode({ type, data })).toEqual({ kind: 'isbn', isbn13 });
  });

  it('reads an ISBN-10 book: its EAN-13 is 978 + nine digits + a new check digit', () => {
    // The Fellowship of the Ring, ISBN-10 0345339703, printed as EAN-13 9780345339706.
    expect(parseScannedCode({ type: 'ean13', data: '9780345339706' })).toEqual({ kind: 'isbn', isbn13: '9780345339706' });
    // A typed ISBN-10 (with an X check digit too).
    expect(parseScannedCode({ data: '0345339703' })).toEqual({ kind: 'isbn', isbn13: '9780345339706' });
    expect(parseScannedCode({ data: '0-8044-2957-X' })).toEqual({ kind: 'isbn', isbn13: '9780804429573' });
  });

  it.each([
    ['ean13', '5000112637922'], // a grocery EAN-13 (UK prefix 50)
    ['ean13', '4006381333931'], // German product
    ['upc_a', '036000291452'], // UPC-A
    ['ean8', '96385074'], // EAN-8
    ['ean13', '9771234567003'], // 977: ISSN (a magazine), not a book
  ])('%s %s is a product barcode, not a book', (type, data) => {
    expect(parseScannedCode({ type, data })).toEqual({ kind: 'product', data });
  });

  it.each([
    ['ean13', '9780552166592'], // Bookland but a bad check digit
    ['ean13', '5000112637923'], // product with a bad check digit
    ['upc_a', '036000291453'],
    ['qr', 'https://example.com'],
    ['ean13', ''],
    ['ean13', '97805521665'], // too short
  ])('%s %s is ignored as unreadable', (type, data) => {
    expect(parseScannedCode({ type, data }).kind).toBe('invalid');
  });
});

describe('isRepeatRead', () => {
  it('ignores the same code within 3 seconds, not a different code or a later read', () => {
    const first = { data: '9780552166591', at: 1000 };
    expect(isRepeatRead(null, '9780552166591', 1000)).toBe(false);
    expect(isRepeatRead(first, '9780552166591', 3999)).toBe(true);
    expect(isRepeatRead(first, '9780552166591', 4000)).toBe(false);
    expect(isRepeatRead(first, '9780141439518', 1500)).toBe(false);
  });
});
