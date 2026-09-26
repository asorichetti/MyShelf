import { systemClock, type Clock } from './clock';
import { abortError } from './errors';

export interface RateLimiterOptions {
  /** Minimum gap between the starts of two requests to the same host. Default 1000 ms. */
  minIntervalMs?: number;
  /** Requests in flight at once, across all hosts. Default 2. */
  maxConcurrent?: number;
  clock?: Clock;
}

export interface RateLimiter {
  /**
   * Runs `task` once the host's slot and a concurrency slot are free. Tasks
   * start in FIFO order per host. Aborting `signal` while the task is queued
   * rejects with an AbortError and frees its place.
   */
  schedule<T>(host: string, task: () => Promise<T>, signal?: AbortSignal): Promise<T>;
  /** Tasks waiting to start (for tests and diagnostics). */
  readonly queued: number;
  /** Tasks started and not yet settled. */
  readonly active: number;
}

interface Job {
  host: string;
  start: () => void;
}

/** A polite per-host request queue: ≤ 1 request/second per host, ≤ 2 in flight overall. */
export function createRateLimiter({ minIntervalMs = 1000, maxConcurrent = 2, clock = systemClock }: RateLimiterOptions = {}): RateLimiter {
  const queue: Job[] = [];
  const nextStart = new Map<string, number>();
  let active = 0;
  let timer: unknown = null;
  let timerAt = Infinity;

  function wakeAt(at: number) {
    if (timer !== null && timerAt <= at) return;
    if (timer !== null) clock.clearTimeout(timer);
    timerAt = at;
    timer = clock.setTimeout(() => {
      timer = null;
      timerAt = Infinity;
      pump();
    }, Math.max(0, at - clock.now()));
  }

  function pump() {
    const now = clock.now();
    let earliest = Infinity;
    const blocked = new Set<string>();
    for (let i = 0; i < queue.length && active < maxConcurrent; ) {
      const job = queue[i];
      // Keep FIFO order within a host: once one job for a host waits, later ones do too.
      if (blocked.has(job.host)) {
        i++;
        continue;
      }
      const readyAt = nextStart.get(job.host) ?? 0;
      if (readyAt > now) {
        blocked.add(job.host);
        earliest = Math.min(earliest, readyAt);
        i++;
        continue;
      }
      queue.splice(i, 1);
      nextStart.set(job.host, now + minIntervalMs);
      active++;
      job.start();
    }
    if (active < maxConcurrent && earliest < Infinity) wakeAt(earliest);
  }

  function schedule<T>(host: string, task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {
        reject(abortError(signal.reason));
        return;
      }
      const onAbort = () => {
        const index = queue.indexOf(job);
        if (index >= 0) {
          queue.splice(index, 1);
          reject(abortError(signal?.reason));
        }
      };
      const job: Job = {
        host,
        start: () => {
          signal?.removeEventListener('abort', onAbort);
          Promise.resolve()
            .then(task)
            .then(resolve, reject)
            .finally(() => {
              active--;
              pump();
            });
        },
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      queue.push(job);
      pump();
    });
  }

  return {
    schedule,
    get queued() {
      return queue.length;
    },
    get active() {
      return active;
    },
  };
}
