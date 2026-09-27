import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  buildQueriesFromOcr,
  cleanOcrLine,
  formatIsbn13,
  isRepeatRead,
  parseScannedCode,
  queriesFromTypedText,
  textBounds,
  type OcrQuery,
  type OcrResult,
} from '@/domain';
import { useMetadataService } from '@/features/lookup/metadataService';
import { usePendingLookupsContext } from '@/features/lookup/PendingLookupsProvider';
import { t } from '@/i18n';
import { isAbortError, OfflineError } from '@/services/http';
import { toIsbn13, type MetadataService } from '@/services/metadata';

import { searchCover as runCoverSearch } from './coverSearch';
import { tick } from './haptics';
import { titleCase } from './prefill';
import { createSession, type ScanSession } from './sessionStore';
import { discardPhoto } from './tempPhoto';

export type ScanPhase =
  /** Waiting for a barcode or typed input. */
  | { phase: 'ready' }
  /** A lookup is running (the Booky sheet with Cancel). */
  | { phase: 'looking-up'; kind: 'isbn' | 'cover'; label: string }
  /**
   * Nothing found: offer the cover, or adding it by hand with what is known.
   * `typed`: for a cover, the words read, to search again with changes.
   */
  | { phase: 'not-found'; kind: 'isbn' | 'cover'; isbn13: string | null; guess: OcrQuery | null; typed?: string }
  /** A product barcode, not a book's. */
  | { phase: 'not-book'; data: string }
  /**
   * Something went wrong; `offline` when the catalogues could not be reached.
   * `typed`: a cover photo read without a title, with whatever words it had,
   * to type the rest.
   */
  | { phase: 'error'; reason: 'offline' | 'invalid' | 'failed'; message: string; typed?: string };

/** A short message shown while scanning continues (queued offline, added to the tray). */
export interface ScanNotice {
  expression: 'sleepy' | 'excited' | 'happy';
  message: string;
}

export interface UseScanSessionOptions {
  service?: MetadataService;
  /**
   * Called with a session that has candidates. Default: open the edition
   * picker. Batch scanning passes its own (straight to the tray).
   */
  onFound?: (session: ScanSession) => void;
}

export interface ScanSessionApi {
  state: ScanPhase;
  notice: ScanNotice | null;
  /** The camera is paused while a lookup runs or a result is on screen. */
  paused: boolean;
  /** The last book found, for the mini card (P03-13). */
  lastFound: { title: string; authors: string[]; coverUrl: string | null } | null;
  /** A barcode read from the camera. Repeats of the same code within 3 s are ignored. */
  onBarcode: (read: { type?: string | null; data: string }) => void;
  /** A typed ISBN (the web harness, or "Type ISBN instead"). */
  submitIsbn: (text: string) => void;
  /** Typed cover text (the web harness): searched exactly as OCR output would be. */
  submitCoverText: (text: string) => void;
  /** Text recognised on a cover photo. */
  submitOcr: (result: OcrResult, photoUri?: string | null) => void;
  cancel: () => void;
  /** Back to scanning (after a not-found, an error or a not-a-book message). */
  resume: () => void;
  dismissNotice: () => void;
}

/** Booky's messages while scanning, in the catalogue's language (read when shown, never at import). */
export const scanMessages = {
  get notBook() {
    return t('scan.messages.notBook');
  },
  get invalidIsbn() {
    return t('scan.messages.invalidIsbn');
  },
  get noCoverText() {
    return t('scan.messages.noCoverText');
  },
  get noCoverRead() {
    return t('scan.messages.noCoverRead');
  },
  get noCoverWords() {
    return t('scan.messages.noCoverWords');
  },
  get offlineCover() {
    return t('scan.messages.offlineCover');
  },
  get queued() {
    return t('scan.messages.queued');
  },
  get failed() {
    return t('common.lookupFailed');
  },
};

const REPEAT_WINDOW_MS = 3000;

/** A cover search's words as the typed field takes them: the title, then the author, on their own lines. */
export function typedFromQuery(query: OcrQuery): string {
  const title = query.title ?? (query.author ? '' : (query.text ?? ''));
  return [title, query.author ?? ''].map((s) => titleCase(s)).filter(Boolean).join('\n');
}

/**
 * The words on a photo that gave no title, largest first (at most four
 * lines), for the user to correct and search with; empty when there were none.
 */
export function ocrWords(result: OcrResult): string {
  const lines = result.blocks.flatMap((b) => (b.lines.length ? b.lines : [{ text: b.text, frame: b.frame }]));
  return lines
    .map((l) => ({ text: cleanOcrLine(l.text), height: l.frame.height }))
    .filter((l) => /\p{L}{2}/u.test(l.text))
    .sort((a, b) => b.height - a.height)
    .slice(0, 4)
    .map((l) => l.text)
    .join('\n');
}

/**
 * The last book found, kept for the app session: the Scan tab unmounts while
 * the picker is open, and the mini card should still be there on return.
 */
let rememberedLastFound: ScanSessionApi['lastFound'] = null;

/** Tests: forget the last book found. */
export function resetLastFound(): void {
  rememberedLastFound = null;
}

/**
 * The scan flow (P03-03, P03-04, P03-07): a barcode, a typed ISBN, typed
 * cover text or OCR output goes in; a lookup runs (cancellable); one or more
 * candidates open the edition picker, nothing found offers the cover or
 * manual entry, and an offline barcode is queued for later while scanning
 * carries on.
 */
