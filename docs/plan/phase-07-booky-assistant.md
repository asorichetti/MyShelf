# Phase 07 — Booky assistant

## Goal

Turn Booky from a component (P00-10) into a genuinely helpful, never-annoying assistant: first-run onboarding, empty states everywhere, contextual help on every screen, and timely tips driven by a small rules engine with frequency caps and user control. See `PLAN.md` §8 for personality, expressions, triggers and accessibility rules.

## Scope

- Tip catalogue and copy; rules/trigger engine; seen/muted persistence.
- Onboarding flow.
- Empty states audit; contextual help for every screen.
- Dismissal, muting, Booky modes (Helpful / Quiet / Off).
- Motion polish with reduce-motion support; accessibility of bubbles.

## Out of scope

- Any generative or online "chat" — Booky's words are a fixed, reviewed catalogue.
- Voice output beyond the platform screen reader.

## Prerequisites

- Phases 00–06 (the triggers refer to their features). Earlier phases may already call `useBooky().showTip()` directly; this phase moves those calls onto the engine.

---

## Task cards

### P07-01 Tip catalogue — done

- **Description:** `src/components/booky/tips.ts`: a typed list of tips `{ id, trigger, expression, text, action?, priority, frequency: 'once' | 'session' | 'daily' | 'always', modes: ('helpful' | 'quiet')[] }` covering every trigger in `PLAN.md` §8 plus screen help texts. Copy guidelines in a header comment: ≤ 2 lines, friendly, no blame, no jargon. Text supports `{placeholders}` filled at runtime.
- **Files:** `src/components/booky/tips.ts`, `src/components/booky/format.ts`.
- **Acceptance:** every tip id unique; every text ≤ 120 characters after placeholder substitution with test data; every trigger in the PLAN table has a tip.
- **Tests:** `src/components/booky/__tests__/tips.test.ts` (uniqueness, length, placeholder coverage).
- **Delivered:** `tips.ts` lists every tip as data: `{ id, trigger, when?, expression, title?, text, action?, priority, frequency, modes, kind }` plus a few presentation flags (`placement`, `screenBound`, `welcome`, `minIntervalMs`, `celebration`, `testGroup`) and `sample` values for the test. `kind` separates *nudges* (unprompted: they share the cooldown), *feedback* (a reply to what the user just did, such as "Shelved!") and *help* (asked for). `when` narrows a trigger to a help screen or a variant (`book-added` has `milestone` and `batch`; `lookup-none` has `scan` and `offline`). Actions either navigate (`href`, placeholders allowed) or carry an id the emitter handles (`help-more`, `read-cover`). Besides the PLAN triggers there are `lookup-arrived` (details found for books added offline) and `backup-due` (copy only; Phase 08 adds the backup that emits it). `format.ts` fills `{placeholders}` (a missing value becomes empty, never a raw placeholder) and has `bookCount`. The test checks unique ids, a tip for every PLAN trigger and every help screen, sample data for every placeholder, at most 120 characters after substitution, and a few copy rules (no blame words, no shouting, British spelling, curly apostrophes).

### P07-02 Trigger engine — done

