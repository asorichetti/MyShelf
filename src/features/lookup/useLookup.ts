import { useCallback, useEffect, useRef, useState } from 'react';

import { normalizeIsbn } from '@/domain';
import { isAbortError, OfflineError, RateLimitedError } from '@/services/http';
import { InvalidIsbnError, toIsbn13, type BookCandidate, type MetadataService, type ProviderWarning } from '@/services/metadata';

import { useMetadataService } from './metadataService';

export type LookupMode = 'isbn' | 'search';

export type LookupState =
  | { status: 'idle' }
  | { status: 'loading'; mode: LookupMode; query: string }
  | { status: 'results'; mode: LookupMode; query: string; candidates: BookCandidate[]; warnings: ProviderWarning[] }
  | { status: 'empty'; mode: LookupMode; query: string; warnings: ProviderWarning[] }
  /** `invalid`: not an ISBN; `offline`: no network; `busy`: the catalogues asked us to wait; `failed`: anything else. */
  | { status: 'error'; mode: LookupMode; query: string; reason: 'invalid' | 'offline' | 'busy' | 'failed'; message: string };

export interface Lookup {
  state: LookupState;
  /** Looks up one ISBN (10 or 13 digits, hyphens allowed). */
  lookupIsbn: (text: string) => Promise<void>;
  /** Searches both catalogues for free text ("colour of magic pratchett"). */
  search: (text: string) => Promise<void>;
  /** Stops a lookup in progress (its request is aborted) and goes back to idle. */
  cancel: () => void;
  reset: () => void;
}

export interface UseLookupOptions {
  /** Defaults to the app's metadata service. */
  service?: MetadataService;
}

/** Plain-language messages; they never blame the user (PLAN §8). */
export const lookupMessages = {
  invalid: 'That doesn’t look like an ISBN. It’s the 10 or 13 digits above the barcode, usually starting 978.',
  empty: 'Type an ISBN first — it’s on the back cover, above the barcode.',
  emptySearch: 'Type a title, an author, or both.',
  offline: 'I can’t reach the library catalogues right now. You can still type the book in by hand.',
  busy: 'The catalogues asked me to slow down. Please try again in a minute.',
  failed: 'Something went wrong while I was looking. Please try again.',
} as const;

function errorState(mode: LookupMode, query: string, error: unknown): LookupState {
  if (error instanceof InvalidIsbnError) return { status: 'error', mode, query, reason: 'invalid', message: lookupMessages.invalid };
  if (error instanceof OfflineError) return { status: 'error', mode, query, reason: 'offline', message: lookupMessages.offline };
  if (error instanceof RateLimitedError) return { status: 'error', mode, query, reason: 'busy', message: lookupMessages.busy };
  return { status: 'error', mode, query, reason: 'failed', message: lookupMessages.failed };
}

/**
 * "Look up by ISBN" and "Search online" (P02-11): one lookup at a time, each
 * cancellable (its HTTP requests are aborted) and cancelled when the screen
 * goes away. Results are merged and ranked candidates from both providers;
 * a provider that failed while the other answered shows up in `warnings`.
 */
export function useLookup({ service: injected }: UseLookupOptions = {}): Lookup {
  const appService = useMetadataService();
  const service = injected ?? appService;
  const [state, setState] = useState<LookupState>({ status: 'idle' });
  const controller = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState({ status: 'idle' });
  }, []);

  useEffect(() => () => controller.current?.abort(), []);

  const run = useCallback(
    async (mode: LookupMode, query: string, call: (signal: AbortSignal) => ReturnType<MetadataService['search']>) => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      setState({ status: 'loading', mode, query });
      try {
        const { candidates, warnings } = await call(abort.signal);
        if (abort.signal.aborted) return;
        setState(candidates.length ? { status: 'results', mode, query, candidates, warnings } : { status: 'empty', mode, query, warnings });
      } catch (error) {
        if (abort.signal.aborted || isAbortError(error)) return;
        setState(errorState(mode, query, error));
      } finally {
        if (controller.current === abort) controller.current = null;
      }
    },
    [],
  );

  const lookupIsbn = useCallback(
    async (text: string) => {
      const query = text.trim();
      if (!normalizeIsbn(query)) {
        setState({ status: 'error', mode: 'isbn', query, reason: 'invalid', message: lookupMessages.empty });
        return;
      }
      if (!toIsbn13(query)) {
        setState({ status: 'error', mode: 'isbn', query, reason: 'invalid', message: lookupMessages.invalid });
        return;
      }
      await run('isbn', query, (signal) => service.lookupIsbn(query, { signal }));
    },
    [run, service],
  );

  const search = useCallback(
    async (text: string) => {
      const query = text.replace(/\s+/g, ' ').trim();
      if (!query) {
        setState({ status: 'error', mode: 'search', query, reason: 'invalid', message: lookupMessages.emptySearch });
        return;
      }
      // An ISBN typed into the search box is looked up as one.
      if (toIsbn13(query)) return run('isbn', query, (signal) => service.lookupIsbn(query, { signal }));
      await run('search', query, (signal) => service.search({ text: query.toLowerCase() }, { signal }));
    },
    [run, service],
  );

  const reset = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState({ status: 'idle' });
  }, []);

  return { state, lookupIsbn, search, cancel, reset };
}
