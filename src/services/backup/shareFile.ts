import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { OutgoingBinaryFile, OutgoingFile, ShareOutcome } from './fileTypes';

/**
 * Writes the file to the app's cache and opens the Android share sheet, so
 * the user can save it to Drive, email it or keep it in Downloads. Resolves
 * once the sheet is closed.
 */
export async function shareFile({ fileName, mimeType, text, dialogTitle }: OutgoingFile): Promise<ShareOutcome> {
  return share(fileName, text, mimeType, dialogTitle);
}

/** As `shareFile`, for a binary file. */
export async function shareBinaryFile({ fileName, mimeType, bytes, dialogTitle }: OutgoingBinaryFile): Promise<ShareOutcome> {
  return share(fileName, bytes, mimeType, dialogTitle);
}

async function share(fileName: string, content: string | Uint8Array, mimeType: string, dialogTitle?: string): Promise<ShareOutcome> {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
  return 'shared';
}
