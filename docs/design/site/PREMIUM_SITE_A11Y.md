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

| Criterion | Check | Result | Evidence | Fix |
|---|---|---|---|---|
| 1.3.1 Info and Relationships | `section` labelled by the `h2` "H-Lynk Core"; proof rows are a `ul` of `li`, each with an `h3` | pass | `HLynkSection.tsx` | — |
| 1.3.2 Meaningful Sequence | DOM order stage → name → proof is the reading order; the `lg` grid places but never reorders | pass | `HLynkSection.tsx` | — |
| 1.1.1 Non-text Content | The stage is a `figure` named "H-Lynk Core" (PS-004) with a visible caption; the capture and the canvas are `aria-hidden`. The two crops are decorative with a stated reason, because the row text names the part | pass | `art.ts` `hlynk.*`, `DeviceStage.tsx` | — |
| 1.4.1 Use of Color | Red is the hardware's colour, never a carrier of meaning | pass | — | — |
| 1.4.3 Contrast (Minimum) | All text sits on the concrete surface; the caption is `text-text-muted` under `scheme-dark` on ink | pass | axe 0 violations at 390/768/1280 × both motion modes | — |
| 1.4.10 Reflow | One column below `lg`; no horizontal overflow at 390, 430, 768, 844×390, 1280, 1440 | pass | shots `overflowPx` 0 | — |
| 2.1.1 Keyboard / 2.4.3 Focus Order | The section renders no link, button, input or `tabindex`; the canvas takes no focus, so focus order around it is unchanged. A manual Tab pass was not run this phase | pass (markup) | `HLynkSection.tsx`, `DeviceStage.tsx` | — |
| 2.2.2 Pause, Stop, Hide | The intro plays once (≈2.4s) and stops; no looping motion | pass | GPU submits fall to 0/s after the intro (`phase4-after/rest.mjs`) | — |
| 2.3.3 Animation from Interactions | Pointer tilt ≤ 8° only with motion allowed; under reduced motion no canvas exists and the capture shows the rest pose | pass | `DeviceStage.tsx` `live`; `site-qa:motion` reduce: 0 canvas loops | — |
| 1.4.2 Audio Control | No sound. The push-to-talk chirp was removed (PS-019) | pass | `nextel-chirp.ts` deleted | — |
| Content not hidden behind motion | Without JS the copy is server HTML and visible; with motion the name block lands at 0.2s and both proof rows by 1.9s, once | pass | `motion.ts` `w01.hlynk.reveal`; reduced shots | — |
| 4.1.2 Name, Role, Value | No controls in the section; the old raycast HUD "buttons" (pointer-only) are gone | pass | `device-scene.ts` | — |

## STARTERS

| Criterion | Check | Result | Evidence | Fix |
|---|---|---|---|---|
| 1.3.1 Info and Relationships | `section` named by its h2; posters are a `ul` of three `li`, each an `article` named by its h3 (the Baby name); h2 → h3, no skipped level | pass | `StartersSection.tsx`; axe 0 | — |
| 1.3.2 Meaningful Sequence | DOM order is slot order (Squeaklet, Kittee Cee, Yotito) at every width; inside a poster: photo, place caption, Dex plate, egg line, name, Bloodline | pass | shots 390/768/1440 | — |
| 1.1.1 Non-text Content | Each photo has the art-map alt describing the street; nothing calls it the Mon; the place is also a `figcaption` | pass | `art.ts` `starter.*` | Final renders replace alt with a description of the Mon (HANDOFF) |
| 1.4.1 Use of Color | Bloodline, Dex number and egg are text; the district disc in the caption repeats the district name next to it | pass | — | — |
| 1.4.3 Contrast (Minimum) | Dex plate white on `ink-950` 20.3:1; egg line `text-secondary` on white 8.65:1; caption white on `signage-black` | pass | computed from `theme.css`; axe 0 | — |
| 1.4.10 Reflow | One column at 390/430; side-on posters at 768 and 844×390; no horizontal overflow at any shot width; Baby names stay whole at 768 (a first build broke "SQUEAKLE/T" at `display-lg`; fixed by keeping `display-md` until `xl`) | pass | private shots `overflow=0` ×12 | — |
| 1.4.13 / hover-only content | No hover state and no content that appears on hover or focus; nothing in a poster is focusable | pass | — | — |
| 2.3.3 Animation from Interactions | Entrance only (opacity + 24px rise, once); reduced motion renders final state | pass | `site-qa:motion` reduce rows; reduce shots settled | — |
| Slider keyboard path | Not applicable: no slider (PS-022) | n/a | — | — |

## CARE

| Criterion | Check | Result | Evidence | Fix |
|---|---|---|---|---|
| 1.3.1 Info and Relationships | h2, then a `ul` of three rows each with an h3 verb; "Your Mon:" / "You:" are bold text inside the sentence, not separate headings | pass | `CareSection.tsx`; axe 0 | — |
| 4.1.2 Name, Role, Value | Each meter is `role="meter"`, `aria-label="Fullness, example level"`, `aria-valuemin=0`, `aria-valuemax=100`, `aria-valuenow`, `aria-valuetext="70%"`; the visible meter name is `aria-hidden` so it is not read twice | pass | served HTML (three `div role="meter"` with all attributes) | — |
| 1.4.1 Use of Color | Filled lots are solid, empty lots are hollow outlines, so the level reads without colour; the meter name is text above each bar | pass | 1440/390 shots | — |
| 1.4.11 Non-text Contrast | Filled lots at the 700 step on the concrete surface: orange 5.1:1, royal 7.99:1, leaf 4.86:1; hollow outlines `ink-950` 18.4:1 | pass | computed from `theme.css` | — |
| 1.4.3 Contrast (Minimum) | Closing line `orange-700` on concrete 5.1:1 (large text); example note `text-muted` 5.33:1; answers `text-secondary` 7.85:1 | pass | computed; axe 0 | — |
| 2.3.3 / 2.2.2 | Meters are static server markup: no count-up, no pulse; the stage enters once; reduced motion shows final values at first paint | pass | `site-qa:motion`; reduce shots | — |
| 3.3.2 / honesty | Values are labelled "Example levels, not a live reading." in text and "example level" in each accessible name; the page reads no user state | pass | `copy.ts` | — |
| 2.5.8 Target Size | No interactive control in the section | n/a | — | — |

