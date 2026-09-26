import type { OcrResult } from '@/domain';

export type { OcrBlock, OcrFrame, OcrLine, OcrResult } from '@/domain';

/** Reads the text on a photo (a `file://` URI) on the device. */
export type RecognizeText = (uri: string) => Promise<OcrResult>;

/** The web build has no camera or on-device text recognition: the Scan tab offers typed cover text instead. */
export class NotSupportedOnWeb extends Error {
  constructor(feature = 'Reading a cover') {
    super(`${feature} needs the phone app; on the web, type the cover text instead.`);
    this.name = 'NotSupportedOnWeb';
  }
}

/** This build has no on-device text recognition module (see `ocr.ts`). */
export class OcrUnavailableError extends Error {
  constructor() {
    super('Reading covers needs the on-device text reader, which this build does not include yet.');
    this.name = 'OcrUnavailableError';
  }
}

/**
 * The shape ML Kit text recognition returns through React Native bindings
 * (`@react-native-ml-kit/text-recognition`: frames as `{ left, top, width,
 * height }`; some bindings use `x`/`y`). Everything is optional because
 * frames can be missing for rotated or partial text.
 */
export interface MlKitFrame {
  left?: number;
  top?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface MlKitResult {
  text?: string;
  blocks?: { text?: string; frame?: MlKitFrame; lines?: { text?: string; frame?: MlKitFrame }[] }[];
}
