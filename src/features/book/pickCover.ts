import * as ImagePicker from 'expo-image-picker';

export type CoverSource = 'library' | 'camera';

export type PickCoverResult = { status: 'picked'; uri: string } | { status: 'cancelled' } | { status: 'denied' };

/** Covers are 2:3; the crop step (Android and iOS) starts there. */
const OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [2, 3], quality: 0.8 };

/**
 * Lets the user choose a photo of the cover, or take one. The camera asks for
 * permission first; the photo library uses the system picker, which needs
 * none. Returns the temporary URI of the image, to be stored on save.
 */
export async function pickCover(source: CoverSource): Promise<PickCoverResult> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { status: 'denied' };
  }
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(OPTIONS) : await ImagePicker.launchImageLibraryAsync(OPTIONS);
  const asset = result.canceled ? undefined : result.assets[0];
  return asset ? { status: 'picked', uri: asset.uri } : { status: 'cancelled' };
}
