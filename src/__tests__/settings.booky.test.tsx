import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { settingsRepo, type Db } from '@/db';
import { createTestDb } from '@/testing/createTestDb';
import { renderApp, stubScreen } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const settle = async () => {
  for (let i = 0; i < 4; i++) await act(async () => {});
};
const checked = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.checked;

describe('Settings → Booky (P07-06)', () => {
  it('shows the saved mode and saves a new one', async () => {
    await settingsRepo.setSetting(db, 'bookyMode', 'quiet');
    renderApp(db, '/settings');
    await settle();
    expect(screen.getByLabelText('How chatty Booky is').props.role).toBe('radiogroup');
    expect(checked(Testids.bookySettings.modeQuiet)).toBe(true);
    expect(screen.getByText('Only problems, empty screens and help when you ask.')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByTestId(Testids.bookySettings.modeHelpful)));
    await waitFor(async () => expect(await settingsRepo.getSetting(db, 'bookyMode')).toBe('helpful'));
    expect(checked(Testids.bookySettings.modeHelpful)).toBe(true);
    expect(checked(Testids.bookySettings.modeQuiet)).toBe(false);
  });

  it('Off hides Booky, but help still works (as the help sheet)', async () => {
    renderApp(db, '/settings');
    await settle();
    expect(screen.getAllByLabelText(/^Booky the bookmark/).length).toBeGreaterThan(0);
    await act(async () => fireEvent.press(screen.getByTestId(Testids.bookySettings.modeOff)));
    await settle();
    expect(await settingsRepo.getSetting(db, 'bookyMode')).toBe('off');
    expect(screen.queryAllByLabelText(/^Booky the bookmark/)).toHaveLength(0);
    await act(async () => fireEvent.press(screen.getByTestId(Testids.booky.helpButton)));
    expect(screen.queryByTestId(Testids.booky.bubble)).toBeNull();
    expect(screen.getByTestId(Testids.booky.helpSheet)).toHaveTextContent(/How chatty is Booky\?/);
  });

  it('Reset tips forgets what Booky has shown and muted', async () => {
    await settingsRepo.setSetting(db, 'booky.seen', ['series-gap:3', 'scan-first-visit']);
    await settingsRepo.setSetting(db, 'mutedTips', ['book-added']);
    renderApp(db, '/settings');
    await settle();
    await act(async () => fireEvent.press(screen.getByTestId(Testids.bookySettings.resetTips)));
    await settle();
    expect(await settingsRepo.getSetting(db, 'booky.seen')).toEqual([]);
    expect(await settingsRepo.getSetting(db, 'mutedTips')).toEqual([]);
    expect(screen.getByTestId(Testids.snackbar.root)).toHaveTextContent(/show my tips again/);
  });

  it('shows the welcome tour again', async () => {
    const r = renderApp(db, '/settings', { onboarding: stubScreen('onboarding') });
    await settle();
    await act(async () => fireEvent.press(screen.getByTestId(Testids.bookySettings.tour)));
    expect(r.getPathname()).toBe('/onboarding');
  });
});
