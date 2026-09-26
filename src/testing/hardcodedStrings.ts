/// <reference types="node" />
/**
 * Finds user-facing text written straight into the code instead of the
 * catalogue (P09-11). Used by `src/i18n/__tests__/no-hardcoded-strings.test.ts`
 * (part of `npm run check`) and runnable by hand:
 *
 *   npx tsx src/testing/hardcodedStrings.ts [file or folder ...]
 *
 * A string is reported when it has a letter in it, is not a catalogue key,
 * and sits where the user sees or hears it:
 * - JSX text, and string values in JSX children (`{'Hello'}`, `{a ? 'Yes' : 'No'}`);
 * - the value of a UI prop: `accessibilityLabel`, `accessibilityHint`,
 *   `aria-label`, `placeholder`, `title`, `label`, `hint`, `message` and the
 *   rest of `UI_NAMES`, whether a JSX attribute (`<Button label="Save">`) or
 *   an object property (`show({ message: 'Saved' })`, `{ label: 'Genre' }`);
 * - a default or a constant with such a name (`{ confirmLabel = 'Confirm' }`,
 *   `const COPY_ERROR_LABEL = 'Copy error details'`);
 * - the first argument of an announcement (`announce('Lent to Sam')`).
 *
 * Only the value itself counts: the branches of `?:`, `&&`, `||`, `??` and
 * `+`, and the text parts of a template literal. Anything inside a function
 * call (`t('shelf.title')`, `formatIsbn('978…')`) or a comparison is left
 * alone. Strings with no letters (symbols such as "·" or "—") are allowed.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import ts from 'typescript';

export interface Finding {
  file: string;
  line: number;
  text: string;
  where: string;
}

/** The folders scanned; tests, fixtures and live checks inside them are skipped. */
export const SCANNED = ['src/app', 'src/components', 'src/features', 'src/domain', 'src/services', 'src/hooks'];

/**
 * Files that are not UI, each with the reason. Keep this short: a real
 * screen never belongs here.
 */
export const ALLOWED_FILES: Record<string, string> = {
  'src/services/backup/exportCsv.ts': 'CSV column headers are a file format that other apps read back, not UI (docs/localisation.md)',
  'src/services/http/errors.ts': 'developer-facing error messages for logs; screens show their own catalogue text',
};

/**
 * Single strings that look like UI to the scanner but are not, each with the
 * reason. `text` is the reported text (template parts as `${…}`).
 */
export const ALLOWED_STRINGS: readonly { file: string; text: string; reason: string }[] = [
  { file: 'src/components/book/ShelfToolbar.tsx', text: 'asc', reason: 'a sort direction value in a table keyed by sort, not text' },
  { file: 'src/components/booky/tips.ts', text: 'The Curious Incident of the Dog in the Night-Time', reason: 'sample placeholder data for the tip-length test' },
  { file: 'src/services/backup/csvPresets.ts', text: 'title', reason: 'Goodreads CSV column mapping: a file format, not UI' },
  { file: 'src/services/metadata/index.ts', text: 'Google Books is resting after refusing requests', reason: 'a provider warning for logs; the screen shows its own text' },
  { file: 'src/services/metadata/openLibraryMap.ts', text: 'Untitled', reason: 'a data value stored as the title of a record that has none' },
];

/** Props and object properties whose value the user sees or hears. */
const UI_NAMES = new Set([
  'accessibilityLabel',
  'accessibilityHint',
  'accessibilityValue',
  'aria-label',
  'aria-valuetext',
  'aria-description',
  'aria-roledescription',
  'placeholder',
  'title',
  'subtitle',
  'label',
  'hint',
  'message',
  'heading',
  'description',
  'body',
  'text',
]);

/** `confirmLabel`, `emptyTitle`, `errorMessage`, `searchPlaceholder`, …: UI too. */
const UI_SUFFIX = /(?:Label|Title|Message|Hint|Placeholder|Heading|Text)$/;

/** Constants and variables named for UI text: `COPY_ERROR_LABEL`, `emptyMessage`, `helpText`. */
const UI_VARIABLE = /(?:label|title|message|hint|placeholder|heading)$/i;

/** Calls whose first argument is spoken to the user. */
const UI_CALLS = new Set(['announce', 'announceForAccessibility', 'announceForAccessibilityWithOptions']);

const LETTER = /\p{L}/u;

/** Props that match the patterns above but take a fixed value, not text. */
const NOT_UI_NAMES = new Set(['enterKeyHint']);

const isUiName = (name: string) => !NOT_UI_NAMES.has(name) && (UI_NAMES.has(name) || UI_SUFFIX.test(name));

function nameOf(node: ts.PropertyName | ts.JsxAttributeName): string | null {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isPrivateIdentifier(node)) return node.text;
  if (ts.isJsxNamespacedName(node)) return `${node.namespace.text}:${node.name.text}`;
  return null;
}

