// Phase 08: the Settings tab, backup and restore, CSV export and import
// (with the Goodreads preset), erasing the library, preferences and About.
// Files go out through the browser's download (Playwright's `download`
// event) and come back in through its file chooser (`filechooser`), the web
// stand-ins for the Android share sheet and document picker.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Testids, tid } from '../selectors.ts';
import { coverState, GOODREADS_CSV, openFixture, rowNames, SCHEMA1_BACKUP, upload, waitForCount, waitForPath, waitVisible } from './helpers.ts';
import { expect, q, register, type Context } from './registry.ts';

const S = Testids.settings;
const row = tid(Testids.home.row);
const TODAY = '2026-06-20';


interface Downloaded {
  name: string;
  path: string;
  text: string;
}

/** Clicks `selector` and returns the file the browser downloads, saved into the run directory. */
async function download(c: Context, selector: string, where: string): Promise<Downloaded> {
  const pending = c.page.waitForEvent('download', { timeout: 15_000 });
  await c.page.locator(selector).click();
  let file;
  try {
    file = await pending;
  } catch {
    expect(false, `${where}: expected a download after clicking ${selector}, none came`);
  }
  const name = file.suggestedFilename();
  const path = join(c.runDir, name);
  await file.saveAs(path);
  return { name, path, text: await readFile(path, 'utf8') };
}

/** Picks `option` (a radio's accessible name) in a SelectField opened by its trigger. */
async function select(c: Context, trigger: string, option: string): Promise<void> {
  await c.page.locator(trigger).click();
  await c.page.getByRole('radio', { name: option, exact: true }).click();
  await c.page.getByRole('dialog').waitFor({ state: 'detached', timeout: 5_000 }).catch(() => undefined);
}

async function text(c: Context, selector: string): Promise<string> {
  return (await c.page.locator(selector).first().innerText()).replace(/\s+/g, ' ').trim();
}

async function waitForText(c: Context, selector: string, want: RegExp, where: string): Promise<string> {
  try {
    await c.page.waitForFunction(
      ([s, src, flags]) => new RegExp(src as string, flags as string).test(((document.querySelector(s as string) as HTMLElement | null)?.innerText ?? '').replace(/\s+/g, ' ')),
      [selector, want.source, want.flags] as const,
      { timeout: 15_000 },
    );
  } catch {
    const found = (await c.page.locator(selector).count()) ? await text(c, selector) : '(missing)';
    expect(false, `${where}: expected ${selector} to match ${String(want)}, found ${q(found)}`);
  }
  return text(c, selector);
}

const path = (c: Context) => new URL(c.page.url()).pathname;

/**
 * Opens a Settings row the way a person would: back to the Settings tab (from
 * a screen under it, or through the tab bar), then the row. In-app
 * navigation keeps the journey's frozen "today"; a page load would lose it
 * and let Booky's overdue nudge cover the screen.
 */
async function openSetting(c: Context, rowId: string, to: string): Promise<void> {
  if (path(c).startsWith('/settings/')) {
    await c.page.getByRole('button', { name: 'Back to Settings' }).click();
    await waitForPath(c, '/settings', `${to}: back to Settings`);
  } else if (path(c) !== '/settings') {
    // After a stack reset the old tab bar lingers for a moment while it animates away.
    await waitForCount(c, tid(Testids.tabs.settings), 1, `${to}: one tab bar`);
    await c.page.locator(tid(Testids.tabs.settings)).click();
    await waitForPath(c, '/settings', `${to}: Settings tab`);
  }
  await c.page.locator(tid(rowId)).click();
  await waitForPath(c, to, `/settings -> ${to}`);
}

/** Back to the Shelf tab from anywhere under Settings. */
async function openShelf(c: Context): Promise<void> {
  if (path(c).startsWith('/settings/')) {
    await c.page.getByRole('button', { name: 'Back to Settings' }).click();
    await waitForPath(c, '/settings', 'back to Settings');
  }
  await waitForCount(c, tid(Testids.tabs.shelf), 1, 'one tab bar');
  await c.page.locator(tid(Testids.tabs.shelf)).click();
  await waitForPath(c, '/', 'Shelf tab');
}

