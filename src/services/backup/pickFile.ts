import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { decodeText } from './decodeText';

import type { PickedFile } from './fileTypes';

/** Opens the system file picker for one file and reads it as text (in whatever encoding it was saved: `decodeText`). Null when the user backs out. */
export async function pickTextFile(mimeTypes: readonly string[]): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: [...mimeTypes, '*/*'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  try {
    return { name: asset.name, text: decodeText(new Uint8Array(await file.arrayBuffer())) };
  } finally {
    if (file.exists) file.delete();
  }
}
