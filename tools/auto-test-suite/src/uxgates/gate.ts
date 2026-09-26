// The gates are the checks that run alongside journey assertions and catch
// what ships green: a blank page, an unstyled page, console errors, failed
// requests and structural accessibility regressions. This file holds the
// shared types, the mode and the recorder that writes uxgates.json.
import { join } from 'node:path';

import { writeJSONFile } from '../browser/listeners.ts';
import type { GatesWriter } from '../browser/run.ts';

/** Controls whether gate failures fail the run. */
export type Mode = 'off' | 'warn' | 'fail';

/** Parses the --ux-gates flag value. The empty string means warn. */
export function parseMode(s: string): Mode {
  const v = s.trim().toLowerCase();
  if (v === 'off') return 'off';
  if (v === 'warn' || v === '') return 'warn';
  if (v === 'fail') return 'fail';
  throw new Error(`invalid --ux-gates "${s}" (want off, warn or fail)`);
}

/** Only error findings make a Result fail. */
export type Severity = 'error' | 'warn';
export const SeverityError: Severity = 'error';
export const SeverityWarn: Severity = 'warn';

/** One problem a gate observed, with the evidence for it. */
export interface Finding {
  gate: string;
  rule?: string;
  severity: Severity;
  message: string;
  evidence?: Record<string, unknown>;
}

/** A finding as a gate reports it, before the result fills in gate and default severity. */
export interface RawFinding {
  rule?: string;
  severity?: Severity;
  message: string;
  evidence?: Record<string, unknown>;
}

/** One gate run against one target (a URL, optionally at a viewport). */
export interface Result {
  gate: string;
  target: string;
  pass: boolean;
  durationMs: number;
  findings: Finding[];
  skipped?: string[]; // disabled rules, with reasons
}

/** Builds a Result: findings default to error severity; any error finding fails it. */
export function newResult(gate: string, target: string, startMs: number, raw: ReadonlyArray<RawFinding>, skipped?: string[]): Result {
  // Key order matches the documented JSON: gate, rule, severity, message, evidence.
  const findings: Finding[] = raw.map((f) => ({
    gate,
    ...(f.rule ? { rule: f.rule } : {}),
    severity: f.severity ?? SeverityError,
    message: f.message,
    ...(f.evidence && Object.keys(f.evidence).length > 0 ? { evidence: f.evidence } : {}),
  }));
  const res: Result = {
    gate,
    target,
    pass: findings.every((f) => f.severity !== SeverityError),
    durationMs: Date.now() - startMs,
    findings,
  };
  if (skipped && skipped.length > 0) res.skipped = skipped;
  return res;
}

/** Downgrades one gate rule to a warning for one journey. The finding is still recorded. */
export interface Waiver {
  gate: string;
  rule: string;
  reason: string;
}

/** Counts results and findings per gate. */
export interface Summary {
  mode: Mode;
  failed: boolean;
  results: number;
  findings: number;
  findingsByGate: Record<string, number>;
}

/** Thrown-or-returned by Recorder.add in fail mode. */
export class GateError extends Error {
  constructor(readonly result: Result) {
    const msgs = result.findings
      .filter((f) => f.severity === SeverityError)
      .map((f) => (f.rule ? `${f.rule}: ${f.message}` : f.message));
    super(`${result.gate} gate failed on ${result.target}: ${msgs.join('; ')}`);
    this.name = 'GateError';
  }
}

/** Collects results for one run and writes uxgates.json. */
export class Recorder implements GatesWriter {
  private readonly results: Result[] = [];
  private readonly waivers: Waiver[] = [];

  constructor(readonly mode: Mode) {}

  /** Registers a waiver. A reason is mandatory. */
  waive(gate: string, rule: string, reason: string): void {
    if (reason.trim() === '') throw new Error('uxgates: a waiver needs a reason');
    this.waivers.push({ gate, rule, reason });
  }

  private applyWaivers(res: Result): Result {
    if (this.waivers.length === 0) return res;
    const findings = res.findings.map((f) => {
      let out = f;
      for (const w of this.waivers) {
        if (w.gate === out.gate && w.rule === out.rule && out.severity === SeverityError) {
          out = { ...out, severity: SeverityWarn, message: `[waived: ${w.reason}] ${out.message}` };
        }
      }
      return out;
    });
    return { ...res, findings, pass: findings.every((f) => f.severity !== SeverityError) };
  }

  /** Whether gates should run at all. */
  enabled(): boolean {
    return this.mode !== 'off';
  }

  // add records a result. It returns an error only in fail mode and only when
  // the result failed, which is what makes --ux-gates warn usable during
  // cleanup.
  add(res: Result): GateError | undefined {
    const r = this.applyWaivers(res);
    this.results.push(r);
    if (r.pass || this.mode !== 'fail') return undefined;
    return new GateError(r);
  }

  /** A copy of what was recorded. */
  all(): Result[] {
    return [...this.results];
  }

  /** Whether any recorded result failed, regardless of mode. */
  failed(): boolean {
    return this.results.some((r) => !r.pass);
  }

  /** Counts for the JSON output. */
  summary(): Summary {
    const s: Summary = { mode: this.mode, failed: false, results: 0, findings: 0, findingsByGate: {} };
    for (const res of this.results) {
      s.results++;
      if (!res.pass) s.failed = true;
      for (const f of res.findings) {
        s.findings++;
        s.findingsByGate[f.gate] = (s.findingsByGate[f.gate] ?? 0) + 1;
      }
    }
    return s;
  }

  /** Failing findings flattened into one-line messages for stdout. */
  failures(): string[] {
    const out: string[] = [];
    for (const r of this.results) {
      for (const f of r.findings) {
        if (f.severity !== SeverityError) continue;
        out.push(`${f.gate}${f.rule ? '/' + f.rule : ''} [${r.target}]: ${f.message}`);
      }
    }
    return out;
  }

  /** Writes uxgates.json into dir. */
  async writeJSON(dir: string): Promise<string> {
    const p = join(dir, 'uxgates.json');
    await writeJSONFile(p, { mode: this.mode, failed: this.failed(), waivers: [...this.waivers], results: this.all() });
    return p;
  }
}

/** Truncates s to n characters, marking the cut. */
export function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + '...';
}
