import { genreSuggestions, starterGenres } from '@/domain';

describe('genreSuggestions', () => {
  it('offers the user’s genres first, then the starter list, without repeats', () => {
    expect(genreSuggestions(['Cosy Crime', 'fantasy'], [], '', 4)).toEqual(['Cosy Crime', 'fantasy', 'Fiction', 'Science Fiction']);
  });

  it('leaves out genres already chosen, ignoring case', () => {
    expect(genreSuggestions([], ['FICTION', 'Fantasy'], '', 2)).toEqual(['Science Fiction', 'Mystery']);
  });

  it('filters by the start of any word', () => {
    expect(genreSuggestions([], [], 'fic')).toEqual(['Fiction', 'Science Fiction', 'Historical Fiction', 'Literary Fiction']);
    expect(genreSuggestions([], [], 'help')).toEqual(['Self-Help']);
    expect(genreSuggestions([], [], 'zzz')).toEqual([]);
  });

  it('has the 25 starter genres from the plan', () => {
    expect(starterGenres).toHaveLength(25);
    expect(new Set(starterGenres.map((g) => g.toLowerCase())).size).toBe(25);
  });
});
