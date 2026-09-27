/**
 * @jest-environment node
 */
import { logOcrResult } from '../ocrLog';

describe('logOcrResult', () => {
  it('writes the result in numbered pieces that join back into it', () => {
    const text = 'x'.repeat(4000);
    const result = { blocks: [{ text, frame: { x: 0, y: 0, width: 1, height: 1 }, lines: [] }] };
    const lines: string[] = [];
    logOcrResult(result, (l) => lines.push(l));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^\[myshelf-ocr 1\/2\] /);
    const joined = lines.map((l) => l.replace(/^\[myshelf-ocr \d+\/\d+\] /, '')).join('');
    expect(JSON.parse(joined)).toEqual(result);
  });

  it('writes a small result on one line', () => {
    const lines: string[] = [];
    logOcrResult({ blocks: [] }, (l) => lines.push(l));
    expect(lines).toEqual(['[myshelf-ocr 1/1] {"blocks":[]}']);
  });
});
