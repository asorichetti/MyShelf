import { joinNames, sortableTitle } from '@/domain';

describe('sortableTitle', () => {
  it.each([
    ['The Hobbit', 'Hobbit'],
    ['A Wizard of Earthsea', 'Wizard of Earthsea'],
    ['An Instance of the Fingerpost', 'Instance of the Fingerpost'],
    ['the lowercase', 'lowercase'],
    ['  The Padded  ', 'Padded'],
    ['Theodora', 'Theodora'],
    ['Anansi Boys', 'Anansi Boys'],
    ['A', 'A'],
    ['The', 'The'],
    ['Dune', 'Dune'],
  ])('%j files under %j', (title, expected) => {
    expect(sortableTitle(title)).toBe(expected);
  });
});

describe('joinNames', () => {
  it('joins names the way a person would read them', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['Terry Pratchett'])).toBe('Terry Pratchett');
    expect(joinNames(['Terry Pratchett', 'Neil Gaiman'])).toBe('Terry Pratchett and Neil Gaiman');
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C');
  });
});
