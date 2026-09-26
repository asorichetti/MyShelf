import { File } from 'expo-file-system';

/** Deletes a cover photo taken for recognition once it is no longer needed. Never throws. */
export function discardPhoto(uri: string | null | undefined): void {
  if (!uri || !uri.startsWith('file:')) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A photo left in the cache directory is cleaned up by the system.
  }
}
