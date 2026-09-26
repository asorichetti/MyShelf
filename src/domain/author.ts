export type AuthorRole = 'author' | 'illustrator' | 'translator' | 'editor';

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

const PARTICLES = new Set(['da', 'de', 'del', 'della', 'der', 'di', 'du', 'la', 'le', 'van', 'von']);
const SUFFIX = /^(jr|sr|ii|iii|iv)\.?$/i;

/**
 * Library-style sort key: "Terry Pratchett" -> "Pratchett, Terry",
 * "Ursula K. Le Guin" -> "Le Guin, Ursula K.", "Martin Luther King Jr." ->
 * "King, Martin Luther, Jr.". Single names are returned unchanged.
 */
export function toSortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const suffix = parts.length > 2 && SUFFIX.test(parts[parts.length - 1]) ? parts.pop()! : null;
  if (parts.length < 2) return [...parts, ...(suffix ? [suffix] : [])].join(' ');
  let start = parts.length - 1;
  while (start > 1 && PARTICLES.has(parts[start - 1].toLowerCase())) start--;
  const surname = parts.slice(start).join(' ');
  const given = parts.slice(0, start).join(' ');
  return suffix ? `${surname}, ${given}, ${suffix}` : `${surname}, ${given}`;
}