/** Erases the library through Settings → Erase library and lands on the empty Shelf. */
async function eraseLibrary(c: Context): Promise<void> {
  await openSetting(c, S.erase, '/settings/erase');
  await waitForText(c, tid(Testids.erase.root), /12 books/, '/settings/erase');
  await c.page.locator(tid(Testids.erase.next)).click();
  await c.page.locator(tid(Testids.erase.confirmInput)).fill('ERASE');
  await c.page.locator(tid(Testids.erase.confirm)).click();
  await waitForPath(c, '/', '/settings/erase -> erase');
  await waitVisible(c, tid(Testids.emptyState.root), '/ after erase');
}

/** The rows of every table in a backup file, without the header fields that change per export. */
function tablesOf(json: string): Record<string, unknown[]> {
  const doc = JSON.parse(json) as { format: string; tables: Record<string, unknown[]> };
  expect(doc.format === 'myshelf-backup', `backup: expected format "myshelf-backup", found ${q(doc.format)}`);
  return doc.tables;
}

register({
  name: 'settings-overview',
  suite: 'p08',
  desc: 'Settings tab: one h1, the Library, Lookups, Lending, Backup & data and About sections, every row a named link or switch of 48 px or more; switches report aria-checked; screenshot',
  async run(c) {
    await openFixture(c, 'demo', '/settings', TODAY);
    const sections = await c.page.locator(`${tid(Testids.settings.root)} [role="heading"][aria-level="2"]`).allInnerTexts();
    const want = ['Library', 'Lookups', 'Lending', 'Backup & data', 'About'];
    expect(JSON.stringify(sections) === JSON.stringify(want), `/settings: expected sections ${q(want)}, found ${q(sections)}`);

    const links = [S.preferences, S.pending, S.borrowers, S.exportBackup, S.importBackup, S.exportCsv, S.importCsv, S.erase, S.about];
    for (const id of links) {
      const el = c.page.locator(tid(id));
      await el.scrollIntoViewIfNeeded();
      expect((await el.getAttribute('role')) === 'link', `/settings: expected ${id} to be a link, found role ${q(await el.getAttribute('role'))}`);
      const box = await el.boundingBox();
      expect(!!box && box.height >= 48, `/settings: expected ${id} at least 48 px tall, found ${q(box)}`);
    }
    for (const id of [S.googleBooksToggle, S.coversOnDataToggle, Testids.reminders.toggle]) {
      const el = c.page.locator(tid(id));
      expect((await el.getAttribute('role')) === 'switch', `/settings: expected ${id} to be a switch`);
      expect(['true', 'false'].includes((await el.getAttribute('aria-checked')) ?? ''), `/settings: expected ${id} to report aria-checked`);
    }
    const borrowers = await c.page.locator(tid(S.borrowers)).getAttribute('aria-label');
    expect(borrowers === 'Borrowers, 2 people, Rename or remove the people you lend to', `/settings: expected the Borrowers row to count 2 people, found ${q(borrowers)}`);
    await c.page.evaluate(() => window.scrollTo(0, 0));
    await c.snap('settings-top');
    await c.page.locator(tid(S.about)).scrollIntoViewIfNeeded();
    await c.snap('settings-bottom');
  },
});

