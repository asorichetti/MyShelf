import { olFixtures } from '@/services/metadata/__fixtures__/openLibraryRoutes';

import { normaliseGenres, scoreGenres } from '../genreNormaliser';
import { curatedGenres } from '../genres';

describe('normaliseGenres: one subject at a time', () => {
  // Real subjects from the recorded Open Library fixtures, then Google Books
  // BISAC categories and the card's examples.
  it.each<[string, string[]]>([
    // Open Library, as recorded
    ['Fantasy', ['Fantasy']],
    ['Fantasy fiction', ['Fantasy']],
    ['Fantastic fiction', ['Fantasy']],
    ['Merveilleux', ['Fantasy']],
    ['Ficción fantástica inglesa', ['Fantasy']],
    ['FICTION / Fantasy / Epic', ['Fantasy', 'Fiction']],
    ['Fiction, fantasy, epic', ['Fantasy', 'Fiction']],
    ['Fiction, fantasy, general', ['Fantasy', 'Fiction']],
    ['Fiction - Fantasy', ['Fantasy']],
    ['Science-Fiction', ['Science Fiction']],
    ['Science fiction', ['Science Fiction']],
    ['American Science fiction', ['Science Fiction']],
    ['Fiction, science fiction, general', ['Science Fiction', 'Fiction']],
    ['Fiction, science fiction, action & adventure', ['Science Fiction', 'Fiction']],
    ['Science Fiction & Fantasy', ['Science Fiction', 'Fantasy']],
    ['English Science Fiction And Fantasy', ['Science Fiction', 'Fantasy']],
    ['Suspense & Thriller', ['Thriller']],
    ['Love stories', ['Romance']],
    ['Amours', ['Romance']],
    ['Literary Fiction', ['Literary Fiction']],
    ['Fiction Classics', ['Literary Fiction']],
    ['Classic fiction', ['Literary Fiction']],
    ['Literature: Classics', ['Literary Fiction']],
    ['magic realism', ['Literary Fiction']],
    ['young adult fiction', ['Young Adult']],
    ['Juvenile fiction', ["Children's"]],
    ['Juvenile literature', ["Children's"]],
    ["Children's fiction", ["Children's"]],
    ["Children's stories, French", ["Children's"]],
    ['Romans, nouvelles, etc. pour la jeunesse', ["Children's", 'Fiction']],
    ['Novela juvenil', ["Children's"]],
    ['Ficción juvenil', ["Children's"]],
    ['Princes -- Juvenile fiction', ["Children's"]],
    ['Fiction', ['Fiction']],
    ['Novela', ['Fiction']],
    ['Romans, nouvelles', ['Fiction']],
    ['Ficción', ['Fiction']],
    ['English fiction', ['Fiction']],
    ['Latin American fiction', ['Fiction']],
    ['Travel, fiction', ['Fiction']],
    ['Young women, fiction', ['Fiction']],
    ['Discworld (imaginary place), fiction', ['Fiction']],
    ['History', ['History']],
    ['Philosophy', ['Philosophy']],
    // Noise: dropped
    ['History and criticism', []],
    ['Criticism and interpretation', []],
    ['nyt:hardcover-fiction=2014-03-02', []],
    ['award:hugo_award=1966', []],
    ['series:Harry_Potter', []],
    ['New York Times bestseller', []],
    ['Open Library Staff Picks', []],
    ['Large type books', []],
    ['Reading Level-Grade 7', []],
    ['Translations into Arabic', []],
    ['Spanish language materials', []],
    ['Accessible book', []],
    ['Protected DAISY', []],
    ['In library', []],
    ['Discworld (Imaginary place)', []],
    ['Harry Potter (Fictitious character)', []],
    // Unknown subjects are ignored, never invented as genres
    ['Dollhouses', []],
    ['Motion picture industry', []],
    ['humour', []],
    ['Wizards', []],
    ['Hogwarts School of Witchcraft and Wizardry (Imaginary place)', []],
    // Google Books BISAC categories and the card's examples
    ['Fiction / Fantasy / Humorous', ['Fantasy', 'Fiction']],
    ['Fiction / Classics', ['Literary Fiction', 'Fiction']],
    ['Fiction / Romance / Historical / Regency', ['Romance', 'Historical Fiction', 'Fiction']],
    ['Fiction / Mystery & Detective / Cozy', ['Mystery', 'Fiction']],
    ['Fiction / Thrillers / Espionage', ['Thriller', 'Fiction']],
    ['Juvenile Fiction / Fantasy & Magic', ["Children's", 'Fantasy']],
    ['Young Adult Fiction / Romance / General', ['Young Adult', 'Romance']],
    ['Comics & Graphic Novels / Manga / General', ['Graphic Novel']],
    ['Biography & Autobiography / Personal Memoirs', ['Memoir']],
    ['Biography & Autobiography / Historical', ['Memoir', 'Historical Fiction']],
    ['Cooking / Regional & Ethnic / Italian', ['Cookery']],
    ['Self-Help / Personal Growth / General', ['Self-Help']],
    ['Business & Economics / Management', ['Business']],
    ['Religion / Christian Life / General', ['Religion']],
    ['Poetry / American / General', ['Poetry']],
    ['Travel / Europe / France', ['Travel']],
    ['Detective and mystery stories', ['Mystery']],
    ['Ghost stories', ['Horror']],
    ['Juvenile Fiction', ["Children's"]],
    ['A very long Library of Congress heading about a particular county -- history -- 19th century', []],
  ])('%p → %p', (subject, genres) => {
    expect(normaliseGenres([subject], { minShare: 0 })).toEqual(genres);
  });
});

