# Accessibility audit

The P09-01 audit of MyShelf: what was checked on every screen, what was
found and fixed, and what is still owed. The TalkBack walkthrough at the end
needs a real Android phone and has not been run yet.

- **Audited:** September 2026, on `main` at `0b5f6c1` plus the fixes below.
- **Standard:** the plan's own bar (`AGENTS.md` → Accessibility and UX,
  `PLAN.md` §8 and §9): every control has a role and a name, headings mark
  sections, 48 dp targets, WCAG AA contrast from the theme tokens, nothing
  conveyed by colour alone, reduced motion respected. WCAG 2.2 AA where the
  plan says nothing more specific.

## How it was checked

On the web build (`npm run export:web`, served with `--serve dist`, a
390 × 844 phone viewport), which shares its components, labels, roles and
layouts with the Android app:

1. **The UX gates** on every journey (`--ux-gates fail`): one `h1`, no
   skipped heading levels, named buttons, links, tabs, switches and
   checkboxes, `alt` on images, one `main`, 48 × 48 targets, no sideways
   overflow. No gate rule was disabled and no journey waives an `a11y` rule.
2. **axe-core 4** (a scratch run, not part of the suite) on 31 screens and 24
   states (below), with the `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa` and
   `best-practice` tags, colour contrast included, in the light and the dark
   theme.
3. **A scripted walk** of each of those screens and states: the Tab order
   with each stop's role, name, state (`aria-checked`, `aria-selected`,
   `aria-expanded`, `aria-pressed`) and position; every heading; every live
   region; every image and how it is named; anything that looks pressable
   but has no role; text cut off or truncated. Then every sheet, dialog,
   menu and select list opened by keyboard: where focus lands, whether Tab
   stays inside, whether Escape closes it, and where focus goes after.
4. **Enter and Space** on one control of every role (button, link, tab,
   radio, checkbox, switch, menu item).
