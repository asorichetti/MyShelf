import type { OcrFrame, OcrLine, OcrResult } from '@/domain';

import type { MlKitFrame, MlKitLine, MlKitResult } from './types';

function frameOf(f: MlKitFrame | null | undefined): OcrFrame | null {
  if (!f) return null;
  const x = f.left ?? f.x;
  const y = f.top ?? f.y;
  if (x == null || y == null || f.width == null || f.height == null) return null;
  if (![x, y, f.width, f.height].every(Number.isFinite) || f.width <= 0 || f.height <= 0) return null;
  return { x, y, width: f.width, height: f.height };
}

function lineOf(l: MlKitLine): OcrLine | null {
  const text = (l.text ?? '').trim();
  const frame = frameOf(l.frame);
  if (!text || !frame) return null;
  const line: OcrLine = { text, frame };
  if (typeof l.confidence === 'number' && Number.isFinite(l.confidence)) line.confidence = Math.round(l.confidence * 100) / 100;
  if (typeof l.language === 'string' && l.language && l.language !== 'und') line.language = l.language;
  return line;
}

/**
 * ML Kit's recognition result as the app's `OcrResult`: blocks and lines
 * with pixel frames, and each line's confidence and language when ML Kit
 * gives them. Lines without a usable frame or text are dropped (the query
 * builder ranks by size, so a line without one cannot be placed); a block
 * with no usable lines keeps its own text and frame as one line.
 */
export function fromMlKit(result: MlKitResult | null | undefined): OcrResult {
  const blocks: OcrResult['blocks'] = [];
  for (const block of result?.blocks ?? []) {
    const blockFrame = frameOf(block.frame);
    const lines = (block.lines ?? []).map(lineOf).filter((l): l is OcrLine => l != null);
    const text = (block.text ?? '').trim();
    if (lines.length) blocks.push({ text: text || lines.map((l) => l.text).join('\n'), frame: blockFrame ?? lines[0].frame, lines });
    else if (text && blockFrame) blocks.push({ text, frame: blockFrame, lines: [{ text, frame: blockFrame }] });
  }
  return { blocks };
}
