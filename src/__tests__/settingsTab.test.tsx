import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { settingsRepo, type Db } from '@/db';
import { setToday } from '@/domain';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { renderApp, stubScreen } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

const S = Testids.settings;
let db: Db;
beforeEach(async () => {
  setToday('2026-06-20');
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(async () => {
  setToday(null);
  await db.close();
});

const routes = {
  'settings/preferences': stubScreen('preferences'),
  'settings/backup': stubScreen('backup'),
  'settings/restore': stubScreen('restore'),
  'settings/export-csv': stubScreen('export-csv'),
  'settings/import-csv': stubScreen('import-csv'),
  'settings/erase': stubScreen('erase'),
  'settings/about': stubScreen('about'),
  'settings/borrowers': stubScreen('borrowers'),
  'settings/pending': stubScreen('pending'),
};

async function openSettings() {
  renderApp(db, '/settings', routes);
  await screen.findByTestId(S.title);
  await waitFor(() => expect(screen.getByTestId(S.borrowers).props.accessibilityLabel).toMatch(/2 people/));
}

describe('Settings tab', () => {
  it('shows one h1 and the sections in order', async () => {
    await openSettings();
    const headings = screen.getAllByRole('heading');
    expect(headings.filter((h) => h.props['aria-level'] === 1).map((h) => h.props.children)).toEqual(['Settings']);
    expect(headings.filter((h) => h.props['aria-level'] === 2).map((h) => h.props.children)).toEqual(['Library', 'Lookups', 'Lending', 'Backup & data', 'About']);
  });

  it('gives every row a label, a value or explanation and a role', async () => {
    await openSettings();
    for (const id of [S.preferences, S.pending, S.borrowers, S.exportBackup, S.importBackup, S.exportCsv, S.importCsv, S.erase, S.about]) {
      const row = screen.getByTestId(id);
      expect({ id, role: row.props.role }).toEqual({ id, role: 'link' });
      expect(row.props.accessibilityLabel).toMatch(/, /);
    }
    for (const id of [S.googleBooksToggle, S.coversOnDataToggle, Testids.reminders.toggle]) {
      expect(screen.getByTestId(id).props.role).toBe('switch');
    }
    expect(screen.getByTestId(S.preferences).props.accessibilityLabel).toBe('Shelf and lending, Title, A to Z · lend for 28 days (4 weeks)');
    expect(screen.getByTestId(S.exportBackup).props.accessibilityLabel).toBe('Back up your library, Last: Never, Save a file you can restore on any phone');
    expect(screen.getByTestId(S.pending).props.accessibilityLabel).toBe('Pending lookups, None, ISBNs waiting for the internet');
  });

  it('turns Google Books off at once and remembers it', async () => {
    await openSettings();
    const toggle = screen.getByTestId(S.googleBooksToggle);
    expect(toggle.props.accessibilityState.checked).toBe(true);
    await act(async () => fireEvent.press(toggle));
    await waitFor(() => expect(screen.getByTestId(S.googleBooksToggle).props.accessibilityState.checked).toBe(false));
    expect(await settingsRepo.getSetting(db, 'googleBooksEnabled')).toBe(false);
    expect(screen.getByText('Only Open Library is asked for book details.')).toBeOnTheScreen();
  });

  it('switches covers on mobile data off', async () => {
    await openSettings();
    await act(async () => fireEvent.press(screen.getByTestId(S.coversOnDataToggle)));
    await waitFor(async () => expect(await settingsRepo.getSetting(db, 'coversOnMobileData')).toBe(false));
    expect(screen.getByText('Missing covers wait for Wi-Fi.')).toBeOnTheScreen();
  });

  it('shows the last backup date in the chosen format', async () => {
    await settingsRepo.setSetting(db, 'backup.lastAt', '2026-06-01T09:00:00.000Z');
    await openSettings();
    expect(screen.getByTestId(S.exportBackup).props.accessibilityLabel).toMatch(/^Back up your library, Last: 1 Jun 2026/);
  });

  it.each([
    [S.preferences, 'preferences'],
    [S.exportBackup, 'backup'],
    [S.importBackup, 'restore'],
    [S.exportCsv, 'export-csv'],
    [S.importCsv, 'import-csv'],
    [S.erase, 'erase'],
    [S.about, 'about'],
    [S.borrowers, 'borrowers'],
    [S.pending, 'pending'],
  ])('%s opens its screen', async (id, name) => {
    await openSettings();
    await act(async () => fireEvent.press(screen.getByTestId(id)));
    expect(await screen.findByText(`stub:${name}`)).toBeOnTheScreen();
  });
});
