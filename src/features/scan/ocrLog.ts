import type { OcrResult } from '@/domain';

/** Logcat cuts a line at about 4000 bytes: the result goes out in pieces this long. */
const CHUNK = 3000;

/**
 * E2E builds only: writes what the text reader saw to the log as
 * `[myshelf-ocr <n>/<total>] <json piece>` lines, which
 * `scripts/record-mlkit-fixture.mjs` joins into an OCR fixture (P03-06).
 */
export function logOcrResult(result: OcrResult, log: (line: string) => void = console.log): void {
  const json = JSON.stringify(result);
  const total = Math.max(1, Math.ceil(json.length / CHUNK));
  for (let i = 0; i < total; i++) log(`[myshelf-ocr ${i + 1}/${total}] ${json.slice(i * CHUNK, (i + 1) * CHUNK)}`);
}
