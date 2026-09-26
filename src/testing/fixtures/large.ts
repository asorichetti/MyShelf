import { generateBooks } from './generated';

import type { Fixture } from './types';

/** 2,000 generated books (200 authors, 10 genres, 40 series) for performance checks. Deterministic. */
export const large: Fixture = { books: generateBooks(2000) };
