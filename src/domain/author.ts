export type AuthorRole = 'author' | 'editor' | 'illustrator' | 'translator' | 'narrator' | (string & {});

export interface Author {
  id: number;
  name: string;
  /** Library-style sort key, e.g. "Tolkien, J. R. R.". */
  sortName: string | null;
}

export interface BookAuthor extends Author {
  role: AuthorRole;
  position: number;
}

export interface BookAuthorLink {
  authorId: number;
  role?: AuthorRole;
}

/** "J. R. R. Tolkien" -> "Tolkien, J. R. R."; single names are returned unchanged. */
export function toSortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts.join(' ');
  const last = parts[parts.length - 1];
  return `${last}, ${parts.slice(0, -1).join(' ')}`;
}
