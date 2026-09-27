/**
 * @jest-environment jsdom
 */
import { E2E_HOOK, installE2eEventHook, noteForE2e, type E2eWindowHook } from '@/features/e2e/eventHook.web';
import { emit, subscribe } from '@/features/events';

// The web build's rule (e2eFlag.web.ts): on unless a build opts out.
let mockE2e = true;
jest.mock('@/features/e2e/e2eFlag', () => ({ isE2eEnabled: () => mockE2e }));

const hook = () => (window as unknown as Record<string, E2eWindowHook | undefined>)[E2E_HOOK];

afterEach(() => {
  mockE2e = true;
  delete (window as unknown as Record<string, unknown>)[E2E_HOOK];
});

describe('installE2eEventHook', () => {
  it('lets a journey emit a library event, as a background write would', () => {
    installE2eEventHook();
    const heard: string[] = [];
    const stop = subscribe('library-changed', (e) => heard.push(e));
    hook()!.emit('library-changed');
    stop();
    expect(heard).toEqual(['library-changed']);
  });

  it('counts every event emitted, so a journey can tell when a write has committed', () => {
    installE2eEventHook();
    expect(hook()!.counts).toEqual({});
    emit('groups-changed');
    emit('groups-changed');
    emit('settings-changed');
    expect(hook()!.counts).toEqual({ 'groups-changed': 2, 'settings-changed': 1 });
  });

  it('keeps the values the app notes for journeys, per key', () => {
    installE2eEventHook();
    noteForE2e('backup-check', true);
    noteForE2e('backup-check', false);
    expect(hook()!.notes).toEqual({ 'backup-check': [true, false] });
  });

  it('is not there when the build has the E2E loader off', () => {
    mockE2e = false;
    installE2eEventHook();
    expect(hook()).toBeUndefined();
    expect(() => noteForE2e('backup-check', true)).not.toThrow();
  });
});
