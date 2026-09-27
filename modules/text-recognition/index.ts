import { requireOptionalNativeModule } from 'expo';

/** A rectangle in pixels of the upright image, origin top left. */
export interface NativeFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NativeLine {
  text: string;
  frame: NativeFrame | null;
  /** 0–1: ML Kit's confidence in the line. */
  confidence?: number;
  /** BCP-47 code ML Kit recognised the line as ("und" when unsure). */
  language?: string;
  /** Degrees the line is rotated from horizontal. */
  angle?: number;
}

export interface NativeBlock {
  text: string;
  frame: NativeFrame | null;
  lines: NativeLine[];
}

/** What `recognize` resolves with: the upright image's size and its text. */
export interface NativeTextResult {
  width: number;
  height: number;
  blocks: NativeBlock[];
}

interface TextRecognitionModule {
  /**
   * Reads the text on a photo with ML Kit Text Recognition v2 (bundled Latin
   * model), on the device. Accepts `file://` and `content://` URIs; applies
   * the photo's EXIF orientation. Rejects with `ERR_IMAGE_LOAD` or
   * `ERR_RECOGNITION_FAILED`.
   */
  recognize(uri: string): Promise<NativeTextResult>;
  /**
   * An upright 2:3 crop of the photo, at most `maxHeight` px tall, as a
   * cached JPEG; resolves with its `file://` URI. The crop surrounds `focus`
   * (`[x, y, width, height]` in pixels of the upright photo, e.g. where its
   * text was read) with a margin, or is the largest centred one without it.
   */
  prepareCover(uri: string, maxHeight: number, focus: [number, number, number, number] | null): Promise<string>;
}

/**
 * The app's local text-recognition module (Android only). Null where it is
 * not built in: iOS (unsupported, the app is Android-first), the web, Jest,
 * and Expo Go.
 */
export const TextRecognition = requireOptionalNativeModule<TextRecognitionModule>('MyShelfTextRecognition');
