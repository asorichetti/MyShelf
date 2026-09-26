import type { MessageKey } from '@/i18n';

/** Web: straight onto the clipboard. */
export const COPY_ERROR_LABEL: MessageKey = 'navigation.screenError.copy';

/** Copies the text to the clipboard. Resolves false when the browser refuses (no permission, not a secure page). */
export async function copyErrorDetails(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
