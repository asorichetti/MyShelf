import type { FetchLike } from '@/services/http';

/**
 * Web: no switch and no bundled fixtures. The auto test suite answers the
 * same recorded responses from outside the page, through Playwright
 * (--mock-api, tools/auto-test-suite/src/mockapi/). See mockApi.ts.
 */
export type E2eApiMode = 'mock' | 'live';
export type E2eNetwork = 'online' | 'offline';
export interface E2eApiState {
  api: E2eApiMode;
  network: E2eNetwork;
}

export const isMockApiBuilt = (): boolean => false;
export const getE2eApiState = (): E2eApiState => ({ api: 'live', network: 'online' });
export function setE2eApiState(_change: Partial<E2eApiState>): void {}
export const e2eApiFetch = (): FetchLike | undefined => undefined;
export function resetE2eApiForTests(): void {}