/** The string literals an expression evaluates to (not those it merely uses). */
function valueStrings(expr: ts.Expression | undefined): ts.Node[] {
  if (!expr) return [];
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return [expr];
  if (ts.isTemplateExpression(expr)) {
    const own = [expr.head.text, ...expr.templateSpans.map((s) => s.literal.text)].some((s) => LETTER.test(s)) ? [expr] : [];
    return [...own, ...expr.templateSpans.flatMap((s) => valueStrings(s.expression))];
  }
  if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr) || ts.isNonNullExpression(expr))
    return valueStrings(expr.expression);
  if (ts.isConditionalExpression(expr)) return [...valueStrings(expr.whenTrue), ...valueStrings(expr.whenFalse)];
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return valueStrings(expr.right);
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.PlusToken)
      return [...valueStrings(expr.left), ...valueStrings(expr.right)];
  }
  if (ts.isArrayLiteralExpression(expr)) return expr.elements.flatMap((e) => (ts.isExpression(e) ? valueStrings(e) : []));
  return [];
}

function stringText(node: ts.Node): string {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.map((s) => `\${…}${s.literal.text}`)].join('');
  return node.getText();
}

/** The findings in one file's source. `isKey` says whether a string is a catalogue key. */
export function findInSource(file: string, source: string, isKey: (text: string) => boolean): Finding[] {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const findings: Finding[] = [];
  const report = (node: ts.Node, where: string, text = stringText(node)) => {
    if (!LETTER.test(text) || isKey(text)) return;
    findings.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text: text.trim(), where });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      report(node, 'JSX text', node.text);
    } else if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      for (const s of valueStrings(node.expression)) report(s, 'JSX child');
    } else if (ts.isJsxAttribute(node)) {
      const name = nameOf(node.name);
      if (name && isUiName(name) && node.initializer) {
        if (ts.isStringLiteral(node.initializer)) report(node.initializer, `${name}=`);
        else if (ts.isJsxExpression(node.initializer)) for (const s of valueStrings(node.initializer.expression)) report(s, `${name}=`);
      }
    } else if (ts.isPropertyAssignment(node)) {
      const name = nameOf(node.name);
      if (name && isUiName(name)) for (const s of valueStrings(node.initializer)) report(s, `${name}:`);
    } else if (ts.isBindingElement(node) && node.initializer && ts.isIdentifier(node.name)) {
      // A default: `function Dialog({ confirmLabel = 'Confirm' })`.
      const name = node.propertyName ? nameOf(node.propertyName) : node.name.text;
      if (name && isUiName(name)) for (const s of valueStrings(node.initializer)) report(s, `${name} =`);
    } else if ((ts.isVariableDeclaration(node) || ts.isParameter(node)) && node.initializer && ts.isIdentifier(node.name)) {
      const name = node.name.text;
      if (isUiName(name) || UI_VARIABLE.test(name)) for (const s of valueStrings(node.initializer)) report(s, `${name} =`);
    } else if (ts.isCallExpression(node)) {
      const callee = ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : ts.isIdentifier(node.expression) ? node.expression.text : '';
      if (UI_CALLS.has(callee)) for (const s of valueStrings(node.arguments[0])) report(s, `${callee}()`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings;
}

const SKIPPED_DIRS = new Set(['__tests__', '__fixtures__', '__live__', 'node_modules']);

/** The `.ts`/`.tsx` files under `path` that are app code (no tests, fixtures or live checks). */
export function sourceFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : [];
  return readdirSync(path).flatMap((name) => (SKIPPED_DIRS.has(name) ? [] : sourceFiles(join(path, name))));
}

/** Findings for every scanned file under `root` (or only `paths`), minus the allowlists. */
export function findHardcodedStrings(root: string, isKey: (text: string) => boolean, paths: readonly string[] = SCANNED): Finding[] {
  return paths
    .flatMap((p) => sourceFiles(join(root, p)))
    .map((abs) => relative(root, abs).split(sep).join('/'))
    .filter((file) => !(file in ALLOWED_FILES))
    .flatMap((file) => findInSource(file, readFileSync(join(root, file), 'utf8'), isKey))
    .filter((f) => !ALLOWED_STRINGS.some((a) => a.file === f.file && a.text === f.text));
}

export const formatFinding = (f: Finding) => `${f.file}:${f.line}  ${f.where}  ${JSON.stringify(f.text)}`;

if (typeof require !== 'undefined' && require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- the CLI loads the catalogue lazily
  const { allMessages } = require('../i18n') as typeof import('../i18n');
  const keys = allMessages();
  const root = join(__dirname, '..', '..');
  const args = process.argv.slice(2).map((a) => relative(root, join(process.cwd(), a)));
  const findings = findHardcodedStrings(root, (s) => keys.has(s), args.length ? args : SCANNED);
  for (const f of findings) console.log(formatFinding(f));
  console.log(`${findings.length} hard-coded string(s)`);
}