register({
  name: 'backup-roundtrip',
  suite: 'p08',
  desc: 'Fixture "demo": save a backup (browser download) → erase the library → restore it with Replace (typed REPLACE) → the Shelf lists the same 12 books with the same loans, and a second backup holds identical rows in every table',
  async run(c) {
    await openFixture(c, 'demo', '/', TODAY);
    await waitForCount(c, row, 12, '/');
    const before = await rowNames(c);

    await openSetting(c, S.exportBackup, '/settings/backup');
    const contents = await waitForText(c, tid(Testids.backup.contents), /12 books/, '/settings/backup');
    expect(/3 loans/.test(contents), `/settings/backup: expected the contents to mention 3 loans, found ${q(contents)}`);
    await c.checkGates('/settings/backup');
    const first = await download(c, tid(Testids.backup.export), '/settings/backup');
    expect(/^myshelf-backup-\d{4}-\d{2}-\d{2}\.json$/.test(first.name), `/settings/backup: expected a dated backup file name, found ${q(first.name)}`);
    await waitForText(c, tid(Testids.backup.status), /Downloaded myshelf-backup-/, '/settings/backup');
    const firstTables = tablesOf(first.text);
    expect(firstTables.books.length === 12 && firstTables.loans.length === 3, `backup: expected 12 books and 3 loans, found ${firstTables.books.length} and ${firstTables.loans.length}`);
    await c.snap('backup-saved');

    await eraseLibrary(c);

    await openSetting(c, S.importBackup, '/settings/restore');
    await upload(c, tid(Testids.restore.pick), first.path, '/settings/restore');
    const file = await waitForText(c, tid(Testids.restore.file), /12 books/, '/settings/restore (file chosen)');
    expect(file.includes(first.name), `/settings/restore: expected the file card to name ${q(first.name)}, found ${q(file)}`);
    const confirm = c.page.locator(tid(Testids.restore.confirm));
    expect((await confirm.getAttribute('aria-disabled')) === 'true', '/settings/restore: expected Replace to wait for the typed confirmation');
    await c.page.locator(tid(Testids.restore.confirmInput)).fill('REPLACE');
    await c.checkGates('/settings/restore (ready)');
    await c.snap('restore-ready');
    await confirm.click();
    const summary = await waitForText(c, tid(Testids.restore.summary), /Library restored/, '/settings/restore');
    expect(/12 books/.test(summary), `/settings/restore: expected the summary to count 12 books, found ${q(summary)}`);
    await waitVisible(c, tid(Testids.restore.undo), '/settings/restore (done)');
    await c.checkGates('/settings/restore (done)');
    await c.snap('restore-done');

    await c.page.getByRole('button', { name: 'See your shelf' }).click();
    await waitForPath(c, '/', '/settings/restore -> shelf');
    await waitForCount(c, row, 12, '/ after restore');
    const after = await rowNames(c);
    expect(JSON.stringify(after) === JSON.stringify(before), `/ after restore: expected the same rows ${q(before)}, found ${q(after)}`);

    await openSetting(c, S.exportBackup, '/settings/backup');
    await waitForText(c, tid(Testids.backup.contents), /12 books/, '/settings/backup (again)');
    const second = await download(c, tid(Testids.backup.export), '/settings/backup (again)');
    const secondTables = tablesOf(second.text);
    for (const table of Object.keys(firstTables)) {
      let want = firstTables[table] as Record<string, unknown>[];
      const got = (secondTables[table] ?? []) as Record<string, unknown>[];
      if (table === 'books') {
        // By design the cover backfill looks again for books that had no cover (The Farthest Shore); a cover it found may already be there.
        want = want.map((b, i) => (b.cover_uri == null && typeof got[i]?.cover_uri === 'string' ? { ...b, cover_uri: got[i].cover_uri } : b));
      }
      expect(JSON.stringify(got) === JSON.stringify(want), `backup after restore: expected table ${table} to be identical (${want.length} rows), found ${got.length} rows that differ`);
    }
  },
});

