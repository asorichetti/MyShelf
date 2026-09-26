import { renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { E2eScanScreen } from '@/features/e2e/E2eScanScreen';
import { NotFoundScreen } from '@/features/navigation/NotFoundScreen';
import { onInjectedScan, takeInjectedScan } from '@/features/scan/scanInjector';
import { AppTestProviders } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

// The route's test lives here, not beside it: every file under src/app is a route.
const original = process.env.EXPO_PUBLIC_E2E;
afterEach(() => {
  process.env.EXPO_PUBLIC_E2E = original;
  takeInjectedScan();
});

const routes = {
  scan: () => <Text testID="landed">scan</Text>,
  'e2e/scan': E2eScanScreen,
  '+not-found': NotFoundScreen,
};

describe('/e2e/scan (P03-07)', () => {
  it('hands an ISBN to the Scan tab and opens it', async () => {
    process.env.EXPO_PUBLIC_E2E = '1';
    const heard = jest.fn();
    const off = onInjectedScan(heard);
    const r = renderRouter(routes, { initialUrl: '/e2e/scan?isbn=9780552166591', wrapper: AppTestProviders });
    await waitFor(() => expect(r.getPathname()).toBe('/scan'));
    expect(heard).toHaveBeenCalled();
    expect(takeInjectedScan()).toEqual({ isbn: '9780552166591' });
    expect(takeInjectedScan()).toBeNull();
    off();
  });

  it('hands over cover text', async () => {
    process.env.EXPO_PUBLIC_E2E = '1';
    const r = renderRouter(routes, { initialUrl: '/e2e/scan?text=THE%20COLOUR%20OF%20MAGIC', wrapper: AppTestProviders });
    await waitFor(() => expect(r.getPathname()).toBe('/scan'));
    expect(takeInjectedScan()).toEqual({ text: 'THE COLOUR OF MAGIC' });
  });

  it('is inert without the E2E flag: not found, nothing injected', () => {
    delete process.env.EXPO_PUBLIC_E2E;
    const r = renderRouter(routes, { initialUrl: '/e2e/scan?isbn=9780552166591', wrapper: AppTestProviders });
    expect(screen.getByTestId(Testids.notFound.root)).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/e2e/scan');
    expect(takeInjectedScan()).toBeNull();
  });
});