export function useScanSession({ service: injected, onFound }: UseScanSessionOptions = {}): ScanSessionApi {
  const appService = useMetadataService();
  const service = injected ?? appService;
  const pending = usePendingLookupsContext();
  const [state, setState] = useState<ScanPhase>({ phase: 'ready' });
  const [notice, setNotice] = useState<ScanNotice | null>(null);
  const [lastFound, setLastFound] = useState<ScanSessionApi['lastFound']>(rememberedLastFound);
  const controller = useRef<AbortController | null>(null);
  const lastRead = useRef<{ data: string; at: number } | null>(null);
  const busy = useRef(false);

  useEffect(() => () => controller.current?.abort(), []);

  const found = useCallback(
    (session: ScanSession) => {
      const first = session.candidates[0];
      rememberedLastFound = { title: first.title, authors: first.authors, coverUrl: first.coverUrl };
      setLastFound(rememberedLastFound);
      setState({ phase: 'ready' });
      if (onFound) onFound(session);
      else router.navigate({ pathname: '/scan/pick', params: { session: session.id } });
    },
    [onFound],
  );

  const begin = useCallback((kind: 'isbn' | 'cover', label: string) => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    busy.current = true;
    setNotice(null);
    setState({ phase: 'looking-up', kind, label });
    return abort;
  }, []);

  const finish = useCallback((abort: AbortController) => {
    if (controller.current === abort) controller.current = null;
    busy.current = false;
  }, []);

  const lookUp = useCallback(
    async (isbn13: string, source: ScanSession['source']) => {
      const abort = begin('isbn', t('scan.messages.lookingUp', { isbn: formatIsbn13(isbn13) }));
      try {
        const { candidates } = await service.lookupIsbn(isbn13, { signal: abort.signal });
        if (abort.signal.aborted) return;
        if (!candidates.length) return setState({ phase: 'not-found', kind: 'isbn', isbn13, guess: null });
        found(createSession({ source, isbn13, candidates }));
      } catch (error) {
        if (abort.signal.aborted || isAbortError(error)) return;
        if (error instanceof OfflineError) {
          // Keep scanning: the queue looks it up when the app is back online (P02-10).
          // With the app's queue, Booky says so (sleepy); otherwise say it here.
          if (pending) await pending.queue(isbn13).catch(() => undefined);
          else setNotice({ expression: 'sleepy', message: scanMessages.queued });
          setState({ phase: 'ready' });
          return;
        }
        setState({ phase: 'error', reason: 'failed', message: scanMessages.failed });
      } finally {
        finish(abort);
      }
    },
    [begin, finish, found, pending, service],
  );

  const searchCover = useCallback(
    async (queries: OcrQuery[], photoUri: string | null, ocr: OcrResult | null = null) => {
      if (!queries.length) {
        discardPhoto(photoUri);
        if (!ocr) return setState({ phase: 'error', reason: 'invalid', message: scanMessages.noCoverText });
        const words = ocrWords(ocr);
        return setState({ phase: 'error', reason: 'invalid', message: words ? scanMessages.noCoverRead : scanMessages.noCoverWords, typed: words });
      }
      const abort = begin('cover', t('scan.messages.searching', { text: queries[0].title ?? queries[0].text ?? '' }));
      try {
        const { candidates, used } = await runCoverSearch((q, signal) => service.search(q, { signal }), queries, { signal: abort.signal });
        if (abort.signal.aborted) return;
        if (!candidates.length) {
          discardPhoto(photoUri);
          return setState({ phase: 'not-found', kind: 'cover', isbn13: null, guess: queries[0], typed: typedFromQuery(queries[0]) });
        }
        found(createSession({ source: 'cover', candidates, guess: used ?? queries[0], photoUri, photoFocus: ocr && photoUri ? textBounds(ocr) : null }));
      } catch (error) {
        discardPhoto(photoUri);
        if (abort.signal.aborted || isAbortError(error)) return;
        setState({
          phase: 'error',
          reason: error instanceof OfflineError ? 'offline' : 'failed',
          message: error instanceof OfflineError ? scanMessages.offlineCover : scanMessages.failed,
        });
      } finally {
        finish(abort);
      }
    },
    [begin, finish, found, service],
  );

  const onBarcode = useCallback(
    (read: { type?: string | null; data: string }) => {
      if (busy.current) return;
      const now = Date.now();
      if (isRepeatRead(lastRead.current, read.data, now, REPEAT_WINDOW_MS)) return;
      lastRead.current = { data: read.data, at: now };
      const code = parseScannedCode(read);
      if (code.kind === 'invalid') return;
      if (code.kind === 'product') {
        setState({ phase: 'not-book', data: code.data });
        return;
      }
      tick();
      void lookUp(code.isbn13, 'barcode');
    },
    [lookUp],
  );

  const submitIsbn = useCallback(
    (text: string) => {
      const isbn13 = toIsbn13(text.trim());
      if (!isbn13) {
        setState({ phase: 'error', reason: 'invalid', message: scanMessages.invalidIsbn });
        return;
      }
      void lookUp(isbn13, 'isbn');
    },
    [lookUp],
  );

  const submitCoverText = useCallback((text: string) => void searchCover(queriesFromTypedText(text), null), [searchCover]);
  const submitOcr = useCallback(
    (result: OcrResult, photoUri: string | null = null) => void searchCover(buildQueriesFromOcr(result), photoUri, result),
    [searchCover],
  );

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    busy.current = false;
    setState({ phase: 'ready' });
  }, []);

  const resume = useCallback(() => {
    lastRead.current = null;
    setState({ phase: 'ready' });
  }, []);

  return {
    state,
    notice,
    paused: state.phase !== 'ready',
    lastFound,
    onBarcode,
    submitIsbn,
    submitCoverText,
    submitOcr,
    cancel,
    resume,
    dismissNotice: () => setNotice(null),
  };
}