register({
  name: 'restore-undo',
  suite: 'p08',
  desc: 'Fixture "demo": restore an older (schema 1) backup with Replace → it is brought up to date and shows its 3 Earthsea books → Undo restore → the 12 demo books are back',
  async run(c) {
    await openFixture(c, 'demo', '/settings/restore', TODAY);
    await upload(c, tid(Testids.restore.pick), SCHEMA1_BACKUP, '/settings/restore');
    const file = await waitForText(c, tid(Testids.restore.file), /3 books/, '/settings/restore (old file)');
    expect(/older version/.test(file), `/settings/restore: expected the card to say the backup is from an older version, found ${q(file)}`);
    await c.page.locator(tid(Testids.restore.confirmInput)).fill('replace');
    await c.page.locator(tid(Testids.restore.confirm)).click();
    await waitForText(c, tid(Testids.restore.summary), /3 books/, '/settings/restore');

    await openShelf(c);
    await waitForCount(c, row, 3, '/ after the old restore');
    const names = await rowNames(c);
    // The backup's own settings came back too: newest first.
    expect(names[0]?.startsWith('Tales from Earthsea,'), `/: expected Tales from Earthsea (2001) first, sorted newest first as the backup's settings say, found ${q(names)}`);

    await openSetting(c, S.importBackup, '/settings/restore');
    await waitVisible(c, tid(Testids.restore.undo), '/settings/restore (undo offered)');
    await c.checkGates('/settings/restore (undo offered)');
    await c.snap('restore-undo-offered');
    await c.page.locator(tid(Testids.restore.undo)).click();
    await waitVisible(c, tid(Testids.snackbar.root), '/settings/restore (undone)');
    await openShelf(c);
    await waitForCount(c, row, 12, '/ after undo');
  },
});

register({
  name: 'restore-corrupt-file',
  suite: 'p08',
  desc: 'Fixture "demo": a cut-off backup and a foreign JSON file each show a friendly restore.error (role alert) and change nothing: still 12 books',
  async run(c) {
    await openFixture(c, 'demo', '/settings/restore', TODAY);
    const truncated = join(c.runDir, 'myshelf-backup-truncated.json');
    const whole = await readFile(SCHEMA1_BACKUP, 'utf8');
    await writeFile(truncated, whole.slice(0, Math.floor(whole.length / 2)));
    await upload(c, tid(Testids.restore.pick), truncated, '/settings/restore');
    const error = await waitForText(c, tid(Testids.restore.error), /may be incomplete/, '/settings/restore (cut-off file)');
    expect((await c.page.locator(tid(Testids.restore.error)).getAttribute('role')) === 'alert', `/settings/restore: expected the error to be role alert: ${q(error)}`);
    expect((await c.page.locator(tid(Testids.restore.confirm)).count()) === 0, '/settings/restore: expected no Restore button for a broken file');
    await c.checkGates('/settings/restore (error)');
    await c.snap('restore-error');

    const foreign = join(c.runDir, 'package.json');
    await writeFile(foreign, JSON.stringify({ name: 'not-a-backup', version: '1.0.0' }));
    await upload(c, tid(Testids.restore.pick), foreign, '/settings/restore');
    await waitForText(c, tid(Testids.restore.error), /isn’t a MyShelf backup/, '/settings/restore (foreign JSON)');

    await openShelf(c);
    await waitForCount(c, row, 12, '/ after the failed restores');
  },
});

register({
  name: 'csv-export',
  suite: 'p08',
  desc: 'Fixture "demo": Export CSV downloads a BOM-prefixed file with a header and 12 book rows and no loan columns; with "Include lending details" on, the loan columns name Sam',
  async run(c) {
    await openFixture(c, 'demo', '/settings/export-csv', TODAY);
    await waitVisible(c, tid(Testids.csvExport.export), '/settings/export-csv');
    const toggle = c.page.locator(tid(Testids.csvExport.includeLoans));
    expect((await toggle.getAttribute('aria-checked')) === 'false', '/settings/export-csv: expected lending details to be off by default');
    const plain = await download(c, tid(Testids.csvExport.export), '/settings/export-csv');
    expect(/^myshelf-books-\d{4}-\d{2}-\d{2}\.csv$/.test(plain.name), `/settings/export-csv: expected a dated CSV name, found ${q(plain.name)}`);
    expect(plain.text.startsWith('﻿Title,Subtitle,Authors,ISBN-13,'), `csv: expected a BOM and the header, found ${q(plain.text.slice(0, 40))}`);
    const lines = plain.text.trimEnd().split('\r\n');
    expect(lines.length === 13, `csv: expected a header and 12 rows, found ${lines.length} lines`);
    expect(!plain.text.includes('On loan to') && !plain.text.includes('Sam'), 'csv: expected no lending details by default');
    expect(plain.text.includes('"Terry Pratchett; Neil Gaiman"') || plain.text.includes('Terry Pratchett; Neil Gaiman'), 'csv: expected Good Omens with both authors');
    await waitForText(c, tid(Testids.csvExport.status), /with 12 books/, '/settings/export-csv');
    await c.checkGates('/settings/export-csv (done)');
    await c.snap('csv-export');

    await toggle.click();
    expect((await toggle.getAttribute('aria-checked')) === 'true', '/settings/export-csv: expected the switch to turn on');
    const withLoans = await download(c, tid(Testids.csvExport.export), '/settings/export-csv (with loans)');
    expect(withLoans.text.split('\r\n')[0].endsWith('Groups,On loan to,Lent on,Due on,Notes,Added'), `csv: expected the loan columns, found ${q(withLoans.text.split('\r\n')[0])}`);
    expect(/\r\nDune,[^\r\n]*,Sam,2026-/.test(withLoans.text), 'csv: expected Dune on loan to Sam');
  },
});

