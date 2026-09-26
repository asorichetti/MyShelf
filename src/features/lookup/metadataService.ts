import { useMemo } from 'react';

import { apiCacheRepo, settingsRepo, useDatabase, type Db } from '@/db';
import { createHttpClient, createRateLimiter, createResponseCache, type HttpClient } from '@/services/http';
import { userAgent } from '@/services/http/userAgent';
import { createDefaultMetadataService, type MetadataService } from '@/services/metadata';

/** One queue for the whole app, so the per-host etiquette holds across every client. */
const limiter = createRateLimiter();

interface Wired {
  http: HttpClient;
  metadata: MetadataService;
}

const wired = new WeakMap<Db, Wired>();

/**
 * The app's HTTP client and metadata service for a database: User-Agent on
 * native, responses cached in `api_cache`, Google Books following the
 * `googleBooksEnabled` setting. Built once per database.
 */
export function getLookupServices(db: Db): Wired {
  let services = wired.get(db);
  if (!services) {
    const http = createHttpClient({ userAgent: userAgent(), limiter, cache: createResponseCache(apiCacheRepo.store(db)) });
    const metadata = createDefaultMetadataService({
      http,
      isGoogleBooksEnabled: () => settingsRepo.getSetting(db, 'googleBooksEnabled'),
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