## HATCH

Server markup, no controls. Checked on the private Phase 6 build (`:3106`), axe at 390/768/1280 × both motion modes: 0 violations.

| Criterion | Check | Result | Evidence | Note |
|---|---|---|---|---|
| 1.1.1 Non-text Content | The window photo has the slot's alt ("The Brooklyn Bridge lit at night, …"); the caption names the place | Pass | `art.ts` `hatch`, served HTML | When the egg art lands its alt must describe the egg, not the city |
| 1.3.1 Info and Relationships | `section` labelled by the h2; the two title lines are spans inside one h2, read as "Pick a time. The egg waits." | Pass | DOM | — |
| 1.3.2 Meaningful Sequence | DOM order: headline, window, story, closing line; `md:flex-row-reverse` only moves the closing line visually | Pass | `HatchBand.tsx` | — |
| 1.4.3 Contrast | `ink-50` 19.1:1, `silver-300` 15.4:1, `orange-500` (large text) 7.8:1, all on `ink-950` | Pass | measured from `palette` | — |
| 1.4.10 Reflow | No horizontal scroll at 390, 430, 768, 844×390; the headline wraps to three lines at 390 and isn't clipped | Pass | `p6sec2/hatch-*` shots | — |
| 2.3.3 / reduced motion | One reveal (window, headline, closing line); under `reduce` all `mfx-hatch-*` are at opacity 1 from first paint; nothing loops or pulses | Pass | shot run reports opacity 1 for all three ids in both modes | — |

## WAITLIST

`WaitlistForm` on `/` (source `home`) and `/get` (source `get`). Every state exercised in Playwright against a mock of `POST /v1/waitlist` and once with `ADMIN_API_URL` unset; axe run on the submitted invalid, error, under13, joined and rate_limited states: 0 violations.

| Criterion | Check | Result | Evidence | Note |
|---|---|---|---|---|
| 1.3.1 Info and Relationships | Real `form` (accessible name "Join the waitlist"), `label for` on the email and the checkbox, `fieldset`/`legend` "Age" around the checkbox | Pass | served HTML | — |
| 1.3.5 Identify Input Purpose | `type=email autocomplete=email` | Pass | DOM | — |
| 1.4.3 Contrast | Labels `text` on `bg`; hint and privacy `text-secondary`; error `danger` 4.98:1 on concrete-50; joined rule `success` 4.86:1 | Pass | `contrast.ts` pairs; measured | — |
| 1.4.11 Non-text Contrast | Input border is `text` (signage black) 2px; error border `danger`; checkbox face `accent-orange-600` 3.15:1 on the page | Pass | measured | — |
| 2.1.1 Keyboard | Tab: email → checkbox → submit → Privacy link. The honeypot has `tabindex=-1` and `aria-hidden` | Pass | DOM | — |
| 2.4.3 Focus Order | joined: focus to the "You're on the list." h3; invalid: to the email field; under13 / rate_limited / error: back to the submit button (the disabled pending button had dropped it) | Pass | `document.activeElement` after each state, logged | — |
| 2.4.7 Focus Visible | 2px `focus` ring with 2px offset on the field, checkbox and button | Pass | shots | — |
| 2.5.8 Target Size | Input 56px tall, button ≥56px (full width under 640px), checkbox 24×24 with its label also clickable, Privacy link `min-h-6` | Pass | DOM | — |
| 3.3.1 Error Identification | Invalid: `aria-invalid=true`, red border, error text under the field and linked with `aria-describedby` | Pass | logged `aria-describedby` → "Check the email address. …" | — |
| 3.3.2 Labels or Instructions | Visible labels; no placeholder; the age hint sits under the checkbox and is its description | Pass | — | — |
| 3.3.3 Error Suggestion | "It should look like name@example.com." | Pass | — | — |
| 4.1.3 Status Messages | One polite `<output>`, always mounted, carries under13, rate_limited and error; pending is the button text plus `aria-busy` on the form; joined is announced by moving focus to the heading (with the body as its description) | Pass (automated) | logged `<output>` text per state | VoiceOver / NVDA pass still to run |
| Progressive enhancement | With JavaScript off the form posts and renders joined / invalid | Pass | Playwright `javaScriptEnabled: false` | — |
| COPPA posture | The checkbox is required; an under13 answer keeps no email, even in page state | Pass | `actions.ts` clears `email` on under13 | — |

## FOOTER

| Criterion | Check | Result | Evidence | Note |
|---|---|---|---|---|
| 2.5.8 Target Size (F10) | Footer links were 20px tall from `md`; now `md:min-h-6` (24px), `min-h-11` (44px) below | Fixed | `SiteFooter.tsx` link slot | — |
| 2.3.3 / motion | The scene is the static `SkylineBand`; no canvas, nothing moves. `site-qa:motion` idle-at-bottom: 0 canvas loops | Pass | motion run, both widths and modes | — |
| 1.3.1 | Each link column is a `nav` named by its h2 | Pass (unchanged) | — | — |