register({
  name: 'csv-import-goodreads',
  suite: 'p08',
  desc: 'Fixture "empty": choose a Goodreads export (20 rows) → the Goodreads preset is chosen by itself → the preview shows 10 rows, "20 books will be added" → import → "Imported 20 books" with shelves as groups → 20 Shelf rows, and the cover backfill brings in real covers',
  async run(c) {
    // Open Library only: the recorded fixtures cover it (Google Books refuses keyless recording at busy times).
    await openFixture(c, 'empty', '/settings', TODAY);
    await c.page.locator(tid(S.googleBooksToggle)).click();
    expect((await c.page.locator(tid(S.googleBooksToggle)).getAttribute('aria-checked')) === 'false', '/settings: expected Google Books off');
    await openSetting(c, S.importCsv, '/settings/import-csv');
    await upload(c, tid(Testids.csvImport.pick), GOODREADS_CSV, '/settings/import-csv');
    await waitVisible(c, tid(Testids.csvImport.preview), '/settings/import-csv (file chosen)');
    const preset = await c.page.locator(tid(Testids.csvImport.preset)).getAttribute('aria-label');
    expect(preset === 'This file is a: Goodreads library export', `/settings/import-csv: expected the Goodreads preset, found ${q(preset)}`);
    const summary = await waitForText(c, tid(Testids.csvImport.preview), /20 books will be added/, '/settings/import-csv');
    expect(!/skipped/.test(summary.split('.')[0]), `/settings/import-csv: expected nothing skipped, found ${q(summary)}`);
    const previewRows = await c.page.locator(tid(Testids.csvImport.previewRow)).count();
    expect(previewRows === 10, `/settings/import-csv: expected 10 preview rows, found ${previewRows}`);
    const firstRow = await c.page.locator(tid(Testids.csvImport.previewRow)).first().getAttribute('aria-label');
    expect(firstRow === 'Line 2: Good Omens: The Nice and Accurate Prophecies of Agnes Nutter, Witch by Terry Pratchett and Neil Gaiman. Will be added.', `/settings/import-csv: unexpected first preview row ${q(firstRow)}`);
    const fields = await c.page.locator(tid(Testids.csvImport.mapField)).count();
    expect(fields >= 12, `/settings/import-csv: expected the used columns listed for mapping, found ${fields}`);
    await c.checkGates('/settings/import-csv (preview)');
    await c.snap('import-mapping');
    await c.page.locator(tid(Testids.csvImport.preview)).scrollIntoViewIfNeeded();
    await c.snap('import-preview');

    await c.page.locator(tid(Testids.csvImport.confirm)).click();
    const report = await waitForText(c, tid(Testids.csvImport.report), /Imported 20 books/, '/settings/import-csv (import)');
    expect(/New groups: .*Favourites/.test(report), `/settings/import-csv: expected shelves to become groups, found ${q(report)}`);
    await c.checkGates('/settings/import-csv (report)');
    await c.snap('import-report');

    await c.page.locator(tid(Testids.csvImport.done)).click();
    await waitForPath(c, '/', '/settings/import-csv -> shelf');
    await waitForText(c, tid(Testids.home.bookCount), /20 books/i, '/ after import');
    const names = await rowNames(c);
    expect(names.some((n) => n.startsWith('The Final Empire, by Brandon Sanderson')), `/: expected The Final Empire (series taken out of the title), found ${q(names.slice(0, 8))}`);

    // The cover backfill looks the new books up through the mocked APIs, newest addition first (Date Added
    // 2024/02/11: The Final Empire, then The Name of the Wind), and their rows fill in with real covers.
    for (const title of ['The Final Empire', 'The Name of the Wind']) {
      const sel = `${row}[aria-label^="${title},"]`;
      try {
        await c.page.waitForFunction(
          (s) => [...(document.querySelector(s)?.querySelectorAll('img') ?? [])].some((i) => i.complete && i.naturalWidth > 0),
          sel,
          { timeout: 45_000 },
        );
      } catch {
        expect(false, `/: expected the cover backfill to give ${q(title)} a real cover, found ${q(await coverState(c, sel))}`);
      }
      const cover = await coverState(c, sel);
      expect(cover.loaded === 1 && cover.fallbacks === 0, `/: expected ${q(title)} to show its real cover, found ${q(cover)}`);
    }
    await c.snap('import-shelf-covers');
  },
});

