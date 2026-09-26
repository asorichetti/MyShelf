export interface Series {
  id: number;
  name: string;
  /** Number of books in the series, when known. */
  totalCount: number | null;
}
