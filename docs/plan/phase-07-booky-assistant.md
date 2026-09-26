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

### P07-01 Tip catalogue

- **Description:** `src/components/booky/tips.ts`: a typed list of tips `{ id, trigger, expression, text, action?, priority, frequency: 'once' | 'session' | 'daily' | 'always', modes: ('helpful' | 'quiet')[] }` covering every trigger in `PLAN.md` §8 plus screen help texts. Copy guidelines in a header comment: ≤ 2 lines, friendly, no blame, no jargon. Text supports `{placeholders}` filled at runtime.
- **Files:** `src/components/booky/tips.ts`, `src/components/booky/format.ts`.
- **Acceptance:** every tip id unique; every text ≤ 120 characters after placeholder substitution with test data; every trigger in the PLAN table has a tip.
- **Tests:** `src/components/booky/__tests__/tips.test.ts` (uniqueness, length, placeholder coverage).

### P07-02 Trigger engine

- **Description:** `BookyEngine` receives app events (`app-first-launch`, `app-foreground`, `shelf-empty`, `scan-opened`, `scan-idle`, `lookup-none`, `book-added`, `offline-queued`, `loan-overdue`, `series-gap`, `series-complete`, `help-requested`, `backup-due`) via `booky.emit(event, payload)`. It picks the highest-priority eligible tip considering mode, frequency, mute list and a global cooldown (no more than one unsolicited tip per 30 s; never while a dialog/sheet is open). Seen/muted state persisted in `settings` (`booky.seen`, `booky.muted`, `booky.mode`). Replace direct `say()` calls from earlier phases with `emit()`.
- **Files:** `src/components/booky/engine.ts`, `src/components/booky/BookyProvider.tsx`, call sites in `src/features/*`.
- **Acceptance:** deterministic selection for a given state (pure function `selectTip(state, event, now)`); caps and cooldown respected; mode filtering correct.
- **Tests:** `src/components/booky/__tests__/engine.test.ts` (table-driven), `src/components/booky/__tests__/BookyProvider.test.tsx`.

### P07-03 Onboarding

- **Description:** Route `src/app/onboarding.tsx`, shown on first launch (settings `onboarding.done`). Four cards with Booky: (1) "Hi, I'm Booky" (*happy*), (2) scan a barcode or read the cover (*thinking*), (3) lend books and I'll keep track (*happy*), (4) everything stays on your phone (*sleepy*/content) → "Let's fill your shelf" (goes to Scan) or "Look around first". Skip at any point; revisit from Settings → Help.
- **Files:** `src/app/onboarding.tsx`, `src/components/booky/OnboardingCard.tsx`, `src/app/_layout.tsx` (redirect logic).
- **Acceptance:** shown once; skip marks done; pager accessible (buttons, "Page 2 of 4" announced); E2E fixtures set `onboarding.done` unless the fixture is `first-run`.
- **Tests:** `src/__tests__/onboarding.test.tsx`.

### P07-04 Empty states audit

- **Description:** Every list or screen that can be empty uses `EmptyState` with an appropriate Booky expression and a single clear action: Shelf, search no-matches, Loans (out / history), Groups, group detail, Series list, Genres, Authors, Scan review tray, Pending lookups. Add a `first-run` fixture.
- **Files:** screens listed; `src/testing/fixtures/firstRun.ts`.
- **Acceptance:** checklist in the PR with an auto test suite screenshot of each empty state (the `empty-states-gallery` journey).
- **Tests:** one component test per empty state (`src/__tests__/emptyStates.test.tsx`).

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
| `onboarding-first-run` | `core` | fixture `first-run`; 4 cards via next → start → lands on Scan; reload → no onboarding |
| `onboarding-skip` | `p07` | skip on card 1 → Shelf |
| `booky-help-each-tab` | `core` | for each tab: help button → bubble text non-empty → dismiss; a11y gate enforced with bubble open |
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
