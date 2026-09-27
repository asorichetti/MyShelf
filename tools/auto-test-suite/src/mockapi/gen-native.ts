// npm run e2eapi:gen / e2eapi:check: see native.ts.
import { relative } from 'node:path';

import { DefaultMockDir } from './index.ts';
import { generateNativeBundle } from './native.ts';

const check = process.argv.includes('--check');
const { ok, path, routes } = generateNativeBundle(DefaultMockDir, { check });
const shown = relative(process.cwd(), path);
if (!ok) {
  process.stderr.write(`${shown} is out of date with the fixture index: run npm run e2eapi:gen\n`);
  process.exit(1);
}
process.stdout.write(`${shown}: ${routes} routes${check ? ', up to date' : ''}\n`);
