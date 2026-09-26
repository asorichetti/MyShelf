import { useMemo } from 'react';

import { apiCacheRepo, settingsRepo, useDatabase, type Db } from '@/db';
import { APP_RATE_RULES, createHttpClient, createRateLimiter, createResponseCache, type HttpClient } from '@/services/http';
import { userAgent } from '@/services/http/userAgent';
import { createDefaultMetadataService, type MetadataService } from '@/services/metadata';

/** One queue for the whole app, so the per-host etiquette (PLAN §6) holds across every client. */
const limiter = createRateLimiter({ rules: APP_RATE_RULES });

interface Wired {
  http: HttpClient;
  metadata: MetadataService;
}

const wired = new WeakMap<Db, Wired>();

/**
 * The app's HTTP client and metadata service for a database: User-Agent on
 * native, responses cached in `api_cache`, Google Books following the
 * `googleBooksEnabled` setting and the optional `EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY`.
 * Built once per database.
 */
export function getLookupServices(db: Db): Wired {
  let services = wired.get(db);
  if (!services) {
    const http = createHttpClient({ userAgent: userAgent(), limiter, cache: createResponseCache(apiCacheRepo.store(db)) });
    const metadata = createDefaultMetadataService({
      http,
      isGoogleBooksEnabled: () => settingsRepo.getSetting(db, 'googleBooksEnabled'),
      // Inlined at build time from .env.local (git-ignored); absent means keyless.
      googleBooksApiKey: process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY,
    });
    services = { http, metadata };
    wired.set(db, services);
  }
  return services;
}

/** The metadata service for the open database. */
export function useMetadataService(): MetadataService {
  const db = useDatabase();
  return useMemo(() => getLookupServices(db).metadata, [db]);
}
