import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { Share, Text } from 'react-native';

import { type Db } from '@/db';
import { armCrash } from '@/features/e2e/crashSwitch';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { createTestDb } from '@/testing/createTestDb';
import { renderApp } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

const T = Testids.errorBoundary;

let mockBroken = true;
/** A screen that throws while rendering until the test mends it. */
function Fragile({ name }: { name: string }) {
  if (mockBroken) throw new Error(`${name} fell off the shelf`);
  return <Text>{`${name} is fine`}</Text>;
}
const LoansThatThrow = () => <Fragile name="Loans" />;
const BookThatThrows = () => <Fragile name="The book" />;

let db: Db;
let consoleError: jest.SpyInstance;
const originalE2e = process.env.EXPO_PUBLIC_E2E;
beforeEach(async () => {
  mockBroken = true;
  db = await createTestDb();
  // React reports every caught render error on the console; these are on purpose.
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => {
  consoleError.mockRestore();
  process.env.EXPO_PUBLIC_E2E = originalE2e;
  await db.close();
});

describe('screen error boundaries (P09-04)', () => {
  it('a tab that throws shows concerned Booky with Try again; the tab bar and other tabs keep working', async () => {
    renderApp(db, '/loans', { '(tabs)/loans': LoansThatThrow });
    expect(await screen.findByTestId(T.root)).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.pageState.error)).toBeOnTheScreen();
    expect(screen.getByTestId(T.title)).toHaveTextContent('Something went wrong here');
    expect(screen.getAllByRole('heading').filter((h) => h.props['aria-level'] === 1)).toHaveLength(1);
    expect(screen.getByTestId(T.details)).toHaveTextContent('Error: Loans fell off the shelf');
    expect(screen.getByLabelText(/^Booky/)).toBeOnTheScreen();

    // The rest of the app is still there.
    await act(async () => fireEvent.press(screen.getByTestId(Testids.tabs.shelf)));
    expect(await screen.findByTestId(Testids.home.title)).toBeOnTheScreen();
    expect(screen.queryByTestId(T.root)).toBeNull();

    // Back on Loans it fails again until mended; then Try again brings it back.
    await act(async () => fireEvent.press(screen.getByTestId(Testids.tabs.loans)));
    expect(await screen.findByTestId(T.root)).toBeOnTheScreen();
    mockBroken = false;
    await act(async () => fireEvent.press(screen.getByTestId(T.retry)));
    expect(await screen.findByText('Loans is fine')).toBeOnTheScreen();
    expect(screen.queryByTestId(T.root)).toBeNull();
  });

  it('a stack screen that throws offers the way back to the Shelf', async () => {
    renderApp(db, '/book/1', { 'book/[id]': BookThatThrows });
    expect(await screen.findByTestId(T.root)).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Go to my shelf' })));
    expect(await screen.findByTestId(Testids.home.title)).toBeOnTheScreen();
  });

  it('copies the error details (the share sheet on a phone), and says so', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    renderApp(db, '/loans', { '(tabs)/loans': LoansThatThrow });
    await act(async () => fireEvent.press(await screen.findByTestId(T.copy)));
    expect(share).toHaveBeenCalledTimes(1);
    const text = share.mock.calls[0][0].message ?? '';
    expect(text).toMatch(/^MyShelf \d+\.\d+\.\d+/);
    expect(text).toContain('Screen: loans');
    expect(text).toContain('Error: Loans fell off the shelf');
    expect(await screen.findByTestId(T.copied)).toHaveTextContent(/Copied/);
    share.mockRestore();
  });

  it('the E2E crash trigger makes a real screen throw once it is armed, and only in E2E builds', async () => {
    delete process.env.EXPO_PUBLIC_E2E;
    armCrash('settings');
    renderApp(db, '/settings', { '(tabs)/settings': SettingsScreen });
    expect(await screen.findByTestId(Testids.settings.root)).toBeOnTheScreen();
    expect(screen.queryByTestId(T.root)).toBeNull();
  });

  it('the E2E crash trigger: the armed screen shows its boundary, and Try again renders it for real', async () => {
    process.env.EXPO_PUBLIC_E2E = '1';
    armCrash('settings');
    renderApp(db, '/settings', { '(tabs)/settings': SettingsScreen });
    expect(await screen.findByTestId(T.root)).toBeOnTheScreen();
    expect(screen.getByTestId(T.details)).toHaveTextContent('E2eCrash: E2E crash test: the settings screen threw on purpose');
    await act(async () => fireEvent.press(screen.getByTestId(T.retry)));
    await waitFor(() => expect(screen.getByTestId(Testids.settings.root)).toBeOnTheScreen());
  });
});
