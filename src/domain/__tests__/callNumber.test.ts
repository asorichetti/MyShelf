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

  it('uses the first letters of an unknown genre, GEN with none', () => {
    expect(callNumber({ genres: ['Gardening'], author: null, title: 'Soil', year: null })).toBe('GAR SOI');
    expect(callNumber({ genres: [], author: 'Austen, Jane', title: 'Emma', year: 1815 })).toBe('GEN AUS 1815');
  });

  it('takes the surname from a plain name, handles particles and accents', () => {
    expect(callNumber({ genres: ['Fiction'], author: 'Frank Herbert', title: 'Dune', year: 1965 })).toBe('FIC HER 1965');
    expect(callNumber({ genres: ['Fantasy'], author: 'Le Guin, Ursula K.', title: 'Tehanu', year: 1990 })).toBe('FIC LEG 1990');
    expect(callNumber({ genres: ['Fiction'], author: 'Émile Zola', title: 'Germinal', year: 1885 })).toBe('FIC ZOL 1885');
    expect(callNumber({ genres: ['Fiction'], author: 'Zola, Émile', title: 'Nana', year: 1880 })).toBe('FIC ZOL 1880');
    expect(callNumber({ genres: ['Fiction'], author: 'Øster', title: 'x', year: null })).toBe('FIC STE');
  });

  it('files an authorless book under its title, ignoring a leading article', () => {
    expect(callNumber({ genres: ['Poetry'], author: null, title: 'The Mabinogion', year: null })).toBe('POE MAB');
  });
});
