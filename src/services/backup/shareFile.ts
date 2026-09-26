import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { OutgoingFile, ShareOutcome } from './fileTypes';

/**
 * Writes the file to the app's cache and opens the Android share sheet, so
 * the user can save it to Drive, email it or keep it in Downloads. Resolves
 * once the sheet is closed.
 */
export async function shareFile({ fileName, mimeType, text, dialogTitle }: OutgoingFile): Promise<ShareOutcome> {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
  return 'shared';
}
