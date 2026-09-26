import { systemClock, type Clock } from './clock';
import { abortError } from './errors';

/** A queue with its own pace, e.g. Open Library covers by id (PLAN §6 etiquette). */
export interface RateRule {
  /** Minimum gap between the starts of two requests in this queue. Defaults to the limiter's `minIntervalMs`. */
  minIntervalMs?: number;
  /**
   * Requests of this queue in flight at once. When set, the queue has its own
   * pool and does not take a place from the shared `maxConcurrent`.
   */
  maxConcurrent?: number;
}

export interface RateLimiterOptions {
  /** Minimum gap between the starts of two requests to the same host. Default 1000 ms. */
  minIntervalMs?: number;
  /** Requests in flight at once, across all hosts without a rule of their own. Default 2. */
  maxConcurrent?: number;
  /** Queues (by the key passed to `schedule`) with a pace of their own. */
  rules?: Readonly<Record<string, RateRule>>;
  clock?: Clock;
}

export interface RateLimiter {
  /**
   * Runs `task` once the host's slot and a concurrency slot are free. Tasks
   * start in FIFO order per host. `host` is the queue key: usually the host
   * name, or a narrower key with a rule of its own (see `rateKeyOf`). Aborting `signal` while the task is queued
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

/**
 * A polite per-host request queue: ≤ 1 request/second per host, ≤ 2 in
 * flight overall; a queue with a rule keeps its own interval and, when the
 * rule says so, its own number in flight.
 */
export function createRateLimiter({ minIntervalMs = 1000, maxConcurrent = 2, rules = {}, clock = systemClock }: RateLimiterOptions = {}): RateLimiter {
  const queue: Job[] = [];
  const nextStart = new Map<string, number>();
  /** In flight per queue with its own pool. */
  const own = new Map<string, number>();
  /** In flight in the shared pool. */
  let shared = 0;
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

  const poolOf = (key: string) => rules[key]?.maxConcurrent;
  const hasRoom = (key: string) => {
    const cap = poolOf(key);
    return cap === undefined ? shared < maxConcurrent : (own.get(key) ?? 0) < cap;
  };

  function pump() {
    const now = clock.now();
    let earliest = Infinity;
    const blocked = new Set<string>();
    for (let i = 0; i < queue.length; ) {
      const job = queue[i];
      // Keep FIFO order within a host: once one job for a host waits, later ones do too.
      if (blocked.has(job.host)) {
        i++;
        continue;
      }
      if (!hasRoom(job.host)) {
        // Woken again when a request of its pool settles.
        blocked.add(job.host);
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
      nextStart.set(job.host, now + (rules[job.host]?.minIntervalMs ?? minIntervalMs));
      if (poolOf(job.host) === undefined) shared++;
      else own.set(job.host, (own.get(job.host) ?? 0) + 1);
      active++;
      job.start();
    }
    if (earliest < Infinity) wakeAt(earliest);
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
              if (poolOf(host) === undefined) shared--;
              else own.set(host, (own.get(host) ?? 1) - 1);
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
