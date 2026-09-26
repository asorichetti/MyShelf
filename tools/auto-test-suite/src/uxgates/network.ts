import type { Listeners } from '../browser/listeners.ts';
import { isExpectedMissing } from './expected.ts';
import { newResult, type RawFinding, type Result } from './gate.ts';

// networkGate fails on any request that got status >= 400 or no response at
// all, except URLs carrying ExpectedMissingMarker.
export function networkGate(l: Listeners, target: string): Result {
  const start = Date.now();
  const findings: RawFinding[] = [];
  for (const e of l.snapshot().network) {
    if (isExpectedMissing(e.url)) continue;
    const failed = e.status === 0;
    findings.push({
      rule: failed ? 'request-failed' : 'http-status',
      message: failed
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
