import { createHttpClient, createRateLimiter, type HttpClient } from '@/services/http';
import { createDefaultMetadataService, type MetadataService } from '@/services/metadata';
import { googleBooksRoutes } from '@/services/metadata/__fixtures__/googleBooksRoutes';
import { openLibraryRoutes } from '@/services/metadata/__fixtures__/openLibraryRoutes';

import { createFixtureFetch, type FixtureFetch, type FixtureRoutes } from './fixtureFetch';

export interface FixtureMetadata {
  service: MetadataService;
  http: HttpClient;
  fixtures: FixtureFetch;
}

/**
 * The real metadata service over the recorded Open Library and Google Books
 * fixtures (plus `extra` routes), with no rate limiting or retries, so tests
 * exercise the real mapping and merging without the network.
 */
export function createFixtureMetadata(extra: FixtureRoutes = {}): FixtureMetadata {
  const fixtures = createFixtureFetch(openLibraryRoutes, googleBooksRoutes, extra);
  const http = createHttpClient({ fetch: fixtures.fetch, limiter: createRateLimiter({ minIntervalMs: 0 }), retryDelaysMs: [] });
  return { service: createDefaultMetadataService({ http }), http, fixtures };
}
