# 0007. Purple library theme, design tokens and the Booky helper

- Status: Accepted
- Date: 2026-09-25

## Context

The owner wants a cute, extremely user-friendly app with a purple colour scheme that could plausibly be used by a library, and a Clippy-like helper. Helper characters are easily annoying and can harm accessibility if done carelessly.

## Decision

- **Design tokens** in `src/theme` (colours, typography, spacing, radii, motion), mirrored as `--ms-*` CSS custom properties on web. Components never hard-code visual values.
- **Palette:** lavender paper backgrounds, a primary purple `#6B3FA8`, deep aubergine text `#2A2138`, stamp red, library brass; every text pairing meets WCAG AA (values and ratios in `PLAN.md` §9).
- **Type:** Lora (serif headings), Nunito (rounded body), Courier Prime (typewriter details) via `@expo-google-fonts`.
- **Library motifs:** catalogue cards, book spines, due-date stamps, card pockets.
- **Booky:** a purple bookmark character (SVG, five expressions: happy, thinking, excited, sleepy, concerned) with a speech bubble, driven by a rules engine with frequency caps, per-tip muting and a Helpful/Quiet/Off mode. Booky is decorative for assistive tech; bubble text is announced politely and never steals focus; animations respect reduce-motion.

## Consequences

- A distinctive, consistent look that is cheap to adjust (change tokens, not components).
- Dark theme (Phase 09) is a second token set, not a rewrite.
- Booky needs careful copywriting and a small amount of state (seen/muted tips in `settings`).
- The auto-test-suite `a11y` gate enforces contrast and naming continuously, so the palette cannot quietly regress.
