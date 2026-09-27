import { File, Paths } from 'expo-file-system';

import type { FetchLike } from '@/services/http';

import { isE2eEnabled } from './e2eFlag';
import { createMockApiFetch, type MockApiBundle } from './mockApiFetch';

/**
 * Recorded API responses on Android (docs/device-testing.md): in a build made
 * with EXPO_PUBLIC_E2E=1 and EXPO_PUBLIC_E2E_MOCK_API=1 (the E2E APK), the
 * app's HTTP client answers Open Library, Google Books and cover requests from
 * the same fixtures the web auto test suite uses, so Maestro flows never
 * depend on those services. A flow that exists to prove the real network path
 * opens its fixture with `api=live`. Every other build has neither the switch
 * nor the fixtures: metro.config.js resolves the fixture file to an empty
 * module unless EXPO_PUBLIC_E2E_MOCK_API=1.
 *
 * The switch lives in a file in the app's storage, so it holds across a cold
 * start (Maestro's `launchApp`) and is reset by `clearState`: absent means
 * recorded responses, online.
 */

/** `mock`: recorded responses; `live`: the real services. */
export type E2eApiMode = 'mock' | 'live';
/** `offline`: every request fails as with no network (the offline queue flows), without touching the phone's radio. */
export type E2eNetwork = 'online' | 'offline';

export interface E2eApiState {
  api: E2eApiMode;
  network: E2eNetwork;
}

const STATE_FILE = 'e2e-api.json';
const DEFAULT_STATE: E2eApiState = { api: 'mock', network: 'online' };
const LOG = '[e2e-mock-api]';

/** Whether this build carries the recorded responses (E2E APK only). */
export function isMockApiBuilt(): boolean {
  return isE2eEnabled() && process.env.EXPO_PUBLIC_E2E_MOCK_API === '1';
}

let state: E2eApiState | null = null;
let bundle: MockApiBundle | null | undefined;

function stateFile(): File {
  return new File(Paths.document, STATE_FILE);
}

function readState(): E2eApiState {
  try {
    const file = stateFile();
    if (!file.exists) return DEFAULT_STATE;
    const saved = JSON.parse(file.textSync()) as Partial<E2eApiState>;
    return { api: saved.api === 'live' ? 'live' : 'mock', network: saved.network === 'offline' ? 'offline' : 'online' };
  } catch {
    return DEFAULT_STATE;
  }
}

/** The switch as it stands (recorded responses and online when nothing set it). */
export function getE2eApiState(): E2eApiState {
  state ??= readState();
  return state;
}

/** Sets the switch (the E2E deep links do); kept in the app's storage for later starts. No-op outside mock builds. */
export function setE2eApiState(change: Partial<E2eApiState>): void {
  if (!isMockApiBuilt()) return;
  state = { ...getE2eApiState(), ...change };
  try {
    const file = stateFile();
    file.create({ overwrite: true });
    file.write(JSON.stringify(state));
  } catch (error) {
    console.error(`${LOG} could not save the switch`, error);
  }
  console.log(`${LOG} api=${state.api} network=${state.network}`);
}

function loadBundle(): MockApiBundle | null {
  if (bundle === undefined) {
    // Resolved to an empty module in every build without EXPO_PUBLIC_E2E_MOCK_API=1 (metro.config.js).
     
    const loaded = require('../../generated/e2eApiFixtures.json') as Partial<MockApiBundle> | null;
    bundle = loaded && Array.isArray(loaded.routes) && loaded.covers ? (loaded as MockApiBundle) : null;
    if (!bundle) console.error(`${LOG} this build has no recorded responses`);
  }
  return bundle;
}

let mockFetch: FetchLike | null = null;

/**
 * The `fetch` for the app's HTTP client: undefined (the global `fetch`) in
 * every build but the E2E APK; there, recorded responses or the real
 * services, as the switch says at each request.
 */
export function e2eApiFetch(): FetchLike | undefined {
  if (!isMockApiBuilt()) return undefined;
  return (url, init) => {
    if (getE2eApiState().api === 'live') return fetch(url, init);
    const recorded = loadBundle();
    if (!recorded) return Promise.reject(new TypeError(`${LOG} no recorded responses for ${url}`));
    mockFetch ??= createMockApiFetch(recorded, {
      offline: () => getE2eApiState().network === 'offline',
      onUnmocked: (unmocked) => console.error(`${LOG} unmocked ${unmocked}`),
    });
    return mockFetch(url, init);
  };
}

/** For tests: forget the switch and the loaded bundle. */
export function resetE2eApiForTests(): void {
  state = null;
  bundle = undefined;
  mockFetch = null;
}
