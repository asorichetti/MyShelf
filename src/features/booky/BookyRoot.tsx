import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { BookyProvider, emitBooky, type BookyDecision } from '@/components/booky';
import { useDatabase } from '@/db';
import { noteForE2e } from '@/features/e2e/eventHook';
import { useLibraryEvent } from '@/features/events';

import { settingsBookyStore } from './bookyStore';

const noteDecision = (decision: BookyDecision) => noteForE2e('booky', decision);

/**
 * Booky for the whole app: the engine's provider with its memory in the
 * settings table (reloaded on `settings-changed`, e.g. after an E2E fixture
 * replaces the library), and the `app-foreground` event on start and
 * whenever the app comes back to the foreground. The web E2E build notes
 * every decision (`window.__myshelfE2e.notes.booky`), so a journey can wait
 * for Booky to have decided to stay quiet rather than for a fixed time.
 */
export function BookyRoot({ children }: { children: ReactNode }) {
  const db = useDatabase();
  const store = useMemo(() => settingsBookyStore(db), [db]);
  const [reloadKey, setReloadKey] = useState(0);
  useLibraryEvent('settings-changed', () => setReloadKey((k) => k + 1));

  useEffect(() => {
    // After this commit's effects, so everything listening has subscribed.
    const start = setTimeout(() => emitBooky({ type: 'app-foreground' }), 0);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') emitBooky({ type: 'app-foreground' });
    });
    return () => {
      clearTimeout(start);
      sub.remove();
    };
  }, []);

  return (
    <BookyProvider store={store} reloadKey={reloadKey} onDecision={noteDecision}>
      {children}
    </BookyProvider>
  );
}
