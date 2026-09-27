import * as ImagePicker from 'expo-image-picker';

/**
 * "Choose from your photos" in Cover mode (P03-05): the system photo picker,
 * which needs no permission, returning the chosen image's `file://` copy in
 * the cache directory, or null when the user backs out. The whole photo is
 * kept (no crop step): the text reader needs all of the cover.
 */
export async function choosePhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}
