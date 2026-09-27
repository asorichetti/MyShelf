import type { Db } from '@/db';

const mockMarker = { exists: false, text: '', deleted: false };
jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///data/files' },
  File: jest.fn().mockImplementation(() => ({
    get exists() {
      return mockMarker.exists && !mockMarker.deleted;
    },
    textSync: () => mockMarker.text,
    delete: () => {
      mockMarker.deleted = true;
    },
  })),
}));
let mockE2e = true;
jest.mock('@/features/e2e/e2eFlag', () => ({ isE2eEnabled: () => mockE2e }));

const db = {} as Db;

/** A fresh copy of the module: the fault is used once per app start. */
function load(): typeof import('@/features/e2e/databaseFault') {
  let mod!: typeof import('@/features/e2e/databaseFault');
  jest.isolateModules(() => {
    mod = jest.requireActual('@/features/e2e/databaseFault');
  });
  return mod;
}

beforeEach(() => {
  Object.assign(mockMarker, { exists: false, text: '', deleted: false });
  mockE2e = true;
});

describe('withE2eDatabaseFault (Android)', () => {
  it('opens normally without a marker', async () => {
    const open = jest.fn(async () => db);
    await expect(load().withE2eDatabaseFault(open)()).resolves.toBe(db);
  });

  it.each([
    ['migrate', 'MigrationError', 'E2E: a simulated migration failure'],
    ['open', 'Error', 'E2E: a simulated failure opening the database'],
  ] as const)('fails the first open with a %s marker, deletes it, then opens the real library', async (fault, type, message) => {
    Object.assign(mockMarker, { exists: true, text: `${fault}\n` });
    const open = jest.fn(async () => db);
    const faulty = load().withE2eDatabaseFault(open);
    const error: Error = await faulty().then(
      () => new Error('expected the first open to fail'),
      (e: Error) => e,
    );
    // The class comes from the isolated module copy, so compare by name.
    expect(error.constructor.name).toBe(type);
    expect(error.message).toBe(message);
    expect(open).not.toHaveBeenCalled();
    expect(mockMarker.deleted).toBe(true);
    await expect(faulty()).resolves.toBe(db);
  });

  it('ignores the marker in a build without the E2E loader', async () => {
    mockE2e = false;
    Object.assign(mockMarker, { exists: true, text: 'migrate' });
    const open = jest.fn(async () => db);
    await expect(load().withE2eDatabaseFault(open)()).resolves.toBe(db);
    expect(mockMarker.deleted).toBe(false);
  });
});