- **Description:** `BookyEngine` receives app events (`app-first-launch`, `app-foreground`, `shelf-empty`, `scan-opened`, `scan-idle`, `lookup-none`, `book-added`, `offline-queued`, `loan-overdue`, `series-gap`, `series-complete`, `help-requested`, `backup-due`) via `booky.emit(event, payload)`. It picks the highest-priority eligible tip considering mode, frequency, mute list and a global cooldown (no more than one unsolicited tip per 30 s; never while a dialog/sheet is open). Seen/muted state persisted in `settings` (`booky.seen`, `booky.muted`, `booky.mode`). Replace direct `say()` calls from earlier phases with `emit()`.
- **Files:** `src/components/booky/engine.ts`, `src/components/booky/BookyProvider.tsx`, call sites in `src/features/*`.
- **Acceptance:** deterministic selection for a given state (pure function `selectTip(state, event, now)`); caps and cooldown respected; mode filtering correct.
- **Tests:** `src/components/booky/__tests__/engine.test.ts` (table-driven), `src/components/booky/__tests__/BookyProvider.test.tsx`.
- **Delivered:** `engine.ts` is pure: `selectTip(state, event, now)` (and `selectFirst` for a list of alternatives, e.g. every overdue loan, most overdue first) applies the trigger and `when`, the mode (Off: help only; Quiet: tips that list it), the mute list (a tip id or one instance `<id>:<key>`), welcome tips, the frequency (`once` and `daily` per event `key`, `session`, `always`, `minIntervalMs`), the nudge rules (none while a dialog or sheet is open; one per 30 s unless it outranks the last) and never replaces a higher-priority tip on screen except with help; `markShown`, `markDismissed`, `mute` and `resetTips` update the state. Events come through `useBooky().emit(event)` or, from non-React code, `emitBooky(event)` (`bus.ts`); `onBookyEvent` lets code listen for a trigger. `BookyProvider` holds the state and persists it through a `BookyStore`; the app's (`src/features/booky/bookyStore.ts`, wired by `BookyRoot` in the root layout) keeps it in settings. The code's existing keys win over the card's names: `bookyMode` (mode) and `mutedTips` (muted), plus the new `booky.seen`, which replaces `series.gapTipSeriesIds` and `overdueNudgesShown`; saves are queued and a reload waits for them, and it reloads on `settings-changed` (the E2E loader now emits it). `BookyRoot` emits `app-foreground` on start and on return to the foreground. Call sites moved onto events: the series probe (`series-gap`, `series-complete`, keyed by series), the overdue nudge (listens for `app-foreground`, emits one `loan-overdue` per overdue loan keyed by loan), "Shelved!" (`book-added`, with `milestone` at 10, 50 and every hundred, and `batch` from the review tray), the offline queue (`offline-queued`, `lookup-arrived`, `lookup-none`/`offline`), "What can Booky do?" (`help-requested`, screen `booky`), the empty shelf (`shelf-empty`) and the first Scan visit (`scan-opened`). The scanner's "No barcode?" is an inline tip (`useInlineTip`: the screen draws it, the engine decides, now once a session as PLAN §8 says); lookup-not-found bubbles stay inline and take their words from the catalogue. `BookyOverlay` (root layout) replaces the tab and stack tip hosts and `SeriesEventHost`, keeping their test ids (`seriesTip.*`, `seriesCelebration.*`). Deviation: `backup-due` has a tip but nothing emits it until Phase 08 builds backups.

### P07-03 Onboarding — done

- **Description:** Route `src/app/onboarding.tsx`, shown on first launch (settings `onboarding.done`). Four cards with Booky: (1) "Hi, I'm Booky" (*happy*), (2) scan a barcode or read the cover (*thinking*), (3) lend books and I'll keep track (*happy*), (4) everything stays on your phone (*sleepy*/content) → "Let's fill your shelf" (goes to Scan) or "Look around first". Skip at any point; revisit from Settings → Help.
- **Files:** `src/app/onboarding.tsx`, `src/components/booky/OnboardingCard.tsx`, `src/app/_layout.tsx` (redirect logic).
- **Acceptance:** shown once; skip marks done; pager accessible (buttons, "Page 2 of 4" announced); E2E fixtures set `onboarding.done` unless the fixture is `first-run`.
- **Tests:** `src/__tests__/onboarding.test.tsx`.
- **Delivered:** `/onboarding` (`src/app/onboarding.tsx` → `src/features/onboarding/OnboardingScreen.tsx`) shows four `OnboardingCard`s (`src/components/booky/OnboardingCard.tsx`): Booky *happy*, *thinking*, *happy*, *sleepy*, the card title as the screen's one h1, and "Page 2 of 4" in a polite live region (the dots are hidden from assistive tech). Next and Back move between cards; Skip (cards 1–3), "Let’s fill your shelf" (→ Scan) and "Look around first" (→ Shelf) all set `onboarding.done` to true and emit `settings-changed`. The redirect is `OnboardingGate` in the root layout rather than in `_layout.tsx` itself: it reads `onboarding.done` on each route change (never on `/e2e`) until it is true. `onboarding.done` is `null` on a fresh install; `needsOnboarding(done, e2e)` (`src/domain/onboarding.ts`) shows it for null or false, but in E2E builds (every web build) only for an explicit false, which only the new `first-run` fixture sets (`Fixture.onboarding`), so no existing journey meets it. Booky's welcome tips (empty shelf, first Scan visit) wait until the onboarding is done (`welcomeTipsOn`). Revisiting it from Settings is the "Show the welcome tour" button in the Booky settings section (P07-06).

