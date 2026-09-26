import { libraryRepo, type Db } from '@/db';

export interface EraseAllOptions {
  /** Also forget every preference. */
  resetSettings?: boolean;
  /** Deletes the cover files stored on the device (injected: the app passes `deleteAllCovers`). */
  deleteCoverFiles?: () => number;
}

export interface EraseAllResult {
  coverFilesDeleted: number;
}

/**
 * "Erase library" (P08-09): every row of the library, the lookup queue and
 * caches and the restore safety copy in one transaction, then the cover
 * files. Settings stay unless `resetSettings`.
 */
export async function eraseAll(db: Db, { resetSettings = false, deleteCoverFiles }: EraseAllOptions = {}): Promise<EraseAllResult> {
  await libraryRepo.eraseLibrary(db, { resetSettings });
  let coverFilesDeleted = 0;
  try {
    coverFilesDeleted = deleteCoverFiles?.() ?? 0;
  } catch (error) {
    // The library is already gone; a stray cover file is not worth failing over.
    console.warn('Could not delete every cover file', error);
  }
  return { coverFilesDeleted };
}
