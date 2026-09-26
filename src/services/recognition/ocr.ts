import { OcrUnavailableError, type RecognizeText } from './types';

/**
 * On-device text recognition for cover photos (P03-05), Android.
 *
 * Not wired to a native module yet: `@react-native-ml-kit/text-recognition`
 * 2.0.0 installs, but `expo-doctor` flags it as untested on the New
 * Architecture (which React Native 0.86 requires), and the Expo-module
 * alternative (`expo-text-extractor` 2.0.0) returns text without the line
 * frames the query builder ranks by. Until a development build can prove
 * one on a device, recognition reports itself unavailable and the Scan tab
 * falls back to typed cover text. The mapping from ML Kit's output is ready
 * in `mlKit.ts` (`fromMlKit`).
 */
export const recognizeText: RecognizeText = async () => {
  throw new OcrUnavailableError();
};

/** Whether this build can read covers on the device. */
export const ocrAvailable = false;