describe('normaliseGenres: whole books from the recorded fixtures', () => {
  const { editions, works } = olFixtures;
  type WithSubjects = Record<string, { subjects?: string[] }>;
  const subjectsOf = (book: keyof typeof works) => [
    ...((editions as WithSubjects)[book].subjects ?? []),
    ...((works as WithSubjects)[book].subjects ?? []),
  ];

  it.each<[keyof typeof works, string[]]>([
    ['colourOfMagic', ['Fantasy', 'Fiction']],
    ['movingPictures', ['Fantasy', 'Fiction']],
    ['fellowship', ['Fantasy', 'Fiction']],
    // Tagged "Children's fiction" and "Fantasy fiction" too: outvoted.
    ['theMartian', ['Science Fiction', 'Fiction']],
    ['dune', ['Science Fiction', 'Fiction']],
    ['philosophersStone', ["Children's", 'Fantasy', 'Fiction']],
    // Also tagged "History": halved because the subjects say it is a novel.
    ['prideAndPrejudice', ['Romance', 'Literary Fiction', 'Historical Fiction']],
    ['petitPrince', ["Children's", 'Fiction']],
    ['cienAnos', ['Literary Fiction', 'Fiction']],
    ['noDescription', []],
  ])('%s → %p', (book, genres) => {
    expect(normaliseGenres(subjectsOf(book))).toEqual(genres);
  });

  it('never returns more than three genres, or more than asked', () => {
    const many = ['Fantasy', 'Science fiction', 'Mystery', 'Romance', 'Horror', 'Fiction'];
    expect(normaliseGenres(many)).toHaveLength(3);
    expect(normaliseGenres(many, { max: 1 })).toEqual(['Fantasy']);
  });

  it('counts a repeated subject once', () => {
    expect(scoreGenres(['Fantasy', 'fantasy', 'FANTASY'])).toEqual([{ genre: 'Fantasy', score: 1 }]);
  });

  it('keeps non-fiction for non-fiction books', () => {
    expect(normaliseGenres(['History', 'World War, 1939-1945', 'Military history', 'Biography'])).toEqual(['History', 'Biography']);
  });

  it('only ever returns curated genres', () => {
    const everything = [...Object.keys(works)].flatMap((b) => subjectsOf(b as keyof typeof works));
    for (const genre of normaliseGenres(everything, { max: 99, minShare: 0 })) {
      expect(curatedGenres).toContain(genre);
    }
  });
});
