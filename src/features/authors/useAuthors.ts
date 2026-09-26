import { useEffect, useState } from 'react';

import { authorsRepo, useDatabase, type AuthorWithCount } from '@/db';
import { useLibraryEvent } from '@/features/events';

/** Every author A-Z by sort name with book counts; null until loaded. Reloads on `library-changed`. */
export function useAuthors(): AuthorWithCount[] | null {
  const db = useDatabase();
  const [authors, setAuthors] = useState<AuthorWithCount[] | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    authorsRepo
      .listAuthorsWithCounts(db)
      .then((list) => active && setAuthors(list))
      .catch((e) => console.error('Could not load the authors', e));
    return () => {
      active = false;
    };
  }, [db, version]);
  useLibraryEvent('library-changed', () => setVersion((v) => v + 1));
  return authors;
}
