import { useEffect, useState } from 'react';

import { booksRepo, useDatabase } from '@/db';

/** Number of books in the catalogue, or null while loading. */
export function useBookCount(): number | null {
  const db = useDatabase();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    booksRepo
      .countBooks(db)
      .then((n) => active && setCount(n))
      .catch((e) => console.error('Could not count books', e));
    return () => {
      active = false;
    };
  }, [db]);
  return count;
}
