import { Share } from 'react-native';

/** Android and iOS: no clipboard module is bundled, so the details go to the share sheet, which offers Copy. */
export const COPY_ERROR_LABEL = 'Share error details';

/** Hands the text to the system share sheet. Resolves true when it was shown. */
export async function copyErrorDetails(text: string): Promise<boolean> {
  try {
    await Share.share({ message: text });
    return true;
  } catch {
    return false;
  }
}
