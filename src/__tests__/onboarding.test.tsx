import { act, fireEvent, screen } from 'expo-router/testing-library';

import { settingsRepo, type Db } from '@/db';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { createTestDb } from '@/testing/createTestDb';
import { renderApp, stubScreen } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

jest.mock('@/features/e2e/e2eFlag', () => ({ isE2eEnabled: () => mockE2e, safeNextPath: (p: string) => p }));
let mockE2e = false;

let db: Db;
beforeEach(async () => {
  mockE2e = false;
  db = await createTestDb();
});
afterEach(async () => {
  await db.close();
});

const settle = async () => {
  for (let i = 0; i < 6; i++) await act(async () => {});
};

function start(url = '/') {
  return renderApp(db, url, {
    onboarding: OnboardingScreen,
    'e2e/index': stubScreen('e2e'),
  });
}

/** The gate lives in the root layout in the app; here it rides along with the Shelf. */
jest.mock('@/features/shelf/ShelfScreen', () => {
  const actual = jest.requireActual('@/features/shelf/ShelfScreen');
  const { OnboardingGate: Gate } = jest.requireActual('@/features/onboarding/OnboardingGate');
  return {
    ...actual,
    ShelfScreen: () => (
      <>
        <Gate />
        <actual.ShelfScreen />
      </>
    ),
  };
});

describe('onboarding (P07-03)', () => {
  it('sends a first launch to the onboarding, whose pager says where you are', async () => {
    const r = start();
    await settle();
    expect(r.getPathname()).toBe('/onboarding');
    expect(screen.getByTestId(Testids.onboarding.page)).toHaveTextContent('Page 1 of 4');
    expect(screen.getByTestId(Testids.onboarding.page).props.accessibilityLiveRegion).toBe('polite');
    expect(screen.getByRole('heading', { name: 'Welcome to MyShelf' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Booky the bookmark, smiling happily')).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.onboarding.back)).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Next: page 2 of 4' }));
    expect(screen.getByTestId(Testids.onboarding.page)).toHaveTextContent('Page 2 of 4');
    expect(screen.getByLabelText('Booky the bookmark, thinking')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId(Testids.onboarding.back));
    expect(screen.getByTestId(Testids.onboarding.page)).toHaveTextContent('Page 1 of 4');
    for (let i = 0; i < 3; i++) fireEvent.press(screen.getByTestId(Testids.onboarding.next));
    expect(screen.getByTestId(Testids.onboarding.page)).toHaveTextContent('Page 4 of 4');
    expect(screen.getByLabelText('Booky the bookmark, looking sleepy')).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.onboarding.next)).toBeNull();
    expect(screen.queryByTestId(Testids.onboarding.skip)).toBeNull();

    await act(async () => fireEvent.press(screen.getByTestId(Testids.onboarding.start)));
    await settle();
    expect(r.getPathname()).toBe('/scan');
    expect(await settingsRepo.getSetting(db, 'onboarding.done')).toBe(true);
  });

  it('skip marks it done and goes to the Shelf; it never comes back', async () => {
    const r = start();
    await settle();
    await act(async () => fireEvent.press(screen.getByTestId(Testids.onboarding.skip)));
    await settle();
    expect(r.getPathname()).toBe('/');
    expect(await settingsRepo.getSetting(db, 'onboarding.done')).toBe(true);
    screen.unmount();
    const again = start();
    await settle();
    expect(again.getPathname()).toBe('/');
  });

  it('"Look around first" goes to the Shelf', async () => {
    const r = start('/onboarding');
    await settle();
    for (let i = 0; i < 3; i++) fireEvent.press(screen.getByTestId(Testids.onboarding.next));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.onboarding.explore)));
    await settle();
    expect(r.getPathname()).toBe('/');
  });

  it('in E2E builds, only when the fixture asks', async () => {
    mockE2e = true;
    const quiet = start();
    await settle();
    expect(quiet.getPathname()).toBe('/');
    screen.unmount();
    await settingsRepo.setSetting(db, 'onboarding.done', false);
    const asked = start();
    await settle();
    expect(asked.getPathname()).toBe('/onboarding');
  });
});
