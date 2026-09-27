import { decodeText, decodeUtf8, readCsvTable } from '@/services/backup';

const utf8 = (text: string) => new TextEncoder().encode(text);
const cp1252 = (text: string) =>
  Uint8Array.from([...text], (c) => {
    const special: Record<string, number> = { '€': 0x80, '’': 0x92, '“': 0x93, '”': 0x94, '–': 0x96, 'œ': 0x9c };
    return special[c] ?? c.charCodeAt(0);
  });
const utf16 = (text: string, littleEndian: boolean) => {
  const out = [littleEndian ? 0xff : 0xfe, littleEndian ? 0xfe : 0xff];
  for (let i = 0; i < text.length; i++) {
    const u = text.charCodeAt(i);
    out.push(...(littleEndian ? [u & 0xff, u >> 8] : [u >> 8, u & 0xff]));
  }
  return Uint8Array.from(out);
};

const sample = 'Title;Author;Notes\r\nCien años de soledad;Gabriel García Márquez;“Magnífico” – 5€, œuvre, l’été\r\n';

describe('decodeText', () => {
  it('reads UTF-8, with or without a byte order mark, including characters outside the BMP', () => {
    expect(decodeText(utf8(sample))).toBe(sample);
    expect(decodeText(utf8(`﻿${sample}`))).toBe(`﻿${sample}`);
    expect(decodeText(utf8('📚 Book'))).toBe('📚 Book');
    expect(decodeText(new Uint8Array())).toBe('');
  });

  it('reads Windows-1252, as Excel on Windows saves "CSV", instead of turning accents into �', () => {
    const bytes = cp1252(sample);
    // Read as UTF-8 (what a plain text() does) every accent is lost.
    expect(new TextDecoder().decode(bytes)).toContain('�');
    expect(decodeText(bytes)).toBe(sample);
    const table = readCsvTable(decodeText(bytes));
    expect(table.rows[0]).toEqual(['Cien años de soledad', 'Gabriel García Márquez', '“Magnífico” – 5€, œuvre, l’été']);
  });

  it('reads UTF-16 with a byte order mark, as Excel saves "Unicode Text"', () => {
    const text = 'Title\tAuthor\r\nÉmile\tRousseau 📚\r\n';
    expect(decodeText(utf16(text, true))).toBe(text);
    expect(decodeText(utf16(text, false))).toBe(text);
    expect(readCsvTable(decodeText(utf16(text, true))).rows).toEqual([['Émile', 'Rousseau 📚']]);
  });

  it('accepts only well-formed UTF-8 as UTF-8', () => {
    expect(decodeUtf8(Uint8Array.from([0xc3, 0xa9]))).toBe('é');
    for (const bad of [[0xc3], [0xc0, 0xaf], [0xe0, 0x80, 0xaf], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xe9, 0x74, 0xe9], [0x80]]) {
      expect(decodeUtf8(Uint8Array.from(bad))).toBeNull();
    }
  });

  it('decodes a large file quickly', () => {
    const big = utf8(sample.repeat(40_000));
    const start = Date.now();
    expect(decodeText(big)).toHaveLength(sample.length * 40_000);
    expect(Date.now() - start).toBeLessThan(5000);
  });
});
