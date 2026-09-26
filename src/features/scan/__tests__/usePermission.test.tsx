import { act, renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { cameraRequest, resetCamera, setCameraPermission } from '@/testing/mockCamera';

import { usePermission } from '../usePermission';

jest.mock('expo-camera', () => jest.requireActual('@/testing/mockCamera').cameraModule);

beforeEach(() => resetCamera());

describe('usePermission', () => {
  it.each([
    ['loading', true, 'loading'],
    ['undetermined', true, 'undetermined'],
    ['granted', true, 'granted'],
    // Denied once but the system would still ask: explain and offer "Allow camera" again.
    ['denied', true, 'undetermined'],
    // Denied for good: only the phone's settings can undo it.
    ['denied', false, 'denied'],
  ] as const)('%s (can ask again: %s) is %s', (status, canAskAgain, want) => {
    setCameraPermission(status, canAskAgain);
    const { result } = renderHook(() => usePermission());
    expect(result.current.state).toBe(want);
  });

  it('asks the system, and opens the settings', async () => {
    setCameraPermission('undetermined');
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    const { result } = renderHook(() => usePermission());
    await act(() => result.current.request());
    expect(cameraRequest()).toHaveBeenCalledTimes(1);
    result.current.openSettings();
    expect(open).toHaveBeenCalledTimes(1);
  });
});
