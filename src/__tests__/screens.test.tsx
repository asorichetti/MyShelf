import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ComponentType } from 'react';

import { BookyProvider, BookyTipHost } from '@/components/booky';
import { booksRepo, StaticDatabaseProvider, type Db } from '@/db';
import { GroupsScreen } from '@/features/groups/GroupsScreen';
import { LoansScreen } from '@/features/loans/LoansScreen';
import { NotFoundScreen } from '@/features/navigation/NotFoundScreen';
import { ScanScreen } from '@/features/scan/ScanScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { ShelfScreen } from '@/features/shelf/ShelfScreen';
import { createTestDb } from '@/testing/createTestDb';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

function renderScreen(Component: ComponentType) {
  return renderWithTheme(
    <StaticDatabaseProvider db={db}>
      <BookyProvider>
        <Component />
        <BookyTipHost />
      </BookyProvider>
    </StaticDatabaseProvider>,
  );
}

/** Lets async effects (the Shelf's book count) finish inside act(). */
const settle = () => waitFor(() => expect(screen.getAllByRole('heading').length).toBeGreaterThan(0));

const h1s = () => screen.getAllByRole('heading').filter((h) => h.props['aria-level'] === 1);

const cases: [string, ComponentType, string, string, string][] = [
  ['Shelf', ShelfScreen, Testids.home.root, Testids.home.title, 'MyShelf'],
  ['Scan', ScanScreen, Testids.scan.root, Testids.scan.title, 'Scan a book'],
  ['Loans', LoansScreen, Testids.loans.root, Testids.loans.title, 'Loans'],
  ['Groups', GroupsScreen, Testids.groups.root, Testids.groups.title, 'Groups'],
  ['Settings', SettingsScreen, Testids.settings.root, Testids.settings.title, 'Settings'],
  ['Not found', NotFoundScreen, Testids.notFound.root, Testids.notFound.title, 'Page not found'],
];

describe.each(cases)('%s screen', (_name, Component, rootId, titleId, titleText) => {
  it('has exactly one h1, a main landmark and the page-content marker', async () => {
    renderScreen(Component);
    await settle();
    expect(h1s()).toHaveLength(1);
    expect(h1s()[0]).toBe(screen.getByTestId(titleId));
    expect(screen.getByTestId(titleId)).toHaveTextContent(titleText);
    expect(screen.getByTestId(rootId).props.role).toBe('main');
    expect(screen.getByTestId(Testids.pageState.content)).toContainElement(screen.getByTestId(rootId));
  });

  it('shows Booky in an empty state', async () => {
    renderScreen(Component);
    await settle();
    expect(screen.getByLabelText(/^Booky the bookmark/)).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.emptyState.root)).toBeOnTheScreen();
  });
});

describe('Shelf screen contract', () => {
  it('keeps the MyShelf h1 with the home.title testid inside page-content', async () => {
    renderScreen(ShelfScreen);
    await screen.findByTestId(Testids.home.bookCount);
    const title = screen.getByTestId(Testids.home.title);
    expect(title).toHaveTextContent('MyShelf');
    expect(title.props.role).toBe('heading');
    expect(title.props['aria-level']).toBe(1);
    expect(screen.getByTestId(Testids.pageState.content)).toContainElement(title);
  });

  it('shows the catalogue size from the database', async () => {
    await booksRepo.createBook(db, { title: 'Emma' });
    await booksRepo.createBook(db, { title: 'Dune' });
    renderScreen(ShelfScreen);
    expect(await screen.findByTestId(Testids.home.bookCount)).toHaveTextContent('2 books catalogued');
  });

  it('opens a Booky tip on request', async () => {
    renderScreen(ShelfScreen);
    await screen.findByTestId(Testids.home.bookCount);
    fireEvent.press(screen.getByTestId(Testids.home.askBooky));
    expect(screen.getByTestId(Testids.booky.bubble)).toBeOnTheScreen();
  });
});

describe('Not found screen', () => {
  it('shows a concerned Booky', () => {
    renderScreen(NotFoundScreen);
    expect(screen.getByLabelText('Booky the bookmark, looking concerned')).toBeOnTheScreen();
  });
});
