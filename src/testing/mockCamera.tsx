/**
 * A stand-in for `expo-camera` in Jest: `jest.mock('expo-camera', () => require('@/testing/mockCamera').cameraModule)`.
 * The permission and the last CameraView's props are controllable, so tests
 * can grant or deny the camera and "scan" a code by calling
 * `lastCameraProps().onBarcodeScanned(...)`.
 */
import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { View } from 'react-native';

type Permission = { status: 'undetermined' | 'granted' | 'denied'; granted: boolean; canAskAgain: boolean; expires: 'never' } | null;

const state: { permission: Permission; request: jest.Mock; props: Record<string, unknown> | null; takePicture: jest.Mock } = {
  permission: null,
  request: jest.fn(),
  props: null,
  takePicture: jest.fn(async () => ({ uri: 'file:///cache/Camera/cover.jpg', width: 1080, height: 1620 })),
};

export function setCameraPermission(status: 'loading' | 'undetermined' | 'granted' | 'denied', canAskAgain = status !== 'denied'): void {
  state.permission = status === 'loading' ? null : { status, granted: status === 'granted', canAskAgain, expires: 'never' };
}

export function cameraRequest(): jest.Mock {
  return state.request;
}

export function takePictureMock(): jest.Mock {
  return state.takePicture;
}

/** The props of the CameraView rendered last (null if none is mounted). */
export function lastCameraProps(): Record<string, any> | null {
  return state.props;
}

export function resetCamera(): void {
  state.permission = null;
  state.props = null;
  state.request.mockReset();
  state.request.mockImplementation(async () => {
    setCameraPermission('granted');
    return state.permission;
  });
  state.takePicture.mockClear();
}

const CameraView = forwardRef<{ takePictureAsync: jest.Mock }, Record<string, unknown>>(function CameraView(props, ref) {
  state.props = props;
  useEffect(
    () => () => {
      state.props = null;
    },
    [],
  );
  useImperativeHandle(ref, () => ({ takePictureAsync: state.takePicture }));
  return <View testID={props.testID as string} accessibilityLabel={props.accessibilityLabel as string} />;
});

export const cameraModule = {
  CameraView,
  useCameraPermissions: () => [state.permission, state.request, jest.fn()],
};