register({
  name: 'erase-library',
  suite: 'p08',
  desc: 'Fixture "demo": Erase library explains what goes and offers a backup first → Continue → Erase stays disabled until ERASE is typed → the empty Shelf; settings are kept',
  async run(c) {
    await openFixture(c, 'demo', '/settings/preferences', TODAY);
    await select(c, tid(S.loanLength), '14 days (2 weeks)');
    await openSetting(c, S.erase, '/settings/erase');
    const warning = await waitForText(c, tid(Testids.erase.root), /12 books/, '/settings/erase');
    expect(/This can’t be undone/.test(warning), `/settings/erase: expected the warning, found ${q(warning)}`);
    await waitVisible(c, tid(Testids.erase.backupFirst), '/settings/erase');
    const reset = c.page.locator(tid(Testids.erase.resetSettings));
    expect((await reset.getAttribute('role')) === 'checkbox' && (await reset.getAttribute('aria-checked')) === 'false', '/settings/erase: expected an unticked "reset settings" checkbox');
    await c.checkGates('/settings/erase');
    await c.snap('erase-explain');
    await c.page.locator(tid(Testids.erase.next)).click();
    const confirm = c.page.locator(tid(Testids.erase.confirm));
    expect((await confirm.getAttribute('aria-disabled')) === 'true', '/settings/erase: expected Erase disabled before typing');
    await c.page.locator(tid(Testids.erase.confirmInput)).fill('erase');
    await c.checkGates('/settings/erase (confirm)');
    await c.snap('erase-confirm');
    await confirm.click();
    await waitForPath(c, '/', '/settings/erase -> shelf');
    await waitVisible(c, tid(Testids.emptyState.root), '/ after erase');
    expect((await c.page.locator(row).count()) === 0, '/ after erase: expected no rows');
    await waitVisible(c, tid(Testids.snackbar.root), '/ after erase (snackbar)');

    await c.page.locator(tid(Testids.tabs.settings)).click();
    await waitForPath(c, '/settings', '/ -> Settings');
    const prefs = await c.page.locator(tid(S.preferences)).getAttribute('aria-label');
    expect(/lend for 14 days/.test(prefs ?? ''), `/settings after erase: expected the 14-day loan length kept, found ${q(prefs)}`);
  },
});

