# 0014. Warm paper palette with role-named tokens, and a labelled Booky

- Status: Accepted
- Date: 2026-09-25
- Supersedes: the palette and Booky's accessibility treatment in [0007](0007-purple-library-theme-and-booky.md)

## Context

[0007](0007-purple-library-theme-and-booky.md) planned lavender paper backgrounds, aubergine text `#2A2138`, a library brass colour, and Booky hidden from assistive tech as decoration. The design system as built in Phase 00 (P00-08, P00-10) chose differently on those points: a warm paper ground with plum and berry, colours named by role, and Booky exposed as a labelled image. Booky is the only illustration in the empty states and on the loading and not-found screens, where its expression (thinking, concerned) is part of what the screen says. The code is the source of truth, so this record adopts what was built.

## Decision

- **Palette:** warm paper grounds (`paper #FBF6EC`, `surface #FFFDF8`), deep ink text (`ink #271D38`, `inkMuted #4A3F5C`), the plum primary `#6B3FA8` from 0007, a berry accent (`#A8336B`), and success, warn and danger roles (danger keeps the stamp red `#B3261E`). No brass colour until the first brass motif needs one.
- **Role names:** components use role colours (`paper`, `surface`, `surfaceTint`, `ink`, `inkMuted`, `primary`/`onPrimary`, `…Container`/`on…Container`, `accent`, `success`, `warn`, `danger`, `border`, `outline`, `cardRule`, `booky*`) defined in `src/theme/tokens.ts`; a raw `palette` exists only to define them. Every text pair is listed in `textPairs` and tested for WCAG AA.
- **Booky** is an image with an accessible label that names its expression (`role="img"`, "Booky the bookmark, looking concerned"); the SVG artwork inside is hidden. Bubble text stays in a polite live region and never steals focus.

Everything else in 0007 (tokens mirrored as `--ms-*` CSS custom properties, the three typefaces, library motifs, Booky's personality, rules engine and modes) stands.

## Consequences

- `PLAN.md` §8 and §9 describe the delivered palette and roles; `src/theme/tokens.ts` is the source of truth for values.
- The Android adaptive icon background stays lavender (`#EDE4F7`) until the final icon work in P09-05.
- Each Booky in a screen adds one labelled image to the accessibility tree; screens avoid showing more than one Booky at a time.
