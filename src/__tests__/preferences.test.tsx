import { act, fireEvent, renderHook, screen, waitFor } from 'expo-router/testing-library';

import { settingsRepo, StaticDatabaseProvider, type Db } from '@/db';
import { defaultDueDate, formatDate, getDateFormat, setDateFormat, setToday } from '@/domain';
import { coversAllowedNow } from '@/features/covers';
import { useLend } from '@/features/loans/useLend';
import { PreferencesScreen } from '@/features/settings/PreferencesScreen';
import { SettingsWatchers } from '@/features/settings/SettingsWatchers';
import { loadShelfPrefs } from '@/features/shelf/useShelfPrefs';
import { createTestDb } from '@/testing/createTestDb';
import { renderApp } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

import type { ReactNode } from 'react';

const S = Testids.settings;
let db: Db;
beforeEach(async () => {
  setToday('2026-06-20');
  db = await createTestDb();
});
afterEach(async () => {
  setToday(null);
  setDateFormat('medium');
  await db.close();
});

async function openPreferences() {
  renderApp(db, '/settings/preferences', { 'settings/preferences': PreferencesScreen });
  await screen.findByTestId(S.sort);
}

async function choose(trigger: string, option: string) {
  await act(async () => fireEvent.press(screen.getByTestId(trigger)));
  await act(async () => fireEvent.press(screen.getByRole('radio', { name: option })));
}

describe('Preferences screen', () => {
  it('has one h1 and a labelled field for each preference', async () => {
    await openPreferences();
    expect(screen.getAllByRole('heading').filter((h) => h.props['aria-level'] === 1).map((h) => h.props.children)).toEqual(['Shelf and lending']);
    expect(screen.getByTestId(S.sort).props.accessibilityLabel).toBe('Sort the shelf by: Title, A to Z');
    expect(screen.getByTestId(S.groupBy).props.accessibilityLabel).toBe('Split the shelf into sections by: No sections');
    expect(screen.getByTestId(S.viewMode).props.accessibilityLabel).toBe('Show books as: List');
    expect(screen.getByTestId(S.loanLength).props.accessibilityLabel).toBe('Lend books for: 28 days (4 weeks)');
    expect(screen.getByTestId(S.dateFormat).props.accessibilityLabel).toBe('Write dates as: Day month year (12 Oct 2026)');
  });

  it('saves the Shelf defaults the Shelf then opens with', async () => {
    await openPreferences();
    await choose(S.sort, 'Year, newest first');
    await choose(S.groupBy, 'Series');
    await choose(S.viewMode, 'Covers');
    await waitFor(async () => expect(await loadShelfPrefs(db)).toMatchObject({ sort: { sort: 'year', direction: 'desc' }, groupBy: 'series', viewMode: 'covers' }));
  });

  it('saves a loan length the lend sheet then offers', async () => {
    await openPreferences();
    await choose(S.loanLength, '14 days (2 weeks)');
    await waitFor(async () => expect(await settingsRepo.getSetting(db, 'loanDays')).toBe(14));
    const wrapper = ({ children }: { children: ReactNode }) => <StaticDatabaseProvider db={db}>{children}</StaticDatabaseProvider>;
    const { result } = renderHook(() => useLend(), { wrapper });
    await waitFor(() => expect(result.current.loanDays).toBe(14));
    expect(defaultDueDate('2026-06-20', result.current.loanDays)).toBe('2026-07-04');
  });

  it('takes a custom loan length and refuses nonsense', async () => {
    await openPreferences();
    await choose(S.loanLength, 'Custom…');
    const input = screen.getByTestId(S.loanLengthCustom);
    fireEvent.changeText(input, '0');
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Use this length' })));
    expect(screen.getByText('Enter a number of days from 1 to 365.')).toBeOnTheScreen();
    fireEvent.changeText(input, '10');
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Use this length' })));
    await waitFor(async () => expect(await settingsRepo.getSetting(db, 'loanDays')).toBe(10));
    expect(screen.getByTestId(S.loanLength).props.accessibilityLabel).toBe('Lend books for: 10 days (custom)');
  });

  it('writes dates in the chosen format, everywhere', async () => {
    await openPreferences();
    expect(screen.getByTestId(S.dateExample)).toHaveTextContent('Today is written 20 Jun 2026.');
    await choose(S.dateFormat, 'Year-month-day (2026-10-12)');
    await waitFor(() => expect(screen.getByTestId(S.dateExample)).toHaveTextContent('Today is written 2026-06-20.'));
    expect(await settingsRepo.getSetting(db, 'dateFormat')).toBe('iso');
  });
});

describe('preferences reach their consumers', () => {
  it('SettingsWatchers applies the date format to formatDate at start-up and on change', async () => {
    await settingsRepo.setSetting(db, 'dateFormat', 'iso');
    renderApp(db, '/settings/preferences', {
      'settings/preferences': function WithWatchers() {
        return (
          <>
            <PreferencesScreen />
            <SettingsWatchers />
          </>
        );
      },
    });
    await waitFor(() => expect(getDateFormat()).toBe('iso'));
    expect(formatDate('2026-06-20')).toBe('2026-06-20');
    await choose(S.dateFormat, 'Day month year (12 Oct 2026)');
    await waitFor(() => expect(getDateFormat()).toBe('medium'));
  });

  it('holds the cover backfill on mobile data only when asked to', async () => {
    const onMobile = async () => true;
    const onWifi = async () => false;
    expect(await coversAllowedNow(db, onMobile)).toBe(true);
    await settingsRepo.setSetting(db, 'coversOnMobileData', false);
    expect(await coversAllowedNow(db, onMobile)).toBe(false);
    expect(await coversAllowedNow(db, onWifi)).toBe(true);
  });
});
