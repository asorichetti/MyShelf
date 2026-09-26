import * as ImagePicker from 'expo-image-picker';

import type { CoverSource, PickCoverResult } from './pickCover';

export type { CoverSource, PickCoverResult } from './pickCover';

/**
 * Web: the browser's file picker (the camera choice asks the browser for a
 * photo input). Its `blob:` URLs die with the page, so the image is kept as a
 * `data:` URI instead, which survives a reload.
 */
export async function pickCover(source: CoverSource): Promise<PickCoverResult> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, base64: true };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { status: 'cancelled' };
  const uri = asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri;
  return { status: 'picked', uri };
}
