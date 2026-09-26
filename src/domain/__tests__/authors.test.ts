import { toSortName } from '@/domain';

describe('toSortName', () => {
  it.each([
    ['Terry Pratchett', 'Pratchett, Terry'],
    ['J. R. R. Tolkien', 'Tolkien, J. R. R.'],
    ['  Ursula   K. Le Guin ', 'Le Guin, Ursula K.'],
    ['Ludwig van Beethoven', 'van Beethoven, Ludwig'],
    ['Martin Luther King Jr.', 'King, Martin Luther, Jr.'],
    ['Homer', 'Homer'],
    ['Arthur Conan Doyle', 'Doyle, Arthur Conan'],
    ['Daphne du Maurier', 'du Maurier, Daphne'],
    ['Gabriel García Márquez', 'Márquez, Gabriel García'],
    ['Walter M. Miller Jr', 'Miller, Walter M., Jr'],
    ['', ''],
  ])('%j -> %j', (name, sort) => {
    expect(toSortName(name)).toBe(sort);
  });
});
