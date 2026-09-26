# Localisation

MyShelf ships in English (British) only, but every word it shows or says
comes from one catalogue, so adding a language is a translation job and not
a code change (P09-11). This page covers how the strings are organised, the
rules for writing new UI, and how to add a language.

## How it works

- **`src/i18n/en.ts`** is the catalogue: one typed object, grouped by feature
  (`shelf`, `book`, `loans`, `series`, `settings`, `tips`, …). A key is the
  path to a message: `shelf.screen.count`, `loans.screen.title`.
- **`src/i18n/index.ts`** has the helper:

  ```ts
  import { t } from '@/i18n';

  t('common.cancel');                              // "Cancel"
  t('loanStamp.returned', { date: '12 Oct' });     // "Returned 12 Oct"
  t('common.books', { count: 3 });                 // "3 books"
  t('shelf.screen.count', { count: 2000 });        // "2000 books catalogued"
  ```

  Keys are type-checked: a key that is not in the catalogue does not
  compile, and neither does a call that leaves out a `{placeholder}` or a
  plural's `count`, or passes parameters to a message that has none.
- **Plurals** are objects of [`Intl.PluralRules`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules)
  categories, chosen by `count`: `{ one: '{count} book', other: '{count} books' }`.
  `other` is required. A language that needs `zero`, `two`, `few` or `many`
  adds them. On an engine without `Intl.PluralRules`, the English rule is
  used (one for exactly 1).
- **Numbers** in parameters go through `Intl.NumberFormat` in the
  catalogue's locale, **without** thousands separators, as the Shelf's
  stamp is designed ("2000 books catalogued"). `formatNumber(n)` does the
  same for code that needs it.
- **Dates** come from `formatDay` (`src/i18n`), which the date helpers in
  `src/domain` use:
  - **Day month year** ("12 Oct 2026", the default preference) and the loan
    stamps ("DUE 26 JUN") take their order and digits from
    `Intl.DateTimeFormat` in the catalogue's locale. The month's name comes
    from the catalogue (`dates.months.*`), because engines disagree on it:
    ICU calls September "Sept" in `en-GB`, and the stamps are designed
    around three letters. Without `formatToParts`, the catalogue's
    `dates.dayMonthYear` / `dates.dayMonth` patterns are used.
  - **Your phone's style** is `Intl.DateTimeFormat` in the phone's own
    locale.
  - **Year-month-day** is ISO 8601 in every language.
- `translate(key, params)` is the unchecked form of `t`, for a key held in
  data: a Booky tip's text, a help section, an option's label. Such data
  stores the key (typed `MessageKey`) and never the English.

### Rules for new UI

1. No text in components. Add a key to `en.ts` under the feature's group
   and call `t`. British English, curly quotes and apostrophes.
2. Write whole sentences with placeholders (`'Lent to {name} on {date}.'`),
   never sentences glued from pieces: word order differs between languages.
   A note above a key tells the translator where it shows when that isn't
   obvious.
3. Anything that counts is a plural message with `count`. Never build it by
   hand (`n === 1 ? …`).
4. **Never call `t` at module scope** (a constant, an option list built at
   import). Store the key and translate while rendering. Text translated at
   import misses a catalogue chosen at start-up, and the pseudo-locale test
   catches it.
5. A key group must not have a child called `other`: the type system reads
   that group as a plural.

### What stays out of the catalogue

- **Test ids, log and `console` messages, and errors meant for
  developers** (`src/services/http/errors.ts`, invariant failures). A
  screen that shows a failure shows its own catalogue text.
- **Data**: book titles, names, series, publishers, and genre names. That
  includes the curated genre list, which is stored in the database and
  matched against lookups, and the "Untitled" title a lookup stores when a
  record has none. Stored enum values (`paperback`, `en`) are shown through
  the catalogue (`book.formats.*`, `languages.names.*`).
- **File formats.** The column headers of the CSV export
  (`src/services/backup/exportCsv.ts`), the header names the CSV import
  recognises (`csvPresets.ts`: "Title", "Book Id", "Exclusive Shelf"), and
  the backup JSON are formats that other apps and older versions read.
  Translating them would break round trips, so they stay English in every
  language. The labels the column mapper *shows* for those fields are UI
  and are in the catalogue.
