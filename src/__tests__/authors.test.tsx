import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { authorsRepo, booksRepo, type Db } from '@/db';
import { AuthorDetailScreen } from '@/features/authors/AuthorDetailScreen';
import { AuthorsScreen } from '@/features/authors/AuthorsScreen';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { renderApp, stubScreen } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

/** findBy* with the fake timers renderRouter installs: poll through waitFor, which advances them. */
const findRole = (role: string, options: { name: string | RegExp }) => waitFor(() => screen.getByRole(role, options));
const findTestId = (id: string) => waitFor(() => screen.getByTestId(id));
const findAllTestId = (id: string) => waitFor(() => screen.getAllByTestId(id));
const findText = (text: string) => waitFor(() => screen.getByText(text));

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(() => db.close());

const routes = {
  'authors/index': AuthorsScreen,
  'authors/[id]': AuthorDetailScreen,
  'book/[id]': stubScreen('book'),
  'series/[id]': stubScreen('series'),
};
const idOf = async (name: string) => (await authorsRepo.findAuthorByName(db, name))!.id;

describe('Authors screen', () => {
  it('lists authors A-Z by surname with a letter index of accessible buttons', async () => {
    renderApp(db, '/authors', routes);
    await waitFor(() => expect(screen.getAllByTestId(Testids.authors.row)).toHaveLength(7));
    expect(screen.getAllByTestId(Testids.authors.row).map((r) => r.props.accessibilityLabel)).toEqual([
      'Jane Austen, 1 book',
      'Agatha Christie, 2 books',
      'Arthur Conan Doyle, 1 book',
      'Neil Gaiman, 1 book',
      'Frank Herbert, 1 book',
      'Ursula K. Le Guin, 3 books',
      'Terry Pratchett, 4 books',
    ]);
    const letters = screen.getAllByTestId(Testids.authors.letter);
    expect(letters.map((l) => l.props.accessibilityLabel)).toEqual(['Jump to A', 'Jump to C', 'Jump to D', 'Jump to G', 'Jump to H', 'Jump to L', 'Jump to P']);
    expect(screen.getByRole('button', { name: 'Jump to P' })).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Jump to P' })));
    expect(screen.getByRole('button', { name: 'Jump to P' }).props['aria-current']).toBe('true');
  });

  it('opens an author', async () => {
    const r = renderApp(db, '/authors', routes);
    const target = await findRole('link', { name: 'Terry Pratchett, 4 books' });
    await act(async () => fireEvent.press(target));
    expect(r.getPathname()).toBe(`/authors/${await idOf('Terry Pratchett')}`);
  });
});

describe('Author detail', () => {
  it('groups books by series in reading order, then standalone', async () => {
    renderApp(db, `/authors/${await idOf('Terry Pratchett')}`, routes);
    expect(await findTestId(Testids.authors.detailTitle)).toHaveTextContent('Terry Pratchett');
    const sections = await findAllTestId(Testids.authors.detailSection);
    expect(sections.map((s) => within(s).getByRole('heading').props.accessibilityLabel)).toEqual(['Discworld, 3 books', 'Standalone, 1 book']);
    expect(within(sections[0]).getAllByTestId(Testids.home.row).map((r) => r.props.accessibilityLabel.split(',')[0])).toEqual([
      'The Colour of Magic',
      'The Light Fantastic',
      'Mort',
    ]);
    expect(screen.getAllByRole('heading').filter((h) => h.props['aria-level'] === 1)).toHaveLength(1);
  });

  it('edits the name and sort name', async () => {
    renderApp(db, `/authors/${await idOf('Frank Herbert')}`, routes);
    const target = await findTestId(Testids.authors.edit);
    await act(async () => fireEvent.press(target));
    fireEvent.changeText(screen.getByTestId(Testids.authors.editName), 'Frank Patrick Herbert');
    fireEvent.changeText(screen.getByTestId(Testids.authors.editSortName), 'Herbert, Frank');
    await act(async () => fireEvent.press(screen.getByTestId(Testids.authors.editSave)));
    await waitFor(() => expect(screen.getByTestId(Testids.authors.detailTitle)).toHaveTextContent('Frank Patrick Herbert'));
    expect(await authorsRepo.getAuthor(db, await idOf('Frank Patrick Herbert'))).toMatchObject({ sortName: 'Herbert, Frank' });
  });

  it('merges a duplicate author into another and moves to the kept one', async () => {
    const dup = await authorsRepo.createAuthor(db, 'T. Pratchett');
    const book = await booksRepo.createBook(db, { title: 'Eric' });
    await authorsRepo.setBookAuthors(db, book.id, [{ authorId: dup.id }]);
    const r = renderApp(db, `/authors/${dup.id}`, routes);
    const target = await findTestId(Testids.authors.merge);
    await act(async () => fireEvent.press(target));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Terry Pratchett, 4 books' })));
    expect(screen.getByText('Merge into Terry Pratchett?')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByTestId(Testids.dialog.confirm)));
    const kept = await idOf('Terry Pratchett');
    await waitFor(() => expect(r.getPathname()).toBe(`/authors/${kept}`));
    expect(await authorsRepo.getAuthor(db, dup.id)).toBeNull();
    expect((await authorsRepo.listAuthorsForBook(db, book.id)).map((a) => a.name)).toEqual(['Terry Pratchett']);
  });
});
