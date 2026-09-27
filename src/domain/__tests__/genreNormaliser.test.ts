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
    // "Nonfiction" is not a kind of fiction
    ['Nonfiction', []],
    ['Non-Fiction', []],
    ['Adult Nonfiction', []],
    ['Juvenile Nonfiction', ["Children's"]],
    ['Biographical fiction', ['Historical Fiction']],
    ['Autobiographical fiction', ['Literary Fiction']],
    ['Algorithms', ['Science']],
    ['Computer programming', ['Science']],
    ['Romance literature', []],
    // A path with nothing between its slashes.
    ['/', []],
    [' / / ', []],
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
    // Under a non-fiction heading, "Historical" is the topic, not historical fiction.
    ['Biography & Autobiography / Historical', ['Memoir']],
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

describe('normaliseGenres: non-fiction signals (real Open Library subjects, September 2026)', () => {
  // Work subjects as Open Library sends them (long lists trimmed to their first 25 or so).
  const books: Record<string, string[]> = {
    // OL44269610W: "Nonfiction" used to read as Fiction, so the memoir got "Fiction" and "FIC".
    nobodysGirl: ['Memoir', 'Nonfiction', 'True Crime'],
    // OL17930367W: the work folds in the young readers' edition ("…, juvenile literature").
    becoming: [
      'Presidentes', "Legislators' spouses", "Presidents' spouses", 'African American women lawyers', 'Biography', 'Biografía',
      'biography & autobiography', 'women', 'state & local history', 'history', 'Personal Memoirs', 'Cultural, Ethnic & Regional',
      'Obama, michelle, 1964-', 'Lawyers, illinois, biography', 'African americans, biography', 'Women, united states, biography',
      'nyt:combined-print-and-e-book-nonfiction=2018-12-02', 'New York Times bestseller', 'BIOGRAPHY & AUTOBIOGRAPHY / Women',
      'HISTORY / United States / State & Local / General', 'United states, history', 'Obama, michelle, 1964-, juvenile literature',
      'African americans, biography, juvenile literature', 'Women, biography, juvenile literature',
      'Presidents, united states, juvenile literature', 'African americans, juvenile literature', 'Women, biography', 'Juvenile literature',
    ],
    // OL17075811W: "Non-Fiction", and a comic adaptation folded into the work.
    sapiens: [
      'Technology and civilization', 'Human beings', 'Historical Chronology', 'Historia universal', 'Historia', 'Civilization',
      'World history', 'History', 'Non-Fiction', 'Science', 'SCIENCE / Life Sciences / General', 'SCIENCE / General',
      'SCIENCE / Life Sciences / Evolution', 'Civilization, history', 'Chronology, historical', 'Histoire', 'Life Sciences', 'Evolution',
      'nyt:paperback-nonfiction=2018-06-03', 'Comics & graphic novels, adaptations', 'Psychology', 'Economic history', 'Anthropology',
      'Comic books, strips',
    ],
    kitchenConfidential: ['New york (n.y.), biography', 'Gastronomy', 'Cooks, biography'],
    atomicHabits: [
      'Habit', 'Habit breaking', 'Behavior modification', 'Self-actualization (psychology)', 'Business', 'psychology', 'Personal Growth',
      'New York Times bestseller', 'BUSINESS & ECONOMICS / Organizational Behavior', 'PSYCHOLOGY / Social Psychology',
      'SELF-HELP / Personal Growth / General.',
    ],
    saltFatAcidHeat: ['Cooking', 'regional & ethnic cooking', 'cooking methods', 'reference', 'New York Times bestseller'],
    introductionToAlgorithms: ['Computer programming', 'Computer algorithms', 'Algorithms', 'open_syllabus_project', 'Programming', 'Algorithmes'],
    essays: ['Essays', 'American essays', 'Nonfiction', 'History'],
    cookbook: ['Cookbooks', 'Cooking, Italian', 'Cooking / Regional & Ethnic / Italian'],
    // Novels keep "Fiction", even when a stray topic tag says History or a record says "Epic poems".
    practicalMagic: [
      'Fiction', 'Women in fiction', 'Women', 'Witches', 'Witches in fiction', 'Massachusetts in fiction', 'Witchcraft', 'Fantasy fiction',
      'Occult fiction', 'Witchcraft in fiction', 'Paranormal fiction', 'Large type books', 'Fiction, fantasy, paranormal',
      'Fiction, occult & supernatural', 'Fiction, family life', 'Sisters, fiction', 'Massachusetts, fiction', 'Wiccans',
    ],
    problematicSummerRomance: [
      'Romance', 'Contemporary', 'Summer', 'Contemporary Romance', 'Fiction', 'Adult', 'Fiction, romance, friends to lovers',
      'Fiction, romance, contemporary',
    ],
    cienAnos: [
      'Spanish language books', 'Fiction', 'Social conditions', 'Macondo (Imaginary place)', 'novel', 'magic realism', 'Novela',
      'Literatura épica', 'Epic literature', 'Ficción', 'Latin American fiction', 'Spanish fiction', 'Colombian fiction',
      'Magic realism (Literature)', 'Romans, nouvelles', 'Fiction, general', 'Spanish American fiction', 'Romance literature',
      'Romans, nouvelles, etc. pour la jeunesse', 'Epic poems', 'Fantasy', 'Literature',
    ],
    historicalNovel: ['Fiction', 'Historical fiction', 'History', 'Fiction, historical, general', 'World War, 1939-1945, fiction'],
    // A picture book stays a children's book.
    gruffalo: [
      'Animals', 'Juvenile fiction', 'Fiction', 'Stories in rhyme', 'Mice', 'Children’s Picture Books', "Children's fiction", 'Mice, fiction',
      'Monsters, fiction', 'Animals, fiction', 'juvenile literature',
    ],
  };

  it.each<[string, string[]]>([
    ['nobodysGirl', ['Memoir']],
    ['becoming', ['Biography', 'Memoir', 'History']],
    ['sapiens', ['Science', 'History']],
    ['kitchenConfidential', ['Biography', 'Cookery']],
    ['atomicHabits', ['Business', 'Self-Help']],
    ['saltFatAcidHeat', ['Cookery', 'Reference']],
    ['introductionToAlgorithms', ['Science']],
    ['essays', ['History']],
    ['cookbook', ['Cookery']],
    ['practicalMagic', ['Fantasy', 'Horror', 'Fiction']],
    ['problematicSummerRomance', ['Romance', 'Fiction']],
    ['cienAnos', ['Literary Fiction', 'Fantasy', 'Fiction']],
    ['historicalNovel', ['Historical Fiction', 'Fiction']],
    ['gruffalo', ["Children's", 'Fiction']],
  ])('%s → %p', (book, genres) => {
    expect(normaliseGenres(books[book])).toEqual(genres);
  });

  it("a couple of children's tags on a much-tagged novel do not make it a children's book", () => {
    // Open Library's search subjects for OL274505W also carry "Juvenile fiction" (a school edition).
    expect(normaliseGenres([...books.cienAnos, 'Juvenile fiction'])).toEqual(['Literary Fiction', 'Fantasy', 'Fiction']);
  });

  it('never calls a book with non-fiction signals "Fiction" unless fiction outweighs them', () => {
    for (const book of ['nobodysGirl', 'becoming', 'sapiens', 'kitchenConfidential', 'atomicHabits', 'saltFatAcidHeat', 'essays', 'cookbook']) {
      expect(normaliseGenres(books[book], { max: 99, minShare: 0 })).not.toContain('Fiction');
    }
  });
});
