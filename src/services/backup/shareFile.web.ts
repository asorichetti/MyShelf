import type { OutgoingBinaryFile, OutgoingFile, ShareOutcome } from './fileTypes';

/** The web build downloads the file through the browser (the auto test suite captures it as a download). */
export async function shareFile({ fileName, mimeType, text }: OutgoingFile): Promise<ShareOutcome> {
  return download(fileName, new Blob([text], { type: `${mimeType};charset=utf-8` }));
}

/** As `shareFile`, for a binary file. */
export async function shareBinaryFile({ fileName, mimeType, bytes }: OutgoingBinaryFile): Promise<ShareOutcome> {
  return download(fileName, new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mimeType }));
}

function download(fileName: string, blob: Blob): ShareOutcome {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
