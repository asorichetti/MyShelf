import { NotSupportedOnWeb, type RecognizeText } from './types';

/** The web build is a test target without a camera: typed cover text stands in for OCR (P03-07). */
export const recognizeText: RecognizeText = async () => {
  throw new NotSupportedOnWeb();
};

export const ocrAvailable = false;
