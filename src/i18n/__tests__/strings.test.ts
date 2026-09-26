/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { screen } from 'expo-router/testing-library';
import ts from 'typescript';

import { booksRepo, groupsRepo, seriesRepo, type Db } from '@/db';
import { curatedGenres, setToday, toSortName } from '@/domain';
import { AuthorsScreen } from '@/features/authors/AuthorsScreen';
import { BookDetailScreen } from '@/features/book/BookDetailScreen';
import { AddBookScreen, EditBookScreen } from '@/features/book/BookFormScreen';
import { GenresScreen } from '@/features/genres/GenresScreen';
import { GroupDetailScreen } from '@/features/groups/GroupDetailScreen';
import { BorrowerScreen } from '@/features/loans/BorrowerScreen';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { SeriesDetailScreen } from '@/features/series/SeriesDetailScreen';
import { SeriesListScreen } from '@/features/series/SeriesListScreen';
import { AboutScreen } from '@/features/settings/AboutScreen';
import { BackupScreen } from '@/features/settings/BackupScreen';
import { BorrowersScreen } from '@/features/settings/BorrowersScreen';
import { EraseScreen } from '@/features/settings/EraseScreen';
import { ExportCsvScreen } from '@/features/settings/ExportCsvScreen';
import { ImportCsvScreen } from '@/features/settings/ImportCsvScreen';
import { PreferencesScreen } from '@/features/settings/PreferencesScreen';
import { RestoreScreen } from '@/features/settings/RestoreScreen';
import {
  allMessages,
  formatDay,
  formatNumber,
  placeholdersOf,
  resetCatalogue,
  setCatalogue,
  setPseudoLocale,
  t,
  translate,
  type Catalogue,
  type PluralMessage,
} from '@/i18n';
import { en } from '@/i18n/en';
import { createTestDb } from '@/testing/createTestDb';
import { fixtures } from '@/testing/fixtures';
import { sourceFiles } from '@/testing/hardcodedStrings';
import { loadFixture } from '@/testing/loadFixture';
import { resetCamera, setCameraPermission } from '@/testing/mockCamera';
import { advance, renderApp } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

import type { ReactTestRendererJSON } from 'react-test-renderer';

jest.mock('expo-camera', () => jest.requireActual('@/testing/mockCamera').cameraModule);

/**
 * The catalogue's own checks (P09-11), and the pseudo-locale check over
 * rendered screens at the end. The rule against hard-coded strings in
 * components is `no-hardcoded-strings.test.ts`.
 */

const root = join(__dirname, '..', '..', '..');
const messages = allMessages();

/**
 * Keys that no code names, each with the reason. A key used only through a
 * template (`t(\`dates.months.${m}\`)`) counts as used: see `dynamicPrefixes`.
 */
const INTENTIONALLY_UNUSED: Record<string, string> = {
  'meta.locale': 'read as a property (`en.meta.locale`) by the i18n module, not looked up by key',
};

/** App code, including the i18n module but not the catalogue itself. */
const appFiles = sourceFiles(join(root, 'src')).filter((f) => !/[\\/]i18n[\\/](en\.ts|sections[\\/])/.test(f) && !/[\\/]testing[\\/]/.test(f));

interface Scanned {
  literals: Set<string>;
  templateHeads: Set<string>;
  calls: { file: string; line: number; key: string; params: string[] | null; hasParams: boolean }[];
}

function scan(): Scanned {
  const literals = new Set<string>();
  const templateHeads = new Set<string>();
  const calls: Scanned['calls'] = [];
  for (const file of appFiles) {
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node: ts.Node): void => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) literals.add(node.text);
      else if (ts.isTemplateExpression(node)) templateHeads.add(node.head.text);
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && (node.expression.text === 't' || node.expression.text === 'translate')) {
        const [key, arg] = node.arguments;
        if (key && ts.isStringLiteral(key)) {
          // null: the parameters are not an object literal we can read (a variable, a spread).
          let params: string[] | null = null;
          if (arg && ts.isObjectLiteralExpression(arg) && arg.properties.every((p) => ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)))
            params = arg.properties.map((p) => (p.name as ts.Identifier).text);
          else if (!arg) params = [];
          calls.push({ file: file.slice(root.length + 1), line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, key: key.text, params, hasParams: !!arg });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return { literals, templateHeads, calls };
}

const scanned = scan();

