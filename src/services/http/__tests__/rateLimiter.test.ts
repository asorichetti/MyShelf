/**
 * @jest-environment node
 */
import { createRateLimiter } from '../rateLimiter';

/** A task that stays in flight until `finish()` is called. */
function deferredTask(log: string[], label: string) {
  let finish!: () => void;
  const done = new Promise<void>((resolve) => (finish = resolve));
  const task = () => {
    log.push(`${label}@${Date.now()}`);
    return done.then(() => label);
  };
  return { task, finish: () => finish() };
}

beforeEach(() => {
  jest.useFakeTimers({ now: 0 });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('createRateLimiter', () => {
  it('spaces requests to one host at least 1000 ms apart, in order', async () => {
    const limiter = createRateLimiter();
    const starts: number[] = [];
    const run = (n: number) =>
      limiter.schedule('openlibrary.org', async () => {
        starts.push(Date.now());
        return n;
      });
    const results = Promise.all([run(1), run(2), run(3), run(4)]);
    await jest.advanceTimersByTimeAsync(0);
    expect(starts).toEqual([0]);
    await jest.advanceTimersByTimeAsync(999);
    expect(starts).toEqual([0]);
    await jest.advanceTimersByTimeAsync(1);
    expect(starts).toEqual([0, 1000]);
    await jest.advanceTimersByTimeAsync(2000);
    expect(await results).toEqual([1, 2, 3, 4]);
    expect(starts).toEqual([0, 1000, 2000, 3000]);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(1000);
  });

  it('does not delay requests to different hosts', async () => {
    const limiter = createRateLimiter();
    const starts: string[] = [];
    const run = (host: string) => limiter.schedule(host, async () => void starts.push(`${host}@${Date.now()}`));
    await Promise.all([run('openlibrary.org'), run('www.googleapis.com')]);
    expect(starts).toEqual(['openlibrary.org@0', 'www.googleapis.com@0']);
  });

  it('keeps at most two requests in flight overall', async () => {
    const limiter = createRateLimiter();
    const log: string[] = [];
    const a = deferredTask(log, 'a');
    const b = deferredTask(log, 'b');
    const c = deferredTask(log, 'c');
    const pa = limiter.schedule('one.example', a.task);
    limiter.schedule('two.example', b.task);
    const pc = limiter.schedule('three.example', c.task);
    await jest.advanceTimersByTimeAsync(5000);
    expect(log).toEqual(['a@0', 'b@0']);
    expect(limiter.active).toBe(2);
    expect(limiter.queued).toBe(1);
    a.finish();
    await pa;
    await jest.advanceTimersByTimeAsync(0);
    expect(log).toEqual(['a@0', 'b@0', 'c@5000']);
    c.finish();
    b.finish();
    await pc;
  });

  it('lets a later host go ahead while an earlier host waits for its slot', async () => {
    const limiter = createRateLimiter();
    const starts: string[] = [];
    const run = (host: string) => limiter.schedule(host, async () => void starts.push(`${host}@${Date.now()}`));
    await run('a.example');
    const pending = [run('a.example'), run('b.example')];
    await jest.advanceTimersByTimeAsync(0);
    expect(starts).toEqual(['a.example@0', 'b.example@0']);
    await jest.advanceTimersByTimeAsync(1000);
    await Promise.all(pending);
    expect(starts).toEqual(['a.example@0', 'b.example@0', 'a.example@1000']);
  });

  it('removes an aborted request from the queue and rejects it with AbortError', async () => {
    const limiter = createRateLimiter();
    const ran: number[] = [];
    const controller = new AbortController();
    const first = limiter.schedule('openlibrary.org', async () => void ran.push(1));
    const second = limiter.schedule('openlibrary.org', async () => void ran.push(2), controller.signal);
    const third = limiter.schedule('openlibrary.org', async () => void ran.push(3));
    await first;
    controller.abort();
    await expect(second).rejects.toMatchObject({ name: 'AbortError' });
    expect(limiter.queued).toBe(1);
    await jest.advanceTimersByTimeAsync(1000);
    await third;
    expect(ran).toEqual([1, 3]);
  });

  it('rejects at once when the signal is already aborted', async () => {
    const limiter = createRateLimiter();
    const task = jest.fn(async () => 1);
    await expect(limiter.schedule('x.example', task, AbortSignal.abort())).rejects.toMatchObject({ name: 'AbortError' });
    expect(task).not.toHaveBeenCalled();
  });

  it('frees the slot when a task fails', async () => {
    const limiter = createRateLimiter({ maxConcurrent: 1, minIntervalMs: 0 });
    await expect(limiter.schedule('x.example', async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(limiter.active).toBe(0);
    await expect(limiter.schedule('x.example', async () => 'ok')).resolves.toBe('ok');
  });

  it('accepts an injected clock', async () => {
    let now = 50_000;
    const timers: { fn: () => void; at: number }[] = [];
    const limiter = createRateLimiter({
      clock: {
        now: () => now,
        setTimeout: (fn, ms) => timers.push({ fn, at: now + ms }),
        clearTimeout: () => undefined,
      },
    });
    const starts: number[] = [];
    await limiter.schedule('h', async () => void starts.push(now));
    const second = limiter.schedule('h', async () => void starts.push(now));
    expect(timers.map((t) => t.at)).toEqual([51_000]);
    now = 51_000;
    timers[0].fn();
    await second;
    expect(starts).toEqual([50_000, 51_000]);
  });
});
