# Premium site accessibility: W01 home

WCAG 2.2 AA is the bar (https://www.w3.org/TR/WCAG22/). Phase 1 baseline findings are in `PREMIUM_SITE_AUDIT.md` §14.

## Page-level plan

- **Headings:** one `h1` in the hero; one `h2` per section; `h3` inside sections. No skipped levels.
- **Landmarks:** `header` (NavBar), `main` (`tabIndex={-1}`, skip-link target), `footer`. Sections are `section` elements named by their `h2` via `aria-labelledby`.
- **Skip link:** first focusable element; moves focus to `main`.
- **Focus:** visible ring from the `focus` token on every control; `scroll-padding-top` keeps focused targets clear of the sticky nav (2.4.11).
- **Reduced motion (2.3.3):** no smooth scroll, no parallax, no pinning; every reveal ends visible; canvases show a static frame or capture.
- **Targets (2.5.8):** 24px minimum everywhere; 44px for primary and custom controls.
- **Dragging (2.5.7):** nothing requires drag; the district selector is a radio group with arrow keys.
- **Alt ownership:** the art map (`art.ts`) owns alt text or the decorative reason for every image.

Template per section: criterion ID → check → result (pass/fail) → evidence → fix.

## HERO

| Criterion | Check | Result | Evidence | Fix |
|---|---|---|---|---|
| 1.3.1 Info and Relationships | One `h1`; its text is "Every block has a legend." even though it's split into plates (trailing spaces in the segments) | pass | server HTML h1 textContent read back after build | — |
| 1.1.1 Non-text Content | Photo alt from the art map; seal is `aria-hidden` (the wordmark in the header already names the brand); district discs `aria-hidden` | pass | `art.ts`, `HomeHero.tsx` | — |
| 1.4.3 Contrast (Minimum) | White on `signage-black` plates; `text-text` on `surface-raised`; `silver-100` legend on `ink-950` | pass | `site-qa:axe` 0 violations, 390/768/1280 × both modes | — |
| 1.4.10 Reflow | No horizontal overflow at 390, 430, 768, 884, 1024, 1280, 1440, 1728, 844×390 | pass | `site-qa:shots` overflowPx 0 everywhere | — |
| 2.4.3 Focus Order | Skip link → nav → CTA → district radios: DOM order matches visual order | pass | DOM order in `HomeHero.tsx` | — |
| 2.4.11 Focus Not Obscured (Minimum) | `scroll-padding-top` clears the sticky header; the phone menu traps focus only while it is rendered (PS-016) | pass | `globals.css`, `focus-cycle.test.ts` | — |
| 2.5.7 Dragging Movements | District change is a radio group: click or arrow keys, no drag | pass | PS-012 | — |
| 2.5.8 Target Size (Minimum) | CTA `size="lg"` and radios ≥ 44px tall | pass | screenshots | — |
| 2.3.3 Animation from Interactions | Reduced motion: no entrance, no Lenis, still canvas | pass | `site-qa:motion` reduce: 0 owners, 0 canvas | — |
| 4.1.2 Name, Role, Value | Radios named by the legend "Pick a district"; canvas labelled "<District> street grid, seen from above" | pass | `HeroDistrictIsland.tsx` | — |

## SIGNAGE

| Criterion | Check | Result | Evidence | Fix |
|---|---|---|---|---|
| 1.3.1 Info and Relationships | `section` named by its `h2` "Four districts"; the stops are a `ul`. The old marquee was `aria-hidden` | pass | `SignageBoard.tsx` | — |
| 1.4.1 Use of Color | The district colour is only a disc, and each stop has its name in text | pass | screenshots | — |
| 1.4.3 Contrast (Minimum) | `signage-white` names and `silver-200` streets on `signage-black` | pass | axe 0 violations | — |
| 1.4.10 Reflow | Vertical list on phones, no cut words at 390 (the marquee cut mid-word) | pass | `out/phase3-after/390-*-signage.jpg` | — |
| 2.3.3 Animation from Interactions | Nothing moves | pass | — | — |

## WORLD

| Criterion | Check | Result | Evidence | Fix |
|---|---|---|---|---|
| 1.3.2 Meaningful Sequence | DOM order photo → story → photo is the reading order at every width; the grid places but never reorders | pass | `WorldSection.tsx` | — |
| 1.1.1 Non-text Content | Both photos carry art-map alt; captions are `figcaption` text | pass | `art.ts` | — |
| 1.4.3 Contrast (Minimum) | Captions are white on `signage-black` plates, never on the photo; body text on the concrete surface | pass | axe 0 violations | — |
| 1.4.10 Reflow | Single column below 768, no overflow | pass | shots overflowPx 0 | — |
| 2.3.3 Animation from Interactions | Drift only at ≥768 with motion allowed; reduced shows the story without a reveal | pass | `motion.ts` DESKTOP gate; `site-qa:motion` reduce | — |
| 2.2.2 Pause, Stop, Hide | No auto-playing motion; drift follows scroll only | pass | — | — |

## H-LYNK

_Filled in its phase._

## STARTERS

_Filled in its phase._

## CARE

_Filled in its phase._

## HATCH

_Filled in its phase._

## WAITLIST

_Filled in its phase._

## FOOTER

_Filled in its phase._
