import { fireEvent, screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';

import { BookyProvider, BookyTipHost } from '@/components/booky';
import { GroupsScreen } from '@/features/groups/GroupsScreen';
import { LoansScreen } from '@/features/loans/LoansScreen';
import { NotFoundScreen } from '@/features/navigation/NotFoundScreen';
import { ScanScreen } from '@/features/scan/ScanScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { ShelfScreen } from '@/features/shelf/ShelfScreen';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

function renderScreen(Component: ComponentType) {
  return renderWithTheme(
    <BookyProvider>
      <Component />
      <BookyTipHost />
    </BookyProvider>,
  );
}

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
  it('has exactly one h1, a main landmark and the page-content marker', () => {
    renderScreen(Component);
    expect(h1s()).toHaveLength(1);
    expect(h1s()[0]).toBe(screen.getByTestId(titleId));
    expect(screen.getByTestId(titleId)).toHaveTextContent(titleText);
    expect(screen.getByTestId(rootId).props.role).toBe('main');
    expect(screen.getByTestId(Testids.pageState.content)).toContainElement(screen.getByTestId(rootId));
  });

  it('shows Booky', () => {
    renderScreen(Component);
    expect(screen.getByLabelText(/^Booky the bookmark/)).toBeOnTheScreen();
  });
});

describe('Shelf screen contract', () => {
  it('keeps the MyShelf h1 with the home.title testid inside page-content', () => {
    renderScreen(ShelfScreen);
    const title = screen.getByTestId(Testids.home.title);
    expect(title).toHaveTextContent('MyShelf');
    expect(title.props.role).toBe('heading');
    expect(title.props['aria-level']).toBe(1);
    expect(screen.getByTestId(Testids.pageState.content)).toContainElement(title);
  });

  it('opens a Booky tip on request', () => {
    renderScreen(ShelfScreen);
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
