/**
 * @jest-environment node
 */
/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(__dirname, '..', '..', '..');
const scanned = ['src/app', 'src/components', 'src/features'];
const colourLiteral = /#[0-9a-f]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/i;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

it('keeps colour literals inside src/theme', () => {
  const offenders = scanned
    .flatMap((d) => sourceFiles(join(root, d)))
    .flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${relative(root, file)}:${i + 1}` }))
        .filter(({ line }) => colourLiteral.test(line) && !line.trim().startsWith('//')),
    )
    .map(({ at, line }) => `${at}  ${line.trim()}`);
  expect(offenders).toEqual([]);
});
