import { act, renderHook } from '@testing-library/react-native';

import { makeCandidate } from '@/services/metadata/candidate';

import { createSession, getSession } from '../sessionStore';
import { discardPhoto } from '../tempPhoto';
import { addToTray, clearTray, dropTrayItem, getTray, isConfident, resolveTrayItem, useTray } from '../useBatchScan';

const book = (title: string) => makeCandidate({ title, source: 'openlibrary', sourceId: title });

jest.mock('../tempPhoto', () => ({ discardPhoto: jest.fn() }));

beforeEach(() => {
  clearTray();
  jest.mocked(discardPhoto).mockClear();
});

describe('the scan tray (P03-12)', () => {
  it('an ISBN with exactly one candidate goes in ready; a cover search or several candidates need a choice', () => {
    const ready = addToTray(createSession({ source: 'barcode', isbn13: '9780552166591', candidates: [book('A')] }));
    const cover = addToTray(createSession({ source: 'cover', candidates: [book('B')] }));
    const several = addToTray(createSession({ source: 'isbn', candidates: [book('C'), book('D')] }));
    expect([ready.status, cover.status, several.status]).toEqual(['ready', 'needs-choice', 'needs-choice']);
    expect(ready.candidate?.title).toBe('A');
    expect(cover.candidate).toBeNull();
    expect(cover.sessionId).not.toBeNull();
    expect(isConfident({ source: 'barcode', candidates: [book('A')] })).toBe(true);
  });

  it('choosing an edition makes an item ready; dropping removes it', () => {
    const item = addToTray(createSession({ source: 'cover', candidates: [book('B')] }));
    resolveTrayItem(item.id, book('B, 1990 Corgi'));
    expect(getTray()[0]).toMatchObject({ status: 'ready', label: 'B, 1990 Corgi', sessionId: null });
    dropTrayItem(item.id);
    expect(getTray()).toEqual([]);
  });

  it('dropping a book still waiting for its edition deletes its cover photo', () => {
    const session = createSession({ source: 'cover', candidates: [book('B')], photoUri: 'file:///cache/Camera/cover.jpg' });
    const item = addToTray(session);
    dropTrayItem(item.id);
    expect(getSession(session.id)).toBeNull();
    expect(discardPhoto).toHaveBeenCalledWith('file:///cache/Camera/cover.jpg');
  });

  it('survives the screen that showed it (the Scan tab unmounts when you leave)', () => {
    const first = renderHook(() => useTray());
    act(() => {
      addToTray(createSession({ source: 'barcode', candidates: [book('A')] }));
    });
    expect(first.result.current).toHaveLength(1);
    first.unmount();
    const again = renderHook(() => useTray());
    expect(again.result.current).toHaveLength(1);
  });
});