/** Template heads that name a group of keys, e.g. `dates.months.` from `t(\`dates.months.${m}\`)`. */
const dynamicPrefixes = [...scanned.templateHeads].filter((h) => /^[a-z][A-Za-z]*(\.[A-Za-z0-9]+)*\.$/.test(h) && [...messages.keys()].some((k) => k.startsWith(h)));

const isPlural = (m: string | PluralMessage): m is PluralMessage => typeof m !== 'string';
const forms = (m: string | PluralMessage) => (isPlural(m) ? Object.values(m) : [m]);
const expectedParams = (m: string | PluralMessage) => {
  const names = new Set(forms(m).flatMap((f) => placeholdersOf(f as string)));
  if (isPlural(m)) names.add('count');
  return [...names].sort();
};

afterEach(() => resetCatalogue());

describe('the catalogue', () => {
  it('has keys to check', () => {
    expect(messages.size).toBeGreaterThan(500);
  });

  it('uses every key, or says why not', () => {
    const unused = [...messages.keys()].filter((k) => !scanned.literals.has(k) && !dynamicPrefixes.some((p) => k.startsWith(p)) && !(k in INTENTIONALLY_UNUSED));
    expect(unused).toEqual([]);
  });

  it('lists only real keys as intentionally unused', () => {
    expect(Object.keys(INTENTIONALLY_UNUSED).filter((k) => !messages.has(k))).toEqual([]);
  });

  it('has no empty messages (a separator may be only spaces)', () => {
    const empty = [...messages]
      .filter(([k, m]) => forms(m).some((f) => !f || (!String(f).trim() && !/separator$/i.test(k))))
      .map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it('gives every plural an "other" form, and no form a placeholder the "other" form lacks', () => {
    const bad = [...messages]
      .filter(([, m]) => isPlural(m))
      .filter(([, m]) => {
        const p = m as PluralMessage;
        const other = new Set([...placeholdersOf(p.other), 'count']);
        return typeof p.other !== 'string' || forms(p).some((f) => placeholdersOf(f as string).some((n) => !other.has(n)));
      })
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it('writes placeholders as {camelCase} names, with balanced braces', () => {
    const stray = (f: string) => /[{}]/.test(f.replace(/\{[A-Za-z][A-Za-z0-9]*\}/g, ''));
    const bad = [...messages].filter(([, m]) => forms(m).some((f) => stray(f as string))).map(([k]) => k);
    expect(bad).toEqual([]);
  });
});

describe('call sites', () => {
  it('finds the calls to check', () => {
    expect(scanned.calls.length).toBeGreaterThan(500);
  });

  it('name only keys in the catalogue', () => {
    const missing = scanned.calls.filter((c) => !messages.has(c.key)).map((c) => `${c.file}:${c.line} ${c.key}`);
    expect(missing).toEqual([]);
  });

  it('pass exactly the placeholders their message has', () => {
    const mismatched = scanned.calls
      .filter((c) => messages.has(c.key) && c.params != null)
      .filter((c) => JSON.stringify([...c.params!].sort()) !== JSON.stringify(expectedParams(messages.get(c.key)!)))
      .map((c) => `${c.file}:${c.line} ${c.key}: passes {${c.params!.join(', ')}}, expects {${expectedParams(messages.get(c.key)!).join(', ')}}`);
    expect(mismatched).toEqual([]);
  });
});

describe('t', () => {
  it('fills placeholders', () => {
    expect(t('loanStamp.returned', { date: '12 Oct' })).toBe('Returned 12 Oct');
    expect(t('common.seriesLabel', { name: 'Discworld', position: '5' })).toBe('Discworld #5');
  });

  it('chooses plural forms with Intl.PluralRules', () => {
    expect(t('common.books', { count: 1 })).toBe('1 book');
    expect(t('common.books', { count: 0 })).toBe('0 books');
    expect(t('common.books', { count: 2 })).toBe('2 books');
    expect(t('common.books', { count: 2000 })).toBe('2000 books');
    expect(t('loanStamp.overdue', { count: 1 })).toBe('Overdue · 1 day');
    expect(t('loanStamp.overdue', { count: 3 })).toBe('Overdue · 3 days');
    expect(t('loanStamp.overdueDescription', { count: 1, date: '10 Jun 2026' })).toBe('Overdue by 1 day, it was due back on 10 Jun 2026');
  });

  it('falls back to the English plural rule where Intl.PluralRules is missing', () => {
    const PluralRules = Intl.PluralRules;
    try {
      (Intl as { PluralRules?: unknown }).PluralRules = undefined;
      setCatalogue(en as Catalogue);
      expect(t('common.days', { count: 1 })).toBe('1 day');
      expect(t('common.days', { count: 5 })).toBe('5 days');
    } finally {
      (Intl as { PluralRules?: unknown }).PluralRules = PluralRules;
    }
  });

  it('writes numbers without grouping, as designed ("2000 books catalogued")', () => {
    expect(formatNumber(10000)).toBe('10000');
    expect(formatNumber(2.5)).toBe('2.5');
  });

  it('takes a key held in data through translate', () => {
    expect(translate('common.days', { count: 2 })).toBe('2 days');
  });

  it('switches to another catalogue, with its own plural rules', () => {
    const french: Catalogue = { ...(en as Catalogue), common: { ...en.common, books: { one: '{count} livre', other: '{count} livres' } } };
    setCatalogue(french, 'fr');
    // French counts 0 as singular.
    expect(t('common.books', { count: 0 })).toBe('0 livre');
    expect(t('common.books', { count: 2 })).toBe('2 livres');
  });

  it('wraps every message in [[ ]] under the pseudo-locale', () => {
    setPseudoLocale(true);
    expect(t('common.cancel')).toBe('[[Cancel]]');
    expect(t('common.books', { count: 3 })).toBe('[[3 books]]');
  });
});

describe('formatDay', () => {
  it('writes the app style with the catalogue month, whatever the engine calls it', () => {
    // ICU spells September "Sept" in en-GB; the stamps are designed around "Sep".
    expect(formatDay(new Date(2026, 8, 26))).toBe('26 Sep 2026');
    expect(formatDay(new Date(2026, 5, 26), { year: false })).toBe('26 Jun');
  });

  it('falls back to the catalogue pattern without formatToParts', () => {
    const formatToParts = Intl.DateTimeFormat.prototype.formatToParts;
    try {
      (Intl.DateTimeFormat.prototype as { formatToParts?: unknown }).formatToParts = undefined;
      setCatalogue(en as Catalogue, 'en-US');
      expect(formatDay(new Date(2026, 9, 12))).toBe('12 Oct 2026');
    } finally {
      Intl.DateTimeFormat.prototype.formatToParts = formatToParts;
    }
  });
});

// Compile-time checks: `tsc` fails if any of these stop being errors.
export function typeChecks() {
  // @ts-expect-error a key that is not in the catalogue
  t('common.nope');
  // @ts-expect-error a plural needs its count
  t('common.books');
  // @ts-expect-error a placeholder is missing
  t('loanStamp.overdueDescription', { count: 1 });
  // @ts-expect-error a message without placeholders takes no parameters
  t('common.cancel', { name: 'x' });
}

/**
 * The pseudo-locale check: key screens rendered with every message wrapped
 * in "[[ ]]". Any text or accessible name left with letters outside the
 * brackets, other than the fixture's own data (titles, names), was not
 * translated: a hard-coded string, or a `t` call made at import time.
 */
describe('the pseudo-locale', () => {
  let db: Db;
  beforeEach(async () => {
    setToday('2026-06-15');
    db = await createTestDb();
    await loadFixture(db, 'demo');
    resetCamera();
    setCameraPermission('granted');
    setPseudoLocale(true);
  });
  afterEach(() => {
    db.close();
    setToday(null);
  });

  /** Every string in the fixture: titles, names, publishers, series, groups, borrowers, notes. */
  const data = (() => {
    const out = new Set<string>();
    const walk = (v: unknown): void => {
      if (typeof v === 'string') out.add(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(fixtures.demo);
    // Derived data: authors' sort names ("Pratchett, Terry") and the genre vocabulary the editor suggests.
    for (const b of fixtures.demo.books) for (const a of b.authors ?? []) out.add(toSortName(typeof a === 'string' ? a : a.name));
    curatedGenres.forEach((g) => out.add(g));
    // Lower-case single words are stored values ("paperback", "en", "beach"), shown through the catalogue.
    return [...out].filter((s) => /\p{L}/u.test(s) && !/^[a-z-]+$/.test(s)).sort((a, b) => b.length - a.length);
  })();

  /** The text with the translated parts and the fixture's data taken out; letters left over are untranslated. */
  function leftover(text: string): string | null {
    let s = text;
    for (let prev = ''; prev !== s; ) {
      prev = s;
      s = s.replace(/\[\[[^[\]]*\]\]/g, ' ');
    }
    for (const d of data) s = s.split(d).join(' ');
    // Links shown as their address (About).
    s = s.replace(/https?:\/\/\S+/g, ' ');
    // Call numbers, index letters and initials are cut from the data: "PRA", "P", "TP".
    s = s.replace(/\b\p{Lu}{1,3}\b/gu, ' ');
    return /\p{L}/u.test(s) ? s.replace(/\s+/g, ' ').trim() : null;
  }

  // Not `title`: react-navigation puts the route's name there on its own containers.
  const UI_PROPS = ['accessibilityLabel', 'aria-label', 'accessibilityHint', 'placeholder', 'aria-valuetext'];

  function untranslated(): string[] {
    const found = new Set<string>();
    const visit = (node: ReactTestRendererJSON | string | null): void => {
      if (node == null || typeof node === 'string') return;
      for (const prop of UI_PROPS) {
        const value = node.props[prop];
        if (typeof value === 'string' && leftover(value)) found.add(`${prop}: ${value}`);
      }
      if (node.type === 'Text') {
        const own = (node.children ?? []).filter((c): c is string => typeof c === 'string').join('');
        if (own && !own.startsWith('icon:') && leftover(own)) found.add(`text: ${own}`);
      }
      for (const child of node.children ?? []) visit(child);
    };
    const tree = screen.toJSON();
    for (const n of Array.isArray(tree) ? tree : [tree]) visit(n);
    return [...found];
  }

  const bookId = async (title: string) => (await booksRepo.listBooks(db)).find((b) => b.title === title)!.id;

  const routes = {
    'book/[id]': BookDetailScreen,
    'book/[id]/edit': EditBookScreen,
    'book/new': AddBookScreen,
    'series/index': SeriesListScreen,
    'series/[id]': SeriesDetailScreen,
    'group/[id]': GroupDetailScreen,
    'borrower/[id]': BorrowerScreen,
    'authors/index': AuthorsScreen,
    'genres/index': GenresScreen,
    'settings/preferences': PreferencesScreen,
    'settings/backup': BackupScreen,
    'settings/restore': RestoreScreen,
    'settings/import-csv': ImportCsvScreen,
    'settings/export-csv': ExportCsvScreen,
    'settings/erase': EraseScreen,
    'settings/borrowers': BorrowersScreen,
    'settings/about': AboutScreen,
    onboarding: OnboardingScreen,
  };

  const screens: [string, () => Promise<string>][] = [
    ['the Shelf', async () => '/'],
    ['Scan', async () => '/scan'],
    ['Loans', async () => '/loans'],
    ['Groups', async () => '/groups'],
    ['Settings', async () => '/settings'],
    ['a book on loan', async () => `/book/${await bookId('Dune')}`],
    ['a book in a series', async () => `/book/${await bookId('The Colour of Magic')}`],
    ['the book form', async () => `/book/${await bookId('The Colour of Magic')}/edit`],
    ['a new book', async () => '/book/new'],
    ['the series list', async () => '/series'],
    ['a series', async () => `/series/${(await seriesRepo.findSeriesByName(db, 'Discworld'))!.id}`],
    ['a group', async () => `/group/${(await groupsRepo.listGroups(db))[0].id}`],
    ['authors', async () => '/authors'],
    ['genres', async () => '/genres'],
    ['preferences', async () => '/settings/preferences'],
    ['backup', async () => '/settings/backup'],
    ['restore', async () => '/settings/restore'],
    ['CSV import', async () => '/settings/import-csv'],
    ['CSV export', async () => '/settings/export-csv'],
    ['erase', async () => '/settings/erase'],
    ['borrowers', async () => '/settings/borrowers'],
    ['about', async () => '/settings/about'],
    ['onboarding', async () => '/onboarding'],
  ];

  it.each(screens)('leaves nothing untranslated on %s', async (_, url) => {
    renderApp(db, await url(), routes);
    await advance(0);
    await advance(0);
    expect(screen.getByTestId(Testids.pageState.content)).toBeOnTheScreen();
    expect(untranslated()).toEqual([]);
  });
});
