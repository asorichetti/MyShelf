#!/usr/bin/env node
// Runs tsc. Expo Router's typed routes (.expo/types/router.d.ts) are generated
// by the dev server and are git-ignored. A copy left over from before routes
// were added makes valid links fail to typecheck, so a copy older than any
// route file is removed first; tsc then checks route strings loosely until the
// dev server regenerates it (CI does that for the strict check).
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const routeTypes = '.expo/types/router.d.ts';

function newestMtime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestMtime(path) : statSync(path).mtimeMs);
  }
  return newest;
}

if (existsSync(routeTypes) && statSync(routeTypes).mtimeMs < newestMtime('src/app')) {
  rmSync(routeTypes);
  console.error(`typecheck: removed stale ${routeTypes}; start the dev server to regenerate it for strict route checking`);
}

const result = spawnSync('npx', ['tsc', '--noEmit'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