register({
  name: 'preferences-persist',
  suite: 'p08',
  desc: 'Fixture "demo": sort newest year first, 14-day loans, ISO dates and Google Books off → a reload keeps them all; the Shelf opens newest first, the lend sheet offers a due date 14 days on, and dates read 2026-06-20',
  async run(c) {
    await openFixture(c, 'demo', '/settings/preferences', TODAY);
    await select(c, tid(S.sort), 'Year, newest first');
    await select(c, tid(S.loanLength), '14 days (2 weeks)');
    await select(c, tid(S.dateFormat), 'Year-month-day (2026-10-12)');
    await waitForText(c, tid(S.dateExample), /2026-06-20/, '/settings/preferences');
    await c.checkGates('/settings/preferences');
    await c.snap('preferences');
    await c.page.getByRole('button', { name: 'Back to Settings' }).click();
    await waitForPath(c, '/settings', '/settings/preferences -> back');
    const google = c.page.locator(tid(S.googleBooksToggle));
    await google.click();
    expect((await google.getAttribute('aria-checked')) === 'false', '/settings: expected Google Books to switch off');

    // The switch updates at once and saves in the background. Re-open Settings
    // from the Shelf so it reads everything back from the database (the read
    // queues behind the save), proving the save landed before the reload.
    await c.page.locator(tid(Testids.tabs.shelf)).click();
    await waitForPath(c, '/', '/settings -> Shelf');
    await c.page.locator(tid(Testids.tabs.settings)).click();
    await waitForPath(c, '/settings', '/ -> Settings');
    await waitVisible(c, tid(S.googleBooksToggle), '/settings (reopened)');
    await c.page.waitForFunction(
      (sel) => document.querySelector(sel)?.getAttribute('aria-checked') === 'false',
      tid(S.googleBooksToggle),
      { timeout: 10_000 },
    ).catch(() => {});
    expect(
      (await c.page.locator(tid(S.googleBooksToggle)).getAttribute('aria-checked')) === 'false',
      '/settings (reopened): expected Google Books still off after reading settings back',
    );

    // A reload is a fresh start of the app: everything must come back from the database.
    await c.page.reload();
    await waitVisible(c, tid(S.googleBooksToggle), '/settings after reload');
    expect((await c.page.locator(tid(S.googleBooksToggle)).getAttribute('aria-checked')) === 'false', '/settings after reload: expected Google Books still off');
    await c.page.locator(tid(S.preferences)).click();
    await waitForPath(c, '/settings/preferences', '/settings -> preferences');
    for (const [id, want] of [
      [S.sort, 'Sort the shelf by: Year, newest first'],
      [S.loanLength, 'Lend books for: 14 days (2 weeks)'],
      [S.dateFormat, 'Write dates as: Year-month-day (2026-10-12)'],
    ]) {
      const got = await c.page.locator(tid(id)).getAttribute('aria-label');
      expect(got === want, `/settings/preferences after reload: expected ${q(want)}, found ${q(got)}`);
    }

    // Each preference reaches its screen. (The reload unfroze "today", so dates are checked relative to it.)
    await openShelf(c);
    await waitForCount(c, row, 12, '/');
    const first = (await rowNames(c))[0];
    expect(first.startsWith('Good Omens,'), `/: expected the newest book (Good Omens, 1990) first, found ${q(first)}`);
    await c.page.locator(`${row}[aria-label^="Mort,"]`).click();
    await waitForPath(c, /^\/book\/\d+$/, '/ -> Mort');
    await c.page.locator(tid(Testids.lend.open)).click();
    await waitVisible(c, tid(Testids.lend.sheet), 'lend sheet');
    const [lent, due] = [await c.page.locator(tid(Testids.lend.lentOn)).inputValue(), await c.page.locator(tid(Testids.lend.dueOn)).inputValue()];
    const days = Math.round((Date.parse(due) - Date.parse(lent)) / 86_400_000);
    expect(days === 14, `lend sheet: expected a due date 14 days after ${lent}, found ${q(due)}`);
    const sheet = await text(c, tid(Testids.lend.sheet));
    expect(sheet.includes(due), `lend sheet: expected the due date written as ${q(due)} (ISO), found ${q(sheet)}`);
  },
});