### P07-04 Empty states audit — done

- **Description:** Every list or screen that can be empty uses `EmptyState` with an appropriate Booky expression and a single clear action: Shelf, search no-matches, Loans (out / history), Groups, group detail, Series list, Genres, Authors, Scan review tray, Pending lookups. Add a `first-run` fixture.
- **Files:** screens listed; `src/testing/fixtures/firstRun.ts`.
- **Acceptance:** checklist in the PR with an auto test suite screenshot of each empty state (the `empty-states-gallery` journey).
- **Tests:** one component test per empty state (`src/__tests__/emptyStates.test.tsx`).
- **Delivered:** checklist (the `empty-states-gallery` journey screenshots each as `empty-<name>.png`): Shelf (*happy*, Scan a book, with Add manually as the quieter second), search with no matches (*thinking*, Clear search; filters: Clear filters), Loans out (*sleepy*, now "Go to your shelf"; one borrower: "Show everyone"), Loans history (*sleepy*, now "See what’s out"), Groups (*happy*, New group), a group with no books (*happy*, Add books), Series (*sleepy*, now "Add a book"), Genres and Authors (*sleepy*, now "Add a book"), the scan review tray (*sleepy*, Back to scanning). Pending lookups have no screen of their own: the Shelf's banner only appears while something is queued, so there is nothing to show empty. Genres, Authors, a group and the tray now carry `emptyState.root`. The `first-run` fixture came with P07-03.

### P07-05 Contextual help

- **Description:** Every tab screen and major screen gets a `?` `IconButton` in the header ("Help with this screen") that emits `help-requested` with a screen id; Booky (*thinking*) shows the screen's help tip with an optional "More" that opens a help sheet (short sections, e.g. "Where is the ISBN?", "What is an edition?", "How do series gaps work?").
- **Files:** `src/components/booky/HelpButton.tsx`, `src/components/booky/HelpSheet.tsx`, `src/components/booky/helpContent.ts`, screen headers.
- **Acceptance:** help available on Shelf, Scan, Loans, Groups, Settings, book detail, edition picker, series detail; works in all Booky modes (including Off).
- **Tests:** `src/components/booky/__tests__/HelpButton.test.tsx`, `helpContent.test.ts` (every screen id has content).

### P07-06 Dismissal, muting and Booky modes

- **Description:** Bubble dismiss (✕ and tap outside), auto-dismiss after 8 s unless it has an action (paused while a screen reader is on), "Don't show tips like this" (mutes tip id). Settings → Booky: mode Helpful / Quiet / Off, "Reset tips" (clears seen/muted). In Off mode the avatar is hidden; help buttons still work and show the help sheet without the character.
- **Files:** `src/components/booky/BookyBubble.tsx`, `src/app/settings/booky.tsx`, `src/components/booky/engine.ts`.
- **Acceptance:** each mode's behaviour verified; auto-dismiss disabled when `AccessibilityInfo.isScreenReaderEnabled()`.
- **Tests:** `src/components/booky/__tests__/dismissal.test.tsx`, `src/__tests__/settings.booky.test.tsx`.

### P07-07 Placement and layering

- **Description:** Booky docks bottom-right above the tab bar; the bubble never covers the focused input or a primary button (measure and flip above/left when needed); keyboard-aware; hidden in full-screen camera view except for scan tips which appear at the top.
- **Files:** `src/components/booky/BookyOverlay.tsx`, `src/components/booky/placement.ts`.
- **Acceptance:** pure `placement()` tested for edge cases; screenshot review at the `mobile` and `tablet` viewports (`npm run -s autotest -- screenshot --viewports mobile,tablet`).
- **Tests:** `src/components/booky/__tests__/placement.test.ts`.

### P07-08 Motion and reduce-motion

- **Description:** Booky already has an idle bob (P00-10: React Native `Animated`, a 2.8 s loop, off with reduce-motion). Tune it (about 2 px, 3 s loop) and add a blink every ~5 s, bubble pop-in (150 ms scale/opacity), celebration from P04-08, using `react-native-reanimated` (install with `npx expo install react-native-reanimated` if not already present). All disabled when reduce-motion is on (`useReducedMotion`); web honours `prefers-reduced-motion`.
- **Files:** `src/components/booky/Booky.tsx`, `src/components/booky/useBookyMotion.ts`.
- **Acceptance:** no animation frames scheduled with reduce-motion; no layout shift from animation.
- **Tests:** `src/components/booky/__tests__/useBookyMotion.test.tsx`.

