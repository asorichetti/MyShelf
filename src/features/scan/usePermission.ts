import { useCameraPermissions } from 'expo-camera';
import { useCallback } from 'react';
import { Linking } from 'react-native';

export type CameraPermissionState = 'loading' | 'undetermined' | 'granted' | 'denied';

export interface CameraPermission {
  state: CameraPermissionState;
  /** Shows the system prompt (only useful while undetermined, or denied with `canAskAgain`). */
  request: () => Promise<void>;
  /** Opens the app's page in the phone's settings, the only way back from a permanent "deny". */
  openSettings: () => void;
}

/**
 * The camera permission as the Scan tab needs it (P03-02): undetermined
 * until asked, denied (for good, or "ask again" not yet used), or granted.
 * A denial the system would still ask about again counts as undetermined, so
 * the friendly explanation and "Allow camera" come back.
 */
export function usePermission(): CameraPermission {
  const [permission, requestPermission] = useCameraPermissions();
  const state: CameraPermissionState = !permission
    ? 'loading'
    : permission.granted
      ? 'granted'
      : permission.status === 'undetermined' || permission.canAskAgain
        ? 'undetermined'
        : 'denied';
  const request = useCallback(async () => {
    await requestPermission();
  }, [requestPermission]);
  const openSettings = useCallback(() => {
    Linking.openSettings().catch(() => undefined);
  }, []);
  return { state, request, openSettings };
}