5. **200 % text** on every screen, through the web E2E build's font scale
   (see [Large text](#large-text)), with full-height screenshots reviewed
   by eye.
6. **Reading the code** for what a browser cannot show: animations and
   reduced motion, TalkBack props (`accessibilityLiveRegion`,
   `accessibilityState`, `maxFontSizeMultiplier`, `allowFontScaling`).

Contrast is held by the token tests (`src/theme/__tests__/contrast*.test.ts`,
every text pair 4.5:1 and every UI pair 3:1 in both themes); axe agreed, with
no contrast finding in either theme.

### Screens and states walked

| Area | Screens and states |
|---|---|
| Shelf | list, covers grid, spine shelf, a search with results and with none, grouped by genre, selection mode, the filter sheet, the Sort sheet and the group-by panel, Booky's help tip, an Undo snackbar, the empty Shelf |
| Book | detail (at home, on loan, overdue, from a series), the add form (empty, with lookup results), the edit form, Refresh details, the More menu, the delete dialog, the lend sheet with its date fields, the return sheet, the group picker |
| Lookup and scan | Scan (barcode and cover modes, batch toggle), the edition picker (one edition; works grouped with editions), the scan tray review (empty and with scans) |
| Series | the series list, a series with a gap, its More menu |
| Lending | Loans (out now, history, empty), the borrower filter, a borrower |
| Groups, genres, authors | Groups, a group, reordering, the new-group sheet, Genres, a genre, its rename and merge sheets, Authors (letter index), an author, its edit and merge sheets |
| Settings | Settings, Shelf and lending (select lists, Appearance), Borrowers, Pending lookups, Back up, Restore (a file picked), Export CSV, Import CSV (mapping and preview), Erase (both steps), About |
| Booky | onboarding pages 1–4, help tips and the help sheet on every tab, empty states |
| Errors | the not-found screen, a missing book, a screen's error boundary |
| Dark mode | every screen and state above again in the dark theme (axe, contrast included) |

## What was found and fixed

23 issues. Commits are on the `a11y` branch.

### Keyboard and focus

| # | Found | Fixed | Commit |
|---|---|---|---|
| 1 | **Enter did nothing on a link drawn as a `div`**: react-native-web leaves `role="link"` to the browser, which only follows real anchors. So the Settings rows, the series, author, genre and borrower rows and a book's series links could not be opened from a keyboard. | One listener for the whole app (`useKeyboardActivation`, web only) clicks the focused link on Enter. | `7a23d2b` |
| 2 | **Space did not operate checkboxes, radios, switches, tabs or menu items** (react-native-web presses only `role="button"` on Space). | The same listener: Space on those roles, the tab bar's tabs included, without scrolling the page. | `7a23d2b` |
| 3 | **Every sheet, dialog, menu and select list sat inside an unnamed dialog**: react-native-web's Modal wraps its content in its own `role="dialog"` (axe `aria-dialog-name`, serious). | The wrapper takes the modal's name (`modalProps`). | `ad265c0` |
| 4 | **Focus fell to the page body when a sheet closed** if its first field took focus as it opened (new group, rename a genre): react-native-web noted that field, not the button, as the place to go back to. | Each modal notes its opener as it opens, before anything inside can take focus, and gives focus back when it closes (`useReturnFocus`). | `ad265c0` |
| 5 | **Closing the help sheet dropped focus**: it opens from Booky's tip, which has gone by then. | Focus goes back to the help button (`returnFocusTo`), or to the latest earlier control still on screen. | `9595823` |
| 6 | **The scrim behind every modal was a Tab stop**: an empty, unnamed box, and the focus trap landed on it when Tab wrapped round. | A plain `Scrim` view that closes on a tap and is never focusable. | `ad265c0`, `9595823` |
| 7 | **Menus had no arrow keys**, which the menu pattern and screen readers in a menu expect. | Up, Down (both wrap), Home and End move between items; Tab still works. | `ad265c0` |
| 8 | **Lending or returning dropped focus**: Lend is replaced by Mark returned (and back), and the button that had focus disappears. | The replacement takes focus (on the phone, TalkBack's focus). | `9595823` |
| 9 | **A select list opened on its container**, not the current choice. | It opens on the checked option, as a native picker does. | `8bab3bb` |

### Announcements and names

| # | Found | Fixed | Commit |
|---|---|---|---|
| 10 | **Snackbars were live regions that arrived already holding their message**, which screen readers often skip: "Lent to Sam", "Welcome home", "Removed …" and Undo could pass unheard. | The snackbar host is one polite live region that is always on the page; messages arrive inside it. | `509eaa4` |
| 11 | **The CSV import said nothing while it worked**, and its report (like a finished restore) replaced the button that started it, dropping focus. | The preview's status line says "Importing 20 books…"; the report and the restore result take focus when shown, so they are read out. | `509eaa4` |
| 12 | **Lists whose children were not list items**: the author index, the lookup results and the group, genre and author pickers (axe `aria-required-children`, critical). | Each entry is a list item, the lists are named, and the result count and Show more sit outside the list. | `1fdc129` |
| 13 | **The edition picker's covers carry meaning a screen reader never got**: a sighted reader spots their edition by its cover. | Each edition's name ends "with a cover picture" or "no cover picture". | `517b334` |
| 14 | **The web date field stayed light in the dark theme** (its colour scheme was pinned), so its calendar button was dark on dark. | It follows the theme. | `517b334` |

### Large text

| # | Found at 200 % text | Fixed | Commit |
|---|---|---|---|
| 15 | There was **no way to check large text on web**: react-native-web writes sizes in px and ignores the browser's text size. | The theme carries a font scale: on a phone the system's (Android scales `Text` itself), on the web E2E build `?e2e-font-scale=2`, which scales the typography tokens. | `fb11e27` |
| 16 | **Truncated text kept its line count**, so at 200 % a two-line title showed half as many words. | `Text` and `Heading` scale their `numberOfLines` with the font (two lines become four); every truncated row already carries its full text in its accessible name. | `fb11e27` |
| 17 | **Button labels ran off the screen** ("Show the welcome tour"). | Labels wrap; a wrapped button is a rounded box instead of an oval pill. | `055f7af` |
| 18 | **The edit form's Cancel was pushed off the left edge.** | The form's bottom bar wraps. | `055f7af` |
| 19 | **A book's title and facts broke mid-word** beside the cover ("Murde r", "HarperCol lins"), and the title column then ran past the card. | The header moves the text under the cover when a larger font needs the room, and lists one fact per line. | `055f7af`, `7a9c3f9` |
| 20 | **The loan stamp ran sideways off the screen.** | Stamps stay inside their column, tilt included, and wrap. | `055f7af` |
| 21 | **A series gap's words broke beside its Add button, and a series name broke beside "See series".** | Those rows let the button move underneath. | `055f7af` |
| 22 | **Lettering in pictures grew out of them**: the generated cover's title and the spines' titles. | Picture lettering keeps its designed size (`artworkTypography`, `allowFontScaling={false}` on the phone); the same words are always in the adjacent text or the control's name. | `055f7af` |
| 23 | **The tab bar has a fixed height** that 200 % labels would overflow, and chips had a fixed height too. | Tab labels stop growing at 150 % (`maxFontSizeMultiplier`), the bar grows with them, and chips have a minimum height. | `fb11e27`, `055f7af` |

## Large text

- **On the phone** Android's font size setting scales every `Text`. The
  theme reads the factor (`useFontScale`) only for the few layouts that
  must make room: the tab bar, the book header, the facts grid, series rows.
- **Caps:** tab labels stop at 150 % (`typographyMaxScale`), since five share
  the bar's width; lettering inside pictures does not scale. Everything else
  grows without limit.
- **On web** (the test target) the E2E build takes `?e2e-font-scale=<1–3>`
  and keeps it for the tab (`src/features/e2e/fontScale.web.ts`); the
  journey `a11y-large-text` sets it through sessionStorage. The browser's own
  zoom is not what a phone does (it enlarges the layout too), so the audit
  scales text only, as Android does.
- The journey checks the Shelf, an overdue book, the edit form, the lend
  sheet, Loans, Groups, Scan, Settings, a series and the covers grid: the
  `h1` is really 56 px, nothing overflows sideways (render gate), no text is
  cut off by its box, truncated text is named in full, the tab labels fit,
  and the page gates pass.

## Already right

What the audit checked and found sound, so nothing changed:

- **Roles and names:** every control on every screen and state has a role
  and a name (gates and axe). Icon buttons require a label by type. Rows and
  cards speak a full sentence ("Dune, by Frank Herbert, 1965, on loan to
  Sam").
- **Headings:** one `h1` per screen; sections are `h2`, sheet titles `h2`
  and their sections `h3`; the Shelf's sections read "Fantasy, 6 books".
- **Focus order** follows the visual order on every screen walked: top bar,
  content top to bottom, bottom actions, tab bar. Booky's tip comes after
  the tab bar, because it floats above everything and never takes focus.
- **States:** toggles, radios, checkboxes and chips carry `aria-checked`;
  tabs `aria-selected`; the sort, group-by, More and help buttons
  `aria-expanded`; errors are `role="alert"` and fields `aria-invalid`.
- **Live regions:** the Shelf's result count ("4 of 12 books match
  “prat”"), onboarding's page, the Booky mode note, Booky's tips (one
  always-mounted announcer), "Welcome home" on a returned book.
- **Targets:** every control is at least 48 × 48 (gate `target-size`, no
  exemptions beyond inline links and disabled controls).
- **Colour is never the only signal:** overdue loans say OVERDUE and the
  days; loan stamps are words; series gaps are dashed cards saying
  "#3 missing"; group swatches carry the group's name and icon, and in the
  editor each swatch is a radio named after its colour; selected chips add
  a tick; notices have an icon; the active tab has a tinted background as
  well as colour, and `aria-selected`.
- **Images:** covers next to their titles are decorative (hidden from
  assistive tech). Where a cover stands alone, the control around it is
  named: a covers-grid cell is a button named after the book; an edition in
  the picker is a radio naming its facts (and now whether it has a cover).
  Booky is a named image; the Shelf's spines are named buttons.
- **Reduced motion:** Booky's idle bob, blink, pop-in and celebration, the
  sheet and dialog animations, the cover fade-in and the viewfinder all
  check the setting (`useReducedMotion`, `booky-motion` journey); menus and
  select lists do not animate.
- **Dark mode:** no axe finding in the dark theme; contrast held by
  `contrast.dark.test.ts`.

## Tests

- **Journeys** (suite `p09`, `tools/auto-test-suite/src/journeys/a11y.journey.ts`):
  `a11y-large-text`; `a11y-keyboard-sheets` (lend sheet, new-group sheet,
  filter sheet, a select list: focus in, trapped, named, Escape, focus back);
  `a11y-keyboard-menu-dialog` (menu arrows, Home, End, Escape; the delete
  alert dialog); `a11y-keyboard-tabs` (Space and Enter on the tab bar, the
  Loans tabs, Settings rows, series and author rows, a switch, a radio, a
  checkbox); `a11y-keyboard-lend-return` (lending and returning by keyboard,
  focus moving to the swapped button, "Lent to Sam" arriving in a live
  region that was already there); `a11y-help-focus`.
- **Jest:** `src/theme/__tests__/fontScale.test.tsx`,
  `src/__tests__/a11yAudit.test.tsx`,
  `src/hooks/__tests__/keyboardActivation.web.test.ts`,
  `src/components/ui/__tests__/modalA11y.web.test.ts`,
  `src/features/e2e/__tests__/fontScale.web.test.ts`,
  `src/components/settings/__tests__/SettingsNotice.test.tsx`, and new cases
  in `feedback.test.tsx` (the snackbar's live region), `authors.test.tsx`
  and `GroupPickerSheet.test.tsx` (list items).

## What remains

- **The TalkBack walkthrough on a phone** (below). Several fixes were made
  for Android but proved only through their props in Jest: the snackbar
  host as a live region, focus moving to a result or a swapped button
  (`sendAccessibilityEvent`), the tab labels' `maxFontSizeMultiplier` and
  the artwork's `allowFontScaling={false}`.
- **Display size "Largest"** (Android's screen zoom, separate from font
  size) has not been tried; it narrows the layout, like a 320 dp phone.
- **Web-only fixes** (Enter and Space, naming react-native-web's dialog
  wrapper, giving focus back, menu arrow keys) do not touch the phone, where
  TalkBack's double tap presses anything and a Modal is its own window.
- **Booky's floating tip at 200 % text** is large and can sit over inline
  content (on an overdue book, over Mark returned) until dismissed; it still
  steps round the bottom actions it knows about (P07-07). Not changed.
- **The web focus ring** is the browser's own; it is visible in both themes
  but not themed.
- **Chromium makes a scroll container a Tab stop** when nothing inside it
  can be focused to scroll it (a long sheet's body); it has no name. That is
  the browser's way of letting the keyboard scroll, and was left alone.

## TalkBack walkthrough (to run on the phone)

For the owner, on a Samsung or other Android phone with the release or
preview APK. Tick each line; anything that fails, note what TalkBack said.

**Before you start**

- [ ] Install the APK; open MyShelf once and finish or skip the welcome tour.
- [ ] Turn on TalkBack: Settings → Accessibility → TalkBack (on Samsung:
      Settings → Accessibility → TalkBack). Swipe right/left moves between
      items; double tap presses; swipe down then left is Back.
- [ ] Optional second pass: Settings → Display → Font size and style → the
      largest size, then repeat the three flows.

**1. Scan → save**

- [ ] On the Shelf, TalkBack reads "MyShelf, heading" and the book count.
- [ ] Swipe to the tab bar: each tab is read with its name and "tab", the
      Shelf tab as selected. Double tap **Scan**.
- [ ] TalkBack reads "Scan a book, heading". If asked, **Allow camera** is
      read as a button; double tap it and allow.
- [ ] "Scan the barcode" and "Read the cover" are read as radio buttons, one
      checked.
- [ ] The camera is read as "Camera: line up the barcode on the back cover".
      Point it at a book's barcode (TalkBack can stay on).
- [ ] When the barcode is read, the edition picker opens and TalkBack reads
      its heading ("Is this your book?" or "Which edition is yours?").
- [ ] Each edition is read as a radio button with its format, publisher,
      year, pages, ISBN, title, source and "with a cover picture" or "no
      cover picture"; one is checked.
- [ ] **This is my edition** is read as a button; double tap it.
- [ ] The book page opens: "…, heading" with the title, and Booky's
      "Shelved!" tip is read out without moving focus.
- [ ] Also try **Type the ISBN instead** on the Scan tab: the field is
      read with its label, the keyboard types, **Look up** is a button.

**2. Lend → return**

- [ ] On a book at home, swipe to **Lend** ("Lend <title>, button") and
      double tap.
- [ ] The lend sheet opens and TalkBack reads its title; focus is inside
      the sheet (swiping never reaches the page behind it).
- [ ] The borrower field is read as "Who's borrowing it?"; type a name.
      Each suggestion is read as "Lend to <name>, …, button".
- [ ] "Lent on" and "Due back" are read with their dates; double tap opens
      the date picker, which is read out.
- [ ] Double tap **Lend**. TalkBack says "Lent to <name>" (the snackbar),
      and focus lands on **Mark returned**.
- [ ] The stamp is read as "On loan · <name>. Due back on <date>".
- [ ] Double tap **Mark returned**: the return sheet's title is read, the
      date field and **Mark returned** / **Not yet** buttons.
- [ ] Confirm. TalkBack says "Welcome home, …" (with **Undo**), and focus
      lands on **Lend**.
- [ ] On the Loans tab, the tab is read as "Loans, 1 overdue" when a loan
      is overdue; "Out now" and "History" are read as tabs, one selected;
      an overdue row is read "Overdue by N days, …".
- [ ] The back gesture from the sheet closes it without saving.

**3. Create a group**

- [ ] On the Groups tab, **New group** is read as a button; double tap.
- [ ] The sheet's title "New group" is read; the Name field has focus and
      its label.
- [ ] Each colour is read as a radio button named after it ("Lavender",
      "Rose", …) with checked or not checked; each icon too ("Heart icon").
- [ ] Double tap **Save**: the group appears, read as "<name>, 0 books".
- [ ] Open a book, double tap **Add to group**: the picker lists groups as
      buttons ("<name>, N books"); choose the new group. The book's Groups
      section now names it.
- [ ] Open the group: its books are read one by one; **Reorder books**
      offers "Move <title> up" / "Move <title> down" buttons per book.

**4. Rate a book (Phase 10)**

- [ ] On a book's page, swipe to "Your rating, heading", then to the stars:
      TalkBack reads "Rating, Not rated" (or "4 out of 5 stars") as an
      adjustable control, and the five stars are not separate stops.
- [ ] Swipe up once: TalkBack reads the new value, and "Rated 1 star" is
      announced. Swipe up again to 2 stars, down to 1, down again to not
      rated ("Rating cleared").
- [ ] **Clear rating** is read as a button (dimmed when there is nothing to
      clear); double tap clears.
- [ ] Back on the Shelf, the book's row ends "…, rated N out of 5".
- [ ] In the edit form, "Your rating" works the same way and Save keeps it.

**5. Sort the Shelf (Phase 11)**

- [ ] On the Shelf, the sort button reads "Sort: <the whole sort>, button";
      double tap opens "Sort your shelf" with focus inside.
- [ ] The presets are radio buttons ("Library order, checked"); choosing one
      announces "Sorted by Library order".
- [ ] Each level reads "Level 2: Then by Author, A to Z"; its buttons read
      "Then by: Author. Change", "Author order: A to Z. Reverse", "Move
      Author up", "Move Author down" and "Remove Author".
- [ ] Moving a level announces "Author moved to level 1 of 3", and TalkBack's
      focus stays on the level.
- [ ] Save as preset → type a name → Save preset: "Saved “<name>”" is
      announced and the preset is under "Your presets", with Rename and
      Delete buttons named after it.
- [ ] Close the sheet: the line under the toolbar reads "Sorted by …".

**Throughout**

- [ ] No button is read only as "button" or "unlabelled".
- [ ] Headings can be jumped to (TalkBack's reading controls → Headings).
- [ ] Nothing is read twice in a row, and nothing is skipped.
- [ ] With Settings → Accessibility → Visibility enhancements → Remove
      animations on, Booky does not move and sheets appear without sliding.