register({
  name: 'about-page',
  suite: 'p08',
  desc: 'About: version and build, Open Library and Google Books credited, the MIT licence, the GitHub link opens https://github.com/asorichetti/MyShelf, and the licences list names hundreds of packages',
  async run(c) {
    await openFixture(c, 'empty', '/settings/about', TODAY);
    const version = await text(c, tid(Testids.about.version));
    expect(/^Version \d+\.\d+\.\d+ · Web build$/.test(version), `/settings/about: expected the version and build, found ${q(version)}`);
    const credit = await text(c, tid(Testids.about.attribution));
    expect(credit.includes('Book data from Open Library (Internet Archive) and Google Books'), `/settings/about: expected the data credit, found ${q(credit)}`);
    const page = await text(c, tid(Testids.about.root));
    expect(page.includes('MIT licence'), '/settings/about: expected the MIT licence');
    await c.snap('about');

    await c.page.evaluate(() => {
      (window as unknown as { __opened: string[] }).__opened = [];
      window.open = ((url: string) => {
        (window as unknown as { __opened: string[] }).__opened.push(String(url));
        return null;
      }) as typeof window.open;
    });
    const repo = c.page.locator(tid(Testids.about.repoLink));
    expect((await repo.getAttribute('role')) === 'link', '/settings/about: expected the GitHub link to be a link');
    await repo.click();
    const opened = await c.page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
    expect(opened[0] === 'https://github.com/asorichetti/MyShelf', `/settings/about: expected the repo to open, found ${q(opened)}`);

    const toggle = c.page.locator(tid(Testids.about.licencesToggle));
    await toggle.click();
    expect((await toggle.getAttribute('aria-expanded')) === 'true', '/settings/about: expected the licence list to be expanded');
    const rows = await c.page.locator(tid(Testids.about.licenceRow)).count();
    expect(rows > 100, `/settings/about: expected hundreds of packages, found ${rows}`);
    const expoRow = await c.page.locator(tid(Testids.about.licenceRow)).filter({ hasText: /^expo \d/ }).first().innerText();
    expect(/— MIT$/.test(expoRow), `/settings/about: expected expo listed as MIT, found ${q(expoRow)}`);
    await c.checkGates('/settings/about (licences open)');
  },
});

register({
  name: 'settings-borrowers-pending',
  suite: 'p08',
  desc: 'Fixture "demo": Settings → Borrowers lists Sam and Priya with loan counts; removing Priya is refused while she has a book out; renaming Sam shows on the Loans tab; Pending lookups is empty',
  async run(c) {
    await openFixture(c, 'demo', '/settings/borrowers', TODAY);
    await waitForCount(c, tid(Testids.borrowers.row), 2, '/settings/borrowers');
    const labels = await c.page.locator(tid(Testids.borrowers.row)).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(labels.some((l) => l === 'Sam, has 1 book now · 2 loans in all'), `/settings/borrowers: expected Sam's counts, found ${q(labels)}`);
    await c.checkGates('/settings/borrowers');
    await c.snap('borrowers');

    await c.page.getByRole('button', { name: 'Remove Priya' }).click();
    await waitForText(c, '[role="alert"]', /Priya still has 1 book/, '/settings/borrowers (remove Priya)');

    await c.page.getByRole('button', { name: 'Edit Sam' }).click();
    await c.page.locator(tid(Testids.borrower.editName)).fill('Samira');
    await c.page.locator(tid(Testids.borrower.editSave)).click();
    await waitForText(c, tid(Testids.borrowers.root), /Samira, has 1 book now|Samira/, '/settings/borrowers (renamed)');
    await c.page.getByRole('button', { name: 'Back to Settings' }).click();
    await waitForPath(c, '/settings', 'back to Settings');
    await c.page.locator(tid(Testids.tabs.loans)).click();
    await waitForText(c, tid(Testids.loans.root), /Samira/, '/loans after the rename');

    await openSetting(c, S.pending, '/settings/pending');
    await waitVisible(c, tid(Testids.pendingList.empty), '/settings/pending');
    await c.checkGates('/settings/pending');
  },
});
