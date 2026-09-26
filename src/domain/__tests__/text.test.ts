import { authorKey, bookMatchKey, normaliseText, sameAuthor, stripDiacritics, titleKey } from '../text';

describe('normaliseText', () => {
  it.each([
    ['The Colour of Magic', 'colour of magic'],
    ['THE COLOUR OF MAGIC', 'colour of magic'],
    ["Harry Potter and the Philosopher's Stone", 'harry potter and the philosophers stone'],
    ['Harry Potter & the Philosopher’s Stone', 'harry potter and the philosophers stone'],
    ['Cien años de soledad', 'cien anos de soledad'],
    ['Le Petit Prince', 'petit prince'],
    ["L'Étranger", 'etranger'],
    ['Guards! Guards!', 'guards guards'],
    ['A Game of Thrones', 'game of thrones'],
    ['An Abundance of Katherines', 'abundance of katherines'],
    ['Die Verwandlung', 'verwandlung'],
    ['El amor en los tiempos del cólera', 'amor en los tiempos del colera'],
    ['  Dune:   Deluxe   Edition ', 'dune deluxe edition'],
    ['Straße', 'strasse'],
    ['Świat Dysku', 'swiat dysku'],
    ['Catch-22', 'catch 22'],
    ['The', 'the'],
    ['A', 'a'],
  ])('%p → %p', (input, expected) => {
    expect(normaliseText(input)).toBe(expected);
  });

  it('can keep a leading article', () => {
    expect(normaliseText('The Expanse', { dropArticle: false })).toBe('the expanse');
  });
});

describe('stripDiacritics', () => {
  it('folds accents and special letters, keeping case', () => {
    expect(stripDiacritics('Gabriel García Márquez')).toBe('Gabriel Garcia Marquez');
    expect(stripDiacritics('Łódź Øresund Æsop')).toBe('Lodz Oresund Aesop');
    expect(stripDiacritics('Saint-Exupéry')).toBe('Saint-Exupery');
  });
});

describe('titleKey', () => {
  it.each([
    ['The Colour of Magic', 'colour of magic'],
    ['The Colour of Magic: A Discworld Novel', 'colour of magic'],
    ['Dune - Deluxe Edition', 'dune'],
    ['Catch-22', 'catch 22'],
    ['Pride and Prejudice', 'pride and prejudice'],
  ])('%p → %p', (title, key) => {
    expect(titleKey(title)).toBe(key);
  });
});

describe('authorKey / sameAuthor', () => {
  it.each([
    ['Terry Pratchett', 'pratchett'],
    ['J.R.R. Tolkien', 'tolkien'],
    ['J. R. R. Tolkien', 'tolkien'],
    ['Tolkien, J. R. R.', 'tolkien'],
    ['Austen, Jane', 'austen'],
    ['García Márquez, Gabriel', 'garcia marquez'],
    ['Gabriel García Márquez', 'marquez'],
    ['Antoine de Saint-Exupéry', 'exupery'],
    ['', ''],
  ])('%p → %p', (name, key) => {
    expect(authorKey(name)).toBe(key);
  });

  it.each([
    ['Terry Pratchett', 'Pratchett, Terry', true],
    ['J.R.R. Tolkien', 'J. R. R. Tolkien', true],
    ['García Márquez, Gabriel', 'Gabriel Garcia Marquez', true],
    ['Terry Pratchett', 'Neil Gaiman', false],
    ['', 'Neil Gaiman', false],
  ])('%p ~ %p: %p', (a, b, expected) => {
    expect(sameAuthor(a, b)).toBe(expected);
  });
});

describe('bookMatchKey', () => {
  it('matches the same book across providers', () => {
    expect(bookMatchKey('The Colour of Magic', 'Terry Pratchett')).toBe(bookMatchKey('Colour of Magic', 'Pratchett, Terry'));
    expect(bookMatchKey('Cien años de soledad', 'Gabriel García Márquez')).toBe(
      bookMatchKey('Cien Anos De Soledad', 'García Márquez, Gabriel'),
    );
  });

  it('separates different books and authors', () => {
    expect(bookMatchKey('Dune', 'Frank Herbert')).not.toBe(bookMatchKey('Dune Messiah', 'Frank Herbert'));
    expect(bookMatchKey('Dune', 'Frank Herbert')).not.toBe(bookMatchKey('Dune', 'Kevin J. Anderson'));
    expect(bookMatchKey('Dune', null)).toBe('dune|');
  });
});
