export interface Genre {
  id: number;
  name: string;
}

export interface BookGenre extends Genre {
  /** True when the user chose or edited this genre (never overwritten by lookups). */
  userEdited: boolean;
}

/** Genres offered before the user has made any of their own. */
export const starterGenres: readonly string[] = [
  'Fiction',
  'Fantasy',
  'Science Fiction',
  'Mystery',
  'Thriller',
  'Romance',
  'Historical Fiction',
  'Horror',
  'Literary Fiction',
  'Young Adult',
  "Children's",
  'Graphic Novel',
  'Poetry',
  'Biography',
  'Memoir',
  'History',
  'Science',
  'Philosophy',
  'Self-Help',
  'Cookery',
  'Travel',
  'Art',
  'Religion',
  'Business',
  'Reference',
];

/**
 * Suggestions for the genre picker: the user's own genres first, then the
 * starter list, without duplicates (ignoring case) or genres already chosen.
 * With a query, only names containing it at the start of a word.
 */
export function genreSuggestions(existing: readonly string[], chosen: readonly string[], query = '', limit = 8): string[] {
  const taken = new Set(chosen.map((g) => g.trim().toLowerCase()));
  const q = query.trim().toLowerCase();
  const out: string[] = [];
  for (const name of [...existing, ...starterGenres]) {
    const key = name.toLowerCase();
    if (taken.has(key)) continue;
    if (q && !key.split(/[\s-]+/).some((word) => word.startsWith(q)) && !key.startsWith(q)) continue;
    taken.add(key);
    out.push(name);
    if (out.length === limit) break;
  }
  return out;
}
