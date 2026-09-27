import type { OcrResult } from '@/domain';

export type { OcrBlock, OcrFrame, OcrLine, OcrResult } from '@/domain';

/** Reads the text on a photo (a `file://` or `content://` URI) on the device. */
export type RecognizeText = (uri: string) => Promise<OcrResult>;

/** The web build has no camera or on-device text recognition: the Scan tab offers typed cover text instead. */
export class NotSupportedOnWeb extends Error {
  constructor(feature = 'Reading a cover') {
    super(`${feature} needs the phone app; on the web, type the cover text instead.`);
    this.name = 'NotSupportedOnWeb';
  }
}

/** This build has no on-device text recognition module (iOS, Expo Go). */
export class OcrUnavailableError extends Error {
  constructor() {
    super('Reading covers needs the on-device text reader, which this build does not include.');
    this.name = 'OcrUnavailableError';
  }
}

/** The photo could not be opened or read (a missing file, not an image, or ML Kit failed). */
export class OcrFailedError extends Error {
  /** The native error code: `ERR_IMAGE_LOAD`, `ERR_RECOGNITION_FAILED`, or null. */
  readonly code: string | null;
  constructor(cause: unknown) {
    const code = typeof (cause as { code?: unknown } | null)?.code === 'string' ? (cause as { code: string }).code : null;
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'OcrFailedError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * ML Kit text recognition's output as it reaches JavaScript: the app's module
 * (`modules/text-recognition`) sends frames as `{ x, y, width, height }`;
 * other bindings use `{ left, top, width, height }`. Everything is optional
 * because frames can be missing for rotated or partial text.
 */
export interface MlKitFrame {
  left?: number;
  top?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface MlKitLine {
  text?: string;
  frame?: MlKitFrame | null;
  confidence?: number;
  language?: string;
}

export interface MlKitResult {
  text?: string;
  width?: number;
  height?: number;
  blocks?: { text?: string; frame?: MlKitFrame | null; lines?: MlKitLine[] }[];
}
