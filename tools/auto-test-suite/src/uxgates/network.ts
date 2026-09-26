import { isExpectedMissing } from './expected.ts';
import { newResult, type RawFinding, type Result } from './gate.ts';

import type { Listeners } from '../browser/listeners.ts';

// networkGate fails on any request that got status >= 400 or no response at
// all, except URLs carrying ExpectedMissingMarker and mock fixtures marked
// `expected`. A request the API mock aborted because no fixture answers it is
// reported under its own rule, `unmocked`, naming the URL.
export function networkGate(l: Listeners, target: string): Result {
  const start = Date.now();
  const findings: RawFinding[] = [];
  for (const e of l.snapshot().network) {
    if (isExpectedMissing(e.url) || l.isExpectedMock(e.url)) continue;
    const unmocked = l.isUnmocked(e.url);
    const failed = e.status === 0;
    findings.push({
      rule: unmocked ? 'unmocked' : failed ? 'request-failed' : 'http-status',
      message: unmocked
        ? `${e.method} ${e.url} left the app with no mock fixture: add it to the --mock-api index (scripts/record-fixture.mjs records one)`
        : failed
          ? `${e.method} ${e.url} failed: ${e.failure ?? ''}`
          : `${e.method} ${e.url} -> ${e.status} ${e.statusText ?? ''}`,
      evidence: {
        url: e.url,
        method: e.method,
        status: e.status,
        resourceType: e.resourceType ?? '',
        failure: e.failure ?? '',
      },
    });
  }
  return newResult('network', target, start, findings);
}
