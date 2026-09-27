import { openDatabaseAsync } from 'expo-sqlite';

import { openScratchDatabase } from '../scratchDatabase';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: jest.fn(async () => undefined),
    closeAsync: jest.fn(async () => undefined),
  })),
}));

describe('openScratchDatabase', () => {
  it('opens an in-memory database that leaves SQLite to finalize its own statements on close', async () => {
    // expo-sqlite's default close finalizes every statement on the connection,
    // SQLite's own included, and crashed the app after an older backup was
    // brought up to date (scratchDatabase.ts).
    const db = await openScratchDatabase();
    expect(openDatabaseAsync).toHaveBeenCalledWith(':memory:', { finalizeUnusedStatementsBeforeClosing: false });
    await db.close();
  });
});
