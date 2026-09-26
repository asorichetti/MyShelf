import type { OcrFrame, OcrResult } from '@/domain';

import type { MlKitFrame, MlKitResult } from './types';

function frameOf(f: MlKitFrame | undefined): OcrFrame | null {
  if (!f) return null;
  const x = f.left ?? f.x;
  const y = f.top ?? f.y;
  if (x == null || y == null || f.width == null || f.height == null) return null;
  if (![x, y, f.width, f.height].every(Number.isFinite) || f.width <= 0 || f.height <= 0) return null;
  return { x, y, width: f.width, height: f.height };
}

/**
 * ML Kit's recognition result as the app's `OcrResult`: blocks and lines
 * with pixel frames. Lines without a usable frame or text are dropped (the
 * query builder ranks by size, so a line without one cannot be placed); a
 * block with no usable lines keeps its own text and frame as one line.
 */
export function fromMlKit(result: MlKitResult | null | undefined): OcrResult {
  const blocks: OcrResult['blocks'] = [];
  for (const block of result?.blocks ?? []) {
    const blockFrame = frameOf(block.frame);
    const lines = (block.lines ?? [])
      .map((l) => ({ text: (l.text ?? '').trim(), frame: frameOf(l.frame) }))
      .filter((l): l is { text: string; frame: OcrFrame } => Boolean(l.text && l.frame));
    const text = (block.text ?? '').trim();
    if (lines.length) blocks.push({ text: text || lines.map((l) => l.text).join('\n'), frame: blockFrame ?? lines[0].frame, lines });
    else if (text && blockFrame) blocks.push({ text, frame: blockFrame, lines: [{ text, frame: blockFrame }] });
  }
  return { blocks };
}