### P07-09 Booky accessibility pass

- **Description:** Verify and fix: Booky's avatar is one labelled image (`role="img"`, label names the expression) with its artwork hidden ([ADR 0014](../adr/0014-warm-paper-palette-and-labelled-booky.md)); bubble text announced politely (live region: `accessibilityLiveRegion` on Android, `aria-live="polite"` on web); no focus steal; dismiss labelled, 48 dp; bubble text contrast AA; every error Booky mentions also appears inline on the screen.
- **Files:** `src/components/booky/*`.
- **Acceptance:** the auto test suite's `a11y` gate clean on screens with a bubble open; TalkBack manual check noted in PR.
- **Tests:** `src/components/booky/__tests__/a11y.test.tsx`.

---

## Test ids to add to `selectors.json`

```json
{
  "booky": {
    "avatar": "booky-avatar", "bubble": "booky-bubble", "bubbleText": "booky-bubble-text",
    "dismiss": "booky-dismiss", "action": "booky-action", "mute": "booky-mute",
    "helpButton": "booky-help-button", "helpSheet": "booky-help-sheet", "helpMore": "booky-help-more"
  },
  "onboarding": { "root": "onboarding-root", "card": "onboarding-card", "next": "onboarding-next", "skip": "onboarding-skip", "start": "onboarding-start", "explore": "onboarding-explore" },
  "bookySettings": { "root": "booky-settings-root", "modeHelpful": "booky-mode-helpful", "modeQuiet": "booky-mode-quiet", "modeOff": "booky-mode-off", "resetTips": "booky-reset-tips" }
}
```

(`booky.avatar`, `bubble`, `bubbleText`, `dismiss`, `action` and `tipHost` exist from P00 — extend the group.)

## Auto test suite journeys

Each journey is added by the card that builds its screen. Suite `core` journeys run in `smoke` (CI and the regression gate); the rest use suite `p07` (`npm run -s autotest -- journey --suite p07`).

| Journey | Suite | Steps |
|---|---|---|
| `onboarding-first-run` | `p07` | fixture `first-run`; 4 cards via next → start → lands on Scan; reload → no onboarding |
| `onboarding-skip` | `p07` | skip on card 1 → Shelf |
| `booky-help-each-tab` | `p07` | for each tab: help button → bubble text non-empty → dismiss; a11y gate enforced with bubble open |
| `booky-mute-tip` | `p07` | trigger empty-shelf tip → mute → reload → tip not shown |
| `booky-modes` | `p07` | set Off → avatar hidden, help still works; set Quiet → book-added tip not shown |
| `empty-states-gallery` | `p07` | fixture `empty`; visit every empty state; screenshot each for review |

## Maestro flows

| Flow | Checks |
|---|---|
| `.maestro/onboarding.yaml` | fresh install shows onboarding; skip; relaunch does not |
| `.maestro/booky-talkback.yaml` | manual-assisted (tagged `manual`): with TalkBack on, a new bubble is announced and focus stays put |

## Risks

| Risk | Mitigation |
|---|---|
| Booky becomes annoying | cooldown, once/session/daily caps, mute, Quiet/Off modes, review of copy |
| Bubble obscures UI | placement algorithm + screenshot review; never over primary actions |
| Screen reader noise | polite announcements only; no repeated announcements; auto-dismiss off with screen reader |

## Regression gate

Before any card in this phase is ticked, and before the phase is closed, both must be green locally and in CI:

```bash
npm run check                    # selectors:check + lint + typecheck + Jest
npm run -s autotest:smoke        # the auto test suite's `smoke`: core journeys, gates set to fail
```

`autotest:smoke` needs the web server running (`CI=1 npx expo start --web --port 8081`). Phase close also requires every journey, including this phase's, to pass with gates enforced (`npm run -s autotest:journeys -- --ux-gates fail`) and the Maestro flows above to have been run on an emulator or device, with the result noted in the pull request.

## Exit criteria

- Onboarding, empty states, help and tips work on Android and web in all three modes.
- All P07 journeys pass with `--ux-gates fail`; Maestro flows pass (TalkBack check noted).
- Regression gate green in CI.
