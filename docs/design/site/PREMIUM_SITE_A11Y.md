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

_Filled in its phase._

## SIGNAGE

_Filled in its phase._

## WORLD

_Filled in its phase._

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
