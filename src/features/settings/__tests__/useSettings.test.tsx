import { act, renderHook, waitFor } from '@testing-library/react-native';

import { settingsRepo, StaticDatabaseProvider, type Db } from '@/db';
import { emit, subscribe } from '@/features/events';
import { createTestDb } from '@/testing/createTestDb';

import { useSettings } from '../useSettings';

import type { ReactNode } from 'react';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const wrapper = ({ children }: { children: ReactNode }) => <StaticDatabaseProvider db={db}>{children}</StaticDatabaseProvider>;

describe('useSettings', () => {
  it('loads every setting with its default', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.settings).not.toBeNull());
    expect(result.current.settings).toMatchObject({ loanDays: 28, dateFormat: 'medium', googleBooksEnabled: true, coversOnMobileData: true, 'backup.lastAt': null });
  });

  it('applies a change at once, saves it and tells the app', async () => {
    const heard = jest.fn();
    const unsubscribe = subscribe('settings-changed', heard);
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.settings).not.toBeNull());
    await act(async () => result.current.set('loanDays', 14));
    expect(result.current.settings?.loanDays).toBe(14);
    expect(await settingsRepo.getSetting(db, 'loanDays')).toBe(14);
    expect(heard).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('reloads when another screen changes a setting', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.settings).not.toBeNull());
    await settingsRepo.setSetting(db, 'dateFormat', 'iso');
    await act(async () => emit('settings-changed'));
    await waitFor(() => expect(result.current.settings?.dateFormat).toBe('iso'));
  });
});
