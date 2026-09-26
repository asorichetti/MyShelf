/**
 * books.google.com sends no CORS headers, so a browser can never read a
 * Google cover's bytes (P02-14): trying only costs a request and a console
 * error. The web build leaves Google out of the cover chain.
 */
export const GOOGLE_COVERS_REACHABLE = false;
