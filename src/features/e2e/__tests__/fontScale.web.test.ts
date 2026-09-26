/**
 * @jest-environment jsdom
 */
import { URLSearchParams as NodeURLSearchParams } from 'node:url';

import { e2eFontScale, FONT_SCALE_KEY } from '@/features/e2e/fontScale.web';

// The web build's rule (e2eFlag.web.ts): on unless a build opts out.
let mockE2e = true;

// Expo's lazy URL polyfill does not load under jsdom; the browser has its own.
Object.defineProperty(globalThis, 'URLSearchParams', { value: NodeURLSearchParams, configurable: true, writable: true });
jest.mock('@/features/e2e/e2eFlag', () => ({ isE2eEnabled: () => mockE2e }));

function visit(search: string) {
  window.history.replaceState(null, '', `/${search}`);
}

afterEach(() => {
  mockE2e = true;
  sessionStorage.clear();
  visit('');
});

describe('e2eFontScale (P09-01)', () => {
  it('is off by default', () => {
    expect(e2eFontScale()).toBeUndefined();
  });

  it('takes ?e2e-font-scale and keeps it for the rest of the tab (the fixture loader redirects)', () => {
    visit('?e2e-font-scale=2');
    expect(e2eFontScale()).toBe(2);
    visit('');
    expect(e2eFontScale()).toBe(2);
    expect(sessionStorage.getItem(FONT_SCALE_KEY)).toBe('2');
  });

  it('turns off with 1 and ignores nonsense or extremes', () => {
    sessionStorage.setItem(FONT_SCALE_KEY, '2');
    visit('?e2e-font-scale=1');
    expect(e2eFontScale()).toBeUndefined();
    for (const bad of ['abc', '0.5', '4']) {
      visit(`?e2e-font-scale=${bad}`);
      expect(e2eFontScale()).toBeUndefined();
    }
  });

  it('does nothing in a build without the E2E loader', () => {
    mockE2e = false;
    visit('?e2e-font-scale=2');
    expect(e2eFontScale()).toBeUndefined();
  });
});
