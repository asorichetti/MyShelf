import type { OcrFrame } from '@/domain';

import { NotSupportedOnWeb, type RecognizeText } from './types';


/** The web build is a test target without a camera: typed cover text stands in for OCR (P03-07). */
export const recognizeText: RecognizeText = async () => {
  throw new NotSupportedOnWeb();
};

export const ocrAvailable = false;

export const COVER_PHOTO_MAX_HEIGHT = 1500;

export async function coverFromPhoto(_uri: string, _focus?: OcrFrame | null): Promise<string> {
  throw new NotSupportedOnWeb('Using a photo as the cover');
}