- **The error details** copied from the crash screen (`errorDetails.ts`)
  are a technical report for whoever fixes the bug.

## Enforcement

- **`src/i18n/__tests__/no-hardcoded-strings.test.ts`**, part of
  `npm run check`, fails on a string with a letter in it, outside
  `src/i18n`, in any of these places:
  - JSX text;
  - a string value in JSX children (`{'Hello'}`, `{ok ? 'Yes' : 'No'}`);
  - the value of a UI prop or object property: `accessibilityLabel`,
    `accessibilityHint`, `aria-label`, `placeholder`, `title`, `label`,
    `hint`, `message`, `text`, `body`, `heading`, `description`, and any
    name ending in `Label`, `Title`, `Message`, `Hint`, `Placeholder`,
    `Heading` or `Text`. This covers `<Button label="…">`,
    `show({ message: '…' })` and `{ label: '…' }` in option lists;
  - a default for such a prop, or a constant with such a name
    (`{ confirmLabel = 'Confirm' }`, `COPY_ERROR_LABEL = '…'`);
  - the text passed to `announce(…)`.

  Strings with no letters (symbols such as "·" or "—") and strings that
  are catalogue keys are allowed. The rules and the two allowlists
  (`ALLOWED_FILES`, `ALLOWED_STRINGS`, each entry with its reason) are in
  `src/testing/hardcodedStrings.ts`. To list offenders while you work, run:

  ```bash
  npx tsx src/testing/hardcodedStrings.ts src/features/loans
  ```
- **`src/i18n/__tests__/strings.test.ts`** checks the catalogue:
  - every key is used (or listed in `INTENTIONALLY_UNUSED` with a reason);
  - no message is empty;
  - every call site passes exactly the placeholders its message has;
  - plurals render correctly;
  - dates and numbers are formatted as designed.

  It also renders the key screens under a **pseudo-locale**, which wraps
  every message in `[[ ]]`, and fails on any text or accessible name with
  letters outside the brackets, apart from the fixture's own data.

## Adding a language

1. **Write the catalogue.** Copy `src/i18n/en.ts` to, say,
   `src/i18n/fr.ts`, type it as `Catalogue`, and translate the values. Do
   not change the keys:

   ```ts
   import type { Catalogue } from '.';

   export const fr: Catalogue = {
     meta: { locale: 'fr-FR' },
     common: { cancel: 'Annuler', books: { one: '{count} livre', other: '{count} livres' }, … },
     …
   };
   ```

   `tsc` then reports any missing key or group. Keep every `{placeholder}`
   (you may reorder them). Give plurals every category the language's
   `Intl.PluralRules` uses: French puts 0 and 1 in `one`; Polish needs
   `few` and `many`. Set `meta.locale` to the language's BCP 47 tag, which
   drives the plural rules and number and date formats.
2. **Check the date-related messages.** `dates.months.*` are the stamp's
   short month names. `ui.dateField.placeholder` and `ui.dateField.hint`
   describe the typed date format, which `src/domain/dateInput.ts` parses
   as day/month/year: change the parser before changing the hint.
3. **Choose it at start-up.** Before the first render (in
   `src/app/_layout.tsx`), pick the catalogue from the phone's locale and
   call `setCatalogue(fr)`. `Intl.DateTimeFormat().resolvedOptions().locale`
   gives the locale without a new dependency; `expo-localization` gives the
   phone's full list of preferred languages if you need it. Screens
   translate as they render and do not re-render on a switch, so a change
   of language takes effect on the next launch.
4. **Test it.**
   - Run `npm run check`.
   - Run the app at 200 % font size: translations are often longer, and
     rows must wrap rather than clip (see `docs/accessibility.md`).
   - Read the Booky tips aloud: they have a 120-character budget
     (`src/components/booky/tips.ts`).
   - To test with the language on, add a Jest case that calls
     `setCatalogue(fr)` and renders a screen, as the pseudo-locale test
     does.

Not covered yet: right-to-left layout (Arabic, Hebrew) would need
`I18nManager` and a layout review, and the generated covers' letters and
the call numbers assume a Latin script.
