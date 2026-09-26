import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { csvColumns, detectPreset, guessField, mappingFor, MYSHELF_CSV_COLUMNS, parseCsv } from '@/services/backup';

const goodreads = readFileSync(join(__dirname, '../__fixtures__/goodreads_library_export.csv'), 'utf8');
const goodreadsHeaders = parseCsv(goodreads)[0];

describe('detectPreset', () => {
  it('recognises a Goodreads export by its columns', () => {
    expect(detectPreset(goodreadsHeaders)).toBe('goodreads');
  });

  it('recognises MyShelf’s own export, with or without loan columns', () => {
    expect(detectPreset(csvColumns().map((c) => MYSHELF_CSV_COLUMNS[c]))).toBe('myshelf');
    expect(detectPreset(csvColumns({ includeLoans: true }).map((c) => MYSHELF_CSV_COLUMNS[c]))).toBe('myshelf');
  });

  it('calls anything else custom', () => {
    expect(detectPreset(['Title', 'Author'])).toBe('custom');
    expect(detectPreset(['Title', 'Authors', 'ISBN-13', 'Rating'])).toBe('custom');
  });
});

describe('mappingFor', () => {
  it('maps Goodreads columns to MyShelf fields', () => {
    const map = Object.fromEntries(goodreadsHeaders.map((h, i) => [h, mappingFor(goodreadsHeaders, 'goodreads')[i]]));
    expect(map).toMatchObject({
      Title: 'title',
      Author: 'authors',
      'Additional Authors': 'additionalAuthors',
      ISBN: 'isbn10',
      ISBN13: 'isbn13',
      Publisher: 'publisher',
      Binding: 'format',
      'Number of Pages': 'pages',
      'Year Published': 'year',
      'Original Publication Year': 'originalYear',
      'Date Added': 'added',
      Bookshelves: 'shelves',
      'Exclusive Shelf': 'exclusiveShelf',
      'My Review': 'notes',
      'Private Notes': 'privateNotes',
      'Book Id': 'ignore',
      'Author l-f': 'ignore',
      'My Rating': 'ignore',
    });
  });

  it('ignores MyShelf’s loan columns', () => {
    const headers = csvColumns({ includeLoans: true }).map((c) => MYSHELF_CSV_COLUMNS[c]);
    const map = mappingFor(headers, 'myshelf');
    expect(map[headers.indexOf('On loan to')]).toBe('ignore');
    expect(map[headers.indexOf('Authors')]).toBe('authors');
  });

  it('guesses other spreadsheets’ columns and never maps one field twice', () => {
    expect(mappingFor(['Book Title', 'Writer', 'ISBN', 'Pub Year', 'Rating', 'Title'], 'custom')).toEqual(['title', 'authors', 'isbn', 'year', 'ignore', 'ignore']);
    expect(guessField(' Number of pages ')).toBe('pages');
    expect(guessField('EAN')).toBe('isbn13');
    expect(guessField('Tags')).toBe('groups');
  });
});
