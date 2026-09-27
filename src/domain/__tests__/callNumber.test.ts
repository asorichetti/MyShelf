import { callNumber } from '@/domain';

describe('callNumber', () => {
  it('reads like a catalogue card: class, author mark, year', () => {
    expect(callNumber({ genres: ['Fantasy'], author: 'Pratchett, Terry', title: 'Mort', year: 1987 })).toBe('FIC PRA 1987');
  });

  it('classes non-fiction by subject', () => {
    expect(callNumber({ genres: ['History'], author: 'Beard, Mary', title: 'SPQR', year: 2015 })).toBe('HIS BEA 2015');
    expect(callNumber({ genres: ['Memoir', 'History'], author: 'Obama, Michelle', title: 'Becoming', year: 2018 })).toBe('BIO OBA 2018');
    expect(callNumber({ genres: ['Cookery'], author: 'Ottolenghi, Yotam', title: 'Plenty', year: 2010 })).toBe('COO OTT 2010');
  });

  it.each<[string[], string]>([
    // As the book page lists them: alphabetically. "Fiction" sorts before "Memoir".
    [['Fiction', 'Memoir'], 'BIO'],
    [['Memoir'], 'BIO'],
    [['Biography', 'Cookery'], 'BIO'],
    [['Business', 'Self-Help'], 'SLF'],
    [['History', 'Science'], 'HIS'],
    [['Cookery', 'Reference'], 'COO'],
    [['Fiction', 'Science'], 'SCI'],
    // A kind of novel says fiction, whatever else is there.
    [['Historical Fiction', 'History'], 'FIC'],
    [['Fantasy', 'Fiction', 'Horror'], 'FIC'],
    [['Fiction', 'Literary Fiction', 'Romance'], 'FIC'],
    // Audience and form have their own shelves.
    [["Children's", 'Fantasy', 'Fiction'], 'JUV'],
    [["Children's", 'Science'], 'JUV'],
    [['Fantasy', 'Young Adult'], 'YA'],
    [['Graphic Novel', 'History', 'Memoir'], 'GN'],
    [['Fiction', 'Poetry'], 'POE'],
    [['Fiction'], 'FIC'],
    [['Fiction', 'Gardening'], 'FIC'],
    [['Gardening', 'Memoir'], 'BIO'],
  ])('classes %p as %s, whatever their order', (genres, cls) => {
    expect(callNumber({ genres, author: 'Giuffre, Virginia Roberts', title: "Nobody's Girl", year: 2025 })).toBe(`${cls} GIU 2025`);
    expect(callNumber({ genres: [...genres].reverse(), author: 'Giuffre, Virginia Roberts', title: "Nobody's Girl", year: 2025 })).toBe(`${cls} GIU 2025`);
  });

  it('uses the first letters of an unknown genre, GEN with none', () => {
    expect(callNumber({ genres: ['Gardening'], author: null, title: 'Soil', year: null })).toBe('GAR SOI');
    expect(callNumber({ genres: [], author: 'Austen, Jane', title: 'Emma', year: 1815 })).toBe('GEN AUS 1815');
  });

  it('takes the surname from a plain name, handles particles and accents', () => {
    expect(callNumber({ genres: ['Fiction'], author: 'Frank Herbert', title: 'Dune', year: 1965 })).toBe('FIC HER 1965');
    expect(callNumber({ genres: ['Fantasy'], author: 'Le Guin, Ursula K.', title: 'Tehanu', year: 1990 })).toBe('FIC LEG 1990');
    expect(callNumber({ genres: ['Fiction'], author: 'Émile Zola', title: 'Germinal', year: 1885 })).toBe('FIC ZOL 1885');
    expect(callNumber({ genres: ['Fiction'], author: 'Zola, Émile', title: 'Nana', year: 1880 })).toBe('FIC ZOL 1880');
    expect(callNumber({ genres: ['Fiction'], author: 'Øster', title: 'x', year: null })).toBe('FIC OST');
  });

  it('spells out letters Unicode cannot take an accent off (Ø, Æ, Œ, Ł, ß, Þ, Đ)', () => {
    const mark = (author: string) => callNumber({ genres: ['Fiction'], author, title: 'x', year: null }).split(' ')[1];
    expect(mark('Øster')).toBe('OST');
    expect(mark('Æsop')).toBe('AES');
    expect(mark('Œuvre, Anon')).toBe('OEU');
    expect(mark('Stanisław Łem')).toBe('LEM');
    expect(mark('Heinz Straße')).toBe('STR');
    expect(mark('ẞeta')).toBe('SSE');
    expect(mark('Þórarinn')).toBe('THO');
    expect(mark('Đorđević')).toBe('DOR');
    expect(mark('Ðorður')).toBe('DOR');
    expect(callNumber({ genres: ['Ævintýri'], author: null, title: 'Øy', year: null })).toBe('AEV OY');
  });

  it('files an authorless book under its title, ignoring a leading article', () => {
    expect(callNumber({ genres: ['Poetry'], author: null, title: 'The Mabinogion', year: null })).toBe('POE MAB');
  });
});
