import { getAllowlist, type AllowRule } from './config.ts';
import { isExpectedMissing } from './expected.ts';
import { newResult, truncate, type RawFinding, type Result } from './gate.ts';

import type { Listeners } from '../browser/listeners.ts';

// consoleGate fails on any console error or uncaught page error that is
// neither allowlisted (pattern + reason) nor about a deliberately missing URL.
export function consoleGate(l: Listeners, target: string): Result {
  const start = Date.now();
  const findings: RawFinding[] = [];
  let allowed = 0;
  for (const e of l.snapshot().console) {
    if (!e.isError) continue;
    if (isExpectedMissing(e.text) || isExpectedMissing(e.location)) continue;
    if (matchAllowlist(e.text)) {
      allowed++;
      continue;
    }
    findings.push({
      rule: e.type,
      message: truncate(e.text, 300),
      evidence: { type: e.type, location: e.location ?? '', text: e.text },
    });
  }
  return newResult('console', target, start, findings, allowed > 0 ? [`allowlisted console errors: ${allowed}`] : undefined);
}

function matchAllowlist(text: string): AllowRule | undefined {
  return getAllowlist().find((r) => r.re.test(text));
}
