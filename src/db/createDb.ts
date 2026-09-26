import type { Connection, Db, SqlParams } from './types';

const NO_PARAMS: SqlParams = [];

/**
 * Wraps a raw connection with a FIFO lock so a transaction is never
 * interleaved with other statements, and implements nested transactions as
 * savepoints.
 */
export function createDb(conn: Connection): Db {
  let tail: Promise<unknown> = Promise.resolve();

  function locked<T>(fn: () => Promise<T>): Promise<T> {
    const result = tail.then(fn, fn);
    tail = result.catch(() => undefined);
    return result;
  }

  function handle(depth: number, guard: <T>(fn: () => Promise<T>) => Promise<T>): Db {
    const self: Db = {
      exec: (sql) => guard(() => conn.exec(sql)),
      run: (sql, params = NO_PARAMS) => guard(() => conn.run(sql, params)),
      get: <T>(sql: string, params: SqlParams = NO_PARAMS) => guard(() => conn.get<T>(sql, params)),
      all: <T>(sql: string, params: SqlParams = NO_PARAMS) => guard(() => conn.all<T>(sql, params)),
      transaction: <T>(fn: (tx: Db) => Promise<T>) =>
        guard(async () => {
          const inner = handle(depth + 1, (f) => f());
          const sp = `sp_${depth + 1}`;
          await conn.exec(depth === 0 ? 'BEGIN' : `SAVEPOINT ${sp}`);
          try {
            const value = await fn(inner);
            await conn.exec(depth === 0 ? 'COMMIT' : `RELEASE ${sp}`);
            return value;
          } catch (error) {
            await conn.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
            throw error;
          }
        }),
      close: () => guard(() => conn.close()),
    };
    return self;
  }

  return handle(0, locked);
}
