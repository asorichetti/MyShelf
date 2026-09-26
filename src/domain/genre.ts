export interface Genre {
  id: number;
  name: string;
}

export interface BookGenre extends Genre {
  /** True when the user chose or edited this genre (never overwritten by lookups). */
  userEdited: boolean;
}
