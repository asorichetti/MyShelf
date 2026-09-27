import type { OcrFrame } from '@/domain';
import { TextRecognition } from '@modules/text-recognition';


import { fromMlKit } from './mlKit';
import { OcrFailedError, OcrUnavailableError, type RecognizeText } from './types';

/**
 * On-device text recognition for cover photos (P03-05): the app's local Expo
 * module (`modules/text-recognition`) runs ML Kit Text Recognition v2 with
 * its bundled Latin model, so it works offline and the photo never leaves
 * the phone. Android only: elsewhere the module is absent, `ocrAvailable` is
 * false and the Scan tab offers typed cover text.
 */
export const recognizeText: RecognizeText = async (uri) => {
  if (!TextRecognition) throw new OcrUnavailableError();
  try {
    return fromMlKit(await TextRecognition.recognize(uri));
  } catch (error) {
    throw new OcrFailedError(error);
  }
};

/** Whether this build can read covers on the device. */
export const ocrAvailable = TextRecognition != null;

/** The tallest a cover made from the user's photo is stored (P03-14). */
export const COVER_PHOTO_MAX_HEIGHT = 1500;

/**
 * The cover photo taken for recognition, made into a book cover (P03-14):
 * turned upright, cropped to 2:3 around `focus` (where its text was read:
 * the cover itself) or else in the middle, and scaled down, as a new JPEG in
 * the cache directory. Resolves with its `file://` URI.
 */
export async function coverFromPhoto(uri: string, focus: OcrFrame | null = null): Promise<string> {
  if (!TextRecognition) throw new OcrUnavailableError();
  return TextRecognition.prepareCover(uri, COVER_PHOTO_MAX_HEIGHT, focus ? [focus.x, focus.y, focus.width, focus.height] : null);
}
