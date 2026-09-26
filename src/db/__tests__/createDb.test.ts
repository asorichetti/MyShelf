import type { Db } from '@/db';
import { openNodeDatabase } from '@/db/node';

let db: Db;
beforeEach(async () => {
  db = await openNodeDatabase();
  await db.exec('CREATE TABLE t (v INTEGER NOT NULL)');
});
afterEach(() => db.close());

const values = async () => (await db.all<{ v: number }>('SELECT v FROM t ORDER BY rowid')).map((r) => r.v);

describe('node adapter', () => {
  it('runs statements and reports inserts', async () => {
    const r = await db.run('INSERT INTO t (v) VALUES (?)', [7]);
    expect(r).toEqual({ lastInsertRowId: 1, changes: 1 });
    expect(await db.get('SELECT v FROM t')).toEqual({ v: 7 });
    expect(await db.get('SELECT v FROM t WHERE v = ?', [99])).toBeNull();
    expect(await db.all('SELECT v FROM t')).toEqual([{ v: 7 }]);
  });

  it('enforces foreign keys', async () => {
    const row = await db.get<{ foreign_keys: number }>('PRAGMA foreign_keys');
    expect(row?.foreign_keys).toBe(1);
  });
});

describe('transactions', () => {
  it('commits on success and returns the value', async () => {
    const out = await db.transaction(async (tx) => {
      await tx.run('INSERT INTO t (v) VALUES (1)');
      await tx.run('INSERT INTO t (v) VALUES (2)');
      return 'done';
    });
    expect(out).toBe('done');
    expect(await values()).toEqual([1, 2]);
  });

  it('rolls back everything on error', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.run('INSERT INTO t (v) VALUES (1)');
        await tx.run('INSERT INTO t (v) VALUES (NULL)');
      }),
    ).rejects.toThrow(/NOT NULL/);
    expect(await values()).toEqual([]);
  });

  it('nests as savepoints: an inner failure only undoes the inner work', async () => {
    await db.transaction(async (tx) => {
      await tx.run('INSERT INTO t (v) VALUES (1)');
      await expect(
        tx.transaction(async (inner) => {
          await inner.run('INSERT INTO t (v) VALUES (2)');
          throw new Error('inner boom');
        }),
      ).rejects.toThrow('inner boom');
      await tx.transaction(async (inner) => {
        await inner.run('INSERT INTO t (v) VALUES (3)');
      });
    });
    expect(await values()).toEqual([1, 3]);
  });

  it('queues other callers until the transaction finishes', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const tx = db.transaction(async (t) => {
      await t.run('INSERT INTO t (v) VALUES (1)');
      await gate;
      await t.run('INSERT INTO t (v) VALUES (2)');
    });
    const outside = db.run('INSERT INTO t (v) VALUES (3)');
    await Promise.resolve();
    release();
    await Promise.all([tx, outside]);
    expect(await values()).toEqual([1, 2, 3]);
  });

  it('keeps working after a failed statement', async () => {
    await expect(db.run('INSERT INTO nope VALUES (1)')).rejects.toThrow();
    await db.run('INSERT INTO t (v) VALUES (5)');
    expect(await values()).toEqual([5]);
  });
});
