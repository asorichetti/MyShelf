import { csvField, detectDelimiter, escapeFormula, parseCsv, toCsv, unescapeFormula, CsvParseError } from '@/services/backup';

describe('parseCsv', () => {
  it('reads plain and quoted fields', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
    expect(parseCsv('"a, b","say ""hi""",c')).toEqual([['a, b', 'say "hi"', 'c']]);
  });

  it('keeps line breaks inside quotes and accepts CRLF, LF and CR endings', () => {
    expect(parseCsv('title,notes\r\nDune,"line one\r\nline two"\r\nMort,x\r\n')).toEqual([
      ['title', 'notes'],
      ['Dune', 'line one\r\nline two'],
      ['Mort', 'x'],
    ]);
    expect(parseCsv('a\rb\r')).toEqual([['a'], ['b']]);
  });

  it('keeps empty fields, skips blank lines and strips a BOM', () => {
    expect(parseCsv('﻿a,,c\n\n,,\n')).toEqual([
      ['a', '', 'c'],
      ['', '', ''],
    ]);
    expect(parseCsv('a,""\n')).toEqual([['a', '']]);
  });

  it('reads a last line without a newline', () => {
    expect(parseCsv('a,b\n1,"2"')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('reports a quote that never closes, with its line', () => {
    expect(() => parseCsv('a,b\n1,"never\nends')).toThrow(CsvParseError);
    try {
      parseCsv('a\nb\n"oops');
    } catch (e) {
      expect((e as CsvParseError).line).toBe(3);
    }
  });

  it('reads semicolon and tab files', () => {
    expect(parseCsv('Title;Author\n"A; B";C', ';')).toEqual([
      ['Title', 'Author'],
      ['A; B', 'C'],
    ]);
    expect(parseCsv('Title\tAuthor\nDune\tHerbert')).toEqual([
      ['Title', 'Author'],
      ['Dune', 'Herbert'],
    ]);
  });
});

describe('detectDelimiter', () => {
  it('counts delimiters on the header line outside quotes', () => {
    expect(detectDelimiter('Title,Author,Year\n')).toBe(',');
    expect(detectDelimiter('Title;Author;Year\nA,B;C')).toBe(';');
    expect(detectDelimiter('Title\tAuthor\n')).toBe('\t');
    expect(detectDelimiter('"A;B;C",D\n')).toBe(',');
    expect(detectDelimiter('Title\n')).toBe(',');
  });
});

describe('writing CSV', () => {
  it('quotes commas, quotes, line breaks, semicolons and edge spaces only', () => {
    expect(csvField('Dune')).toBe('Dune');
    expect(csvField('Pratchett, Terry')).toBe('"Pratchett, Terry"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('a\nb')).toBe('"a\nb"');
    expect(csvField('A; B')).toBe('"A; B"');
    expect(csvField(' lead')).toBe('" lead"');
    expect(csvField(null)).toBe('');
    expect(csvField(2.5)).toBe('2.5');
  });

  it('neutralises text a spreadsheet would run as a formula, and reads it back unchanged', () => {
    expect(csvField('=HYPERLINK("http://evil.example","Click")')).toBe('"\'=HYPERLINK(""http://evil.example"",""Click"")"');
    expect(csvField('+1 great read')).toBe("'+1 great read");
    expect(csvField('-2 stars')).toBe("'-2 stars");
    expect(csvField('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvField('\t=cmd')).toBe('"\'\t=cmd"');
    expect(csvField('A = B')).toBe('A = B');
    expect(csvField(-3)).toBe('-3');
    for (const text of ['=1+1', '+44', '-', '@home', "'quoted'", "'=already"]) expect(unescapeFormula(escapeFormula(text))).toBe(text);
    expect(unescapeFormula("'tis the season")).toBe("'tis the season");
  });

  it('writes CRLF rows with an optional BOM, and reads back what it wrote', () => {
    const rows = [
      ['Title', 'Notes'],
      ['Good Omens, again', 'He said "wait"\nthen left'],
      ['Ünïcödé', ''],
    ];
    const text = toCsv(rows, { bom: true });
    expect(text.startsWith('﻿Title,Notes\r\n')).toBe(true);
    expect(text.endsWith('\r\n')).toBe(true);
    expect(parseCsv(text)).toEqual(rows);
  });
});
