import { renderHook } from '@testing-library/react-native';

import { emit, listenerCount, subscribe, useLibraryEvent } from '@/features/events';

describe('library events', () => {
  it('notifies subscribers of that event only, until they unsubscribe', () => {
    const library = jest.fn();
    const loans = jest.fn();
    const offLibrary = subscribe('library-changed', library);
    const offLoans = subscribe('loans-changed', loans);
    emit('library-changed');
    expect(library).toHaveBeenCalledWith('library-changed');
    expect(loans).not.toHaveBeenCalled();
    offLibrary();
    emit('library-changed');
    expect(library).toHaveBeenCalledTimes(1);
    offLoans();
    expect(listenerCount('library-changed')).toBe(0);
    expect(listenerCount('loans-changed')).toBe(0);
  });

  it('keeps notifying the others when one listener throws', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const after = jest.fn();
    const off1 = subscribe('groups-changed', () => {
      throw new Error('boom');
    });
    const off2 = subscribe('groups-changed', after);
    emit('groups-changed');
    expect(after).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith('A groups-changed listener failed', expect.any(Error));
    off1();
    off2();
    spy.mockRestore();
  });

  it('lets a listener unsubscribe itself while being notified', () => {
    const second = jest.fn();
    const off = subscribe('settings-changed', () => off());
    const off2 = subscribe('settings-changed', second);
    emit('settings-changed');
    expect(second).toHaveBeenCalledTimes(1);
    expect(listenerCount('settings-changed')).toBe(1);
    off2();
  });
});

describe('useLibraryEvent', () => {
  it('subscribes on mount, uses the latest callback and unsubscribes on unmount', () => {
    const first = jest.fn();
    const latest = jest.fn();
    const { rerender, unmount } = renderHook(({ cb }: { cb: jest.Mock }) => useLibraryEvent(['library-changed', 'loans-changed'], cb), {
      initialProps: { cb: first },
    });
    expect(listenerCount('library-changed')).toBe(1);
    rerender({ cb: latest });
    emit('loans-changed');
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith('loans-changed');
    unmount();
    expect(listenerCount('library-changed')).toBe(0);
    expect(listenerCount('loans-changed')).toBe(0);
  });
});
