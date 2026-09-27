/** A file to hand to the user: saved and shared on the phone, downloaded on the web. */
export interface OutgoingFile {
  fileName: string;
  mimeType: string;
  text: string;
  /** The share sheet's title on Android. */
  dialogTitle?: string;
}

/** A binary file to hand to the user (the raw database file). */
export interface OutgoingBinaryFile {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  /** The share sheet's title on Android. */
  dialogTitle?: string;
}

export type ShareOutcome =
  /** The share sheet opened (and closed); the user chose where the file went. */
  | 'shared'
  /** The browser downloaded the file. */
  | 'downloaded'
  /** This device cannot share files. */
  | 'unavailable';

/** A text file the user picked. */
export interface PickedFile {
  name: string;
  text: string;
}

export const JSON_MIME = 'application/json';
export const CSV_MIME = 'text/csv';
/** A SQLite database file (IANA). */
export const SQLITE_MIME = 'application/vnd.sqlite3';
