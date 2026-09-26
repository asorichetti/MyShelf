import type { PickedFile } from './fileTypes';

/**
 * A hidden `<input type="file">`, clicked for the user: the browser's file
 * chooser (Playwright's `filechooser` event in the auto test suite). Null
 * when the user cancels.
 */
export function pickTextFile(mimeTypes: readonly string[]): Promise<PickedFile | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = mimeTypes.join(',');
    input.style.display = 'none';
    const done = () => input.remove();
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      done();
      if (!file) return resolve(null);
      file.text().then((text) => resolve({ name: file.name, text }), reject);
    });
    input.addEventListener('cancel', () => {
      done();
      resolve(null);
    });
    document.body.appendChild(input);
    input.click();
  });
}
