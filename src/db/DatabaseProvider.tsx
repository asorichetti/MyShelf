import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { migrate } from './migrate';

import type { Db } from './types';

export type DatabaseStatus =
  | { state: 'loading' }
  | { state: 'ready'; db: Db }
  | { state: 'error'; error: Error };

const DatabaseContext = createContext<Db | null>(null);

export interface DatabaseProviderProps {
  /** Opens the database. The app passes the expo-sqlite opener; tests pass node:sqlite. */
  open: () => Promise<Db>;
  children: ReactNode;
  /** Shown while opening and migrating. */
  fallback?: ReactNode;
  /** Shown if opening or migrating fails. */
  renderError?: (error: Error, retry: () => void) => ReactNode;
  onStatusChange?: (status: DatabaseStatus['state']) => void;
}

/** Opens and migrates the database, then provides it to `useDatabase()`. */
export function DatabaseProvider({ open, children, fallback = null, renderError, onStatusChange }: DatabaseProviderProps) {
  const [status, setStatus] = useState<DatabaseStatus>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await open();
        await migrate(db);
        if (!cancelled) setStatus({ state: 'ready', db });
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        console.error('Could not open the MyShelf database', error);
        if (!cancelled) setStatus({ state: 'error', error });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, attempt]);

  useEffect(() => {
    onStatusChange?.(status.state);
  }, [status.state, onStatusChange]);

  const retry = () => {
    setStatus({ state: 'loading' });
    setAttempt((n) => n + 1);
  };

  if (status.state === 'loading') return <>{fallback}</>;
  if (status.state === 'error') return <>{renderError?.(status.error, retry) ?? null}</>;
  return <DatabaseContext.Provider value={status.db}>{children}</DatabaseContext.Provider>;
}

/** The open, migrated database. Only usable below a ready DatabaseProvider. */
export function useDatabase(): Db {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error('useDatabase must be used inside a ready DatabaseProvider');
  return db;
}

/** Test/preview helper: provides an already-open database directly. */
export function StaticDatabaseProvider({ db, children }: { db: Db; children: ReactNode }) {
  return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
}
