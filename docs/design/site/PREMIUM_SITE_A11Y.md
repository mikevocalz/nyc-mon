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

## Final

Phase 7 a11y lane, WCAG 2.2 AA (contract §13, pack 07 §5). Target: the production build of e9012d5 served on http://localhost:3100, routes `/` and `/get`. This was an audit only. No repo files changed, and :3100 was not rebuilt or restarted. Date 2026-10-07. Engine: axe-core 4.11.0 on Playwright chromium 153.0.8010.12. File:line references are to e9012d5 (`git show HEAD:<path>`). The working tree has uncommitted edits to `NavBar.tsx`, `SiteChrome.tsx`, `HomeHero.tsx`, `HeroDistrictIsland.tsx` and `SegmentedControl.web.tsx`, and none of them are on :3100.
Evidence was kept outside the repo (Phase 7 scratch): `axe-home.{txt,json}`, `axe-get.{txt,json}`, `manual.mjs` → `manual.json` + `tabs.txt` + `aria-*.yml`, `manual2.mjs` → `manual2.json`, `sig.mjs`, `op.mjs`, `spacing-check.mjs`, and PNGs (`reflow-*`, `spacing-*`, `form-error-*`, `signage-1280.png`).

### axe-core (`pnpm site-qa:axe`, `SITE_QA_ROUTE=/get pnpm site-qa:axe`)

The harness scrolls each section into view, waits for its reveal to settle, scans that section, and finally scans the whole document once.

| Route | Width | Motion | Sections | Rules | Nodes | Unsettled |
|---|---|---|---|---|---|---|
| / | 390 | no-preference | 9 | 0 | 0 | signage |
| / | 390 | reduce | 9 | 0 | 0 | - |
| / | 768 | no-preference | 9 | 0 | 0 | - |
| / | 768 | reduce | 9 | 0 | 0 | - |
| / | 1280 | no-preference | 9 | 0 | 0 | signage |
| / | 1280 | reduce | 9 | 0 | 0 | - |
| /get | 390, 768, 1280 | both | 1 (footer) + document | 0 | 0 | - |

**0 violations in 12 runs.** The "signage" unsettled flag does not come from the signage board. A pixel diff (`sig.mjs`) shows the only changing pixels sit at y 114–440, which is the hero city canvas still in the viewport above the board. The board itself is static. The section was still scanned.

### Phase 1 findings re-checked

| ID | Criterion | Phase 1 | Now | Evidence |
|---|---|---|---|---|
| F1 | 1.4.10 | District selector clipped at 390/320 | **Resolved** | The radiogroup wraps (`flex-wrap`). At 390 it is 334px wide in a 358px parent, on two rows. At 320×800 and 320×256 every radio is inside 34–286px. `scrollWidth` equals the viewport at 320, 640×400 and 844×390. |
| F2 | 4.1.2 | tablist without tabpanels | **Resolved** | `role=radiogroup` / `radio` with `aria-checked`, roving tabindex (one stop). ArrowRight/Left/Up/Down move, select and wrap. Home/End work. Space/Enter keep the selection. Click selects. Tab leaves the group. See the new finding N3 on the group's name. |
| F3 | 1.4.3 | Care line 3.14:1 | **Resolved** | Now `text-orange-700`. axe is clean in all runs. |
| F4 | 1.4.3 | DeviceStage caption 3.46:1 | **Resolved** | `#mfx-hlynk-device` has `scheme-dark` (`HLynkSection.tsx:45`). axe is clean in reduce runs. |
| F5 | 2.4.11 | Sticky nav covers Shift+Tab focus | **Resolved** | `html { scroll-padding-top: calc(var(--spacing)*32) }` = 128px against a 114px header (`globals.css:22`). Forward and Shift+Tab paths at 390/768/1280 on both routes: 0% of any stop under the header, and no stop's centre covered. |
| F6 | 2.4.11 | Phone menu covers page focus; Escape lost focus | **Resolved** | While open, Tab/Shift+Tab cycle toggle → 5 links → CTA → toggle (`focus-cycle.ts`). Escape closes the menu and focus returns to "Open menu". Enter and Space open it. Closing with the toggle keeps focus on it. |
| F7 | 2.4.1 | Skip link didn't move focus | **Resolved** | `<main id="content" tabIndex={-1}>`. After the skip link, `activeElement` is MAIN and the next Tab reaches the first main control at every width. |
| F8 | 2.2.2 | Ambient canvases loop, no pause | **Partly resolved** | The footer is now static (identical hashes over 5.2s). The hero CityBlocks canvas still changes on every frame under normal motion (3 different hashes over 5.2s), and no pause control exists. It is still under N1. |
| F9 | 1.4.10/1.4.4 | Nav eats short viewports | **Mostly resolved** | The header drops to 92px at short heights (`short:`). It is 36% of 320×256 and 23% of 640×400, and it stays sticky. At 640×400, 320×256 and 844×390, no Tab or Shift+Tab stop is under it. |
| F10 | 2.5.8 | Footer links 20px tall | **Resolved for 2.5.8, below the 44 goal** | Now `min-h-11 md:min-h-6` (`SiteFooter.tsx:113`): 128×24 at ≥768 and 128×44 at 390. |
| F11 | 1.3.1 | Unnamed hero region + dead canvas label | **Open** | The ARIA tree still shows an unnamed `region` first in main, and `cityLabels` is still passed to an `aria-hidden` canvas. See N2. |
| F12 | 1.1.1 | Brand marks named repeatedly | **Partly resolved** | The hero seal is now `aria-hidden` (`HomeHero.tsx:93`). The header still reads link "NYC-MON" › img "NYC-MON" › img "NYC-MON". The footer reads link "NYC-MON home" › img › img. See N5. |

### New findings

| # | Criterion | Severity | Where (e9012d5) | Evidence | Fix |
|---|---|---|---|---|---|
| N1 | 2.2.2 Pause, Stop, Hide (A) | Medium | `apps/web/components/home/HeroDistrictIsland.tsx:31-51` (`HeroCity` → `CityBlocks`), `packages/ui/backgrounds/CityBlocks.shared.tsx` (`running: !reducedMotion`) | The hero city animates continuously for more than 5s beside the H1 and CTA, under normal motion. The only stop is the OS reduced-motion setting. It pauses off-screen but not on request. | Add a visible "Pause motion" toggle (Zustand + MMKV) that every scene reads together with `prefers-reduced-motion`. Or let the city settle to a still frame within 5s. |
| N2 | 1.3.1 / 4.1.2 (carried F11) | Low | `packages/ui/backgrounds/SceneSection.tsx:50` (no label prop), `apps/web/components/home/HomeHero.tsx:33` | `<section id="trg-hero">` is exposed as an unnamed region. `copy.cityLabel` never reaches the accessibility tree. | Give `SceneSection` an `aria-labelledby` prop and pass `mfx-hero-title`. Delete `cityLabels`, since the art map treats the scene as decorative. |
| N3 | 4.1.2 Name, Role, Value (A) | Low | `apps/web/components/home/HeroDistrictIsland.tsx:58-60`, `packages/ui/SegmentedControl.web.tsx:71` | `radiogroup` has no accessible name (ARIA 1.2 requires one). It sits inside `<fieldset>` "Pick a district", so the name is announced once, through the group. A naive fix (`aria-label` on the radiogroup) would announce it twice. | Drop the Fieldset/Legend. Render the label as text with an id and pass `aria-labelledby` to `SegmentedControl` (the prop already exists). |
| N4 | 2.5.3 Label in Name / 1.3.1 | Low | `packages/ui/nav/NavBar.tsx:350` | The current page in the phone menu is announced "Home●". The marker text is inside the link name, and `aria-current="page"` already carries the state. | `aria-hidden` on the `●` Text. |
| N5 | 1.1.1 / 3.2.4 Consistent Identification (AA) | Low | `apps/web/components/site/SiteChrome.tsx:11-20,32-38` (`navLink` drops `item.label`), `packages/ui/brand/BrandWordmark.tsx:20-23`, `BrandLogo.tsx:20` | Two links to `/` carry different names: header "NYC-MON" and footer "NYC-MON home". Each wraps a doubled `role=img` (RN-web `Image` emits a div[role=img] plus an inner img alt). | Pass `aria-label={item.label}` in `navLink`. Render the marks inside links as decorative (`alt=""`, no role). |
| N6 | 2.4.3 Focus Order (A) | Low | `packages/ui/nav/NavBar.tsx:221-240` | When the phone menu is open with focus in the sheet and the viewport is resized past `lg`, the sheet closes and focus falls to BODY, because the toggle it tries to return to is `display:none`. The next Tab lands on the hero CTA and skips the skip link and header nav. There is no trap. | When the breakpoint closes the sheet, focus the logo link, or the first visible header link, whenever the toggle has no client rects. |
| N7 | 3.3.1 Error Identification (A), 3.3.3 (AA) | Low | `apps/web/components/waitlist/WaitlistForm.tsx:149,175` (`required` with native validation) | Empty email, `foo@` and an unchecked age box are caught only by Chromium's validation bubble. Focus moves to the first invalid field and the message is read, but no persistent text or `aria-invalid` stays after the bubble closes. This passes 3.3.1 (the browser bubble identifies the error) but is fragile on mobile Safari and with magnifiers. | Add `noValidate` and run the same checks client-side through the existing `emailError` path, so every error renders as linked text with `aria-invalid`. |

### Manual checks that passed

- **Landmarks.** banner; nav "Primary" (≥lg only, collapsed below); main#content; named regions (Four districts, New York is the world., H-Lynk Core, Three eggs…, Your Mon asks…, Pick a time…, Get on the list…) plus the unnamed hero (N2); form "Join the waitlist"; contentinfo with navs "Explore" and "Get NYC-MON". `/get` has banner, main, region "Get NYC-MON", form and contentinfo. `lang="en"`. Titles are "NYC-MON | Every block has a legend." and "NYC-MON | Get NYC-MON".
- **Heading outline on `/`:** H1 Every block has a legend. › H2 Four districts › H2 New York is the world. › H2 H-Lynk Core (H3 Scanner head, H3 Control row) › H2 Three eggs on Dr. Santoro's table. (H3 Squeaklet, Kittee Cee, Yotito) › H2 Your Mon asks. You answer. (H3 Feed, Rest, Play) › H2 Pick a time. The egg waits. › H2 Get on the list before the first hatch. › H2 Explore › H2 Get NYC-MON. No skipped levels.
- **Heading outline on `/get`:** H1 Get NYC-MON › H2 Explore › H2 Get NYC-MON.
- **Keyboard path at 1280 on `/`:** Skip › logo › Home › The Story › The Mons › The City › How it works › Join the waitlist (nav) › Join the waitlist (hero) › district radio (one stop) › Email › 13+ checkbox › Join the waitlist (submit) › Privacy › footer logo › 9 footer links › wraps to the browser. At 390 and 768, "Open menu" replaces the nav links. On `/get`, the same path minus the hero and district. Nothing is unreachable and nothing traps. Shift+Tab gives the exact reverse.
- **2.4.7 and 1.4.11 focus ring.** Every stop matched `:focus-visible` and drew a box-shadow ring. The ring is royal-500 #0058F8: 3.63:1 on ink-950, 5.08:1 on bg #F3F4F4, 5.6:1 on white.
- **2.5.8 target size.** No target is under 24px anywhere. Under 44: the age checkbox is 24×24, and its label extends the hit area. The inline "Privacy" link is 49×24. Footer links are 128×24 at ≥768. Primary and custom controls meet 44: nav links 44, menu toggle 44×44, hero CTA 60–72, radios 44, email field 56, submit 60–64.
- **Alt text against the art map.** Hero and the World, Starters and Hatch photos carry descriptive alt text matching `@acme/assets/photos`. `hlynk.static`, `hlynk.scanner` and `hlynk.controls` are `alt=""` with the reasons recorded in `art.ts`. The figure "H-Lynk Core" is named by its caption. Canvases sit under `aria-hidden`. The two `opacity:0` brand `<img>` elements are RN-web's hidden twins under a background-image div, and the mark is visible.
- **Contrast.** axe is clean everywhere. All 7 axe "incomplete" nodes per width are the place captions over photos (hero, World ×2, Starters ×3, Hatch). They were measured from pixels with the text hidden: white on solid signage-black plates gives a worst case of 21:1. The waitlist error text #D50000 is 4.98:1 on #F3F4F4.
- **1.4.4 / 1.4.10 at 200% and 400%.** 320×800, 640×400, 320×256, 844×390 and 640×900 show no horizontal scroll, nothing off-canvas, and no clipped text.
- **1.4.12 text spacing.** With the WCAG overrides there is no horizontal scroll and no lost text. Two World figures report overflow, but it is the photo crop. Their captions stay inside (bottom 446/448px and 237/239px).
- **2.3.3 and reduced motion.** Under `reduce`, no running CSS or Web animations, the `lenis` and `motion-armed` classes are absent, there are 3 canvases instead of 4 (the DeviceStage scene does not start), and every section hashes identically over 5s. After a full scroll, no `mfx-`/`mpx-` target, heading, paragraph or content image sits below opacity 0.95 in either mode. Nothing flashes.
- **Waitlist states on `/get@390` and `/@1280`.** ADMIN_API_URL is unset on :3100, so every server answer is `error`.
  - Valid submit: "We couldn't reach the waitlist just now. Nothing you typed is lost, so try again in a moment." renders in the always-mounted `<output>` (implicit `role=status`, polite). A MutationObserver saw exactly one update. Focus returns to the submit button, which was disabled during the pending state, and the next Tab goes to Privacy. The email and checkbox keep their values, and the error uses text, not only colour.
  - Not verified: the `invalid` (field error + focus to email + `aria-describedby`) and `under13` (status message) server branches. With no backend, the action returns `error` before any validation (`lib/waitlist.ts:100-103`), so those branches need a run against admin-vite.

### Resolved after this audit (8d41ad9)

N1 (2.2.2): the hero city settles to a still frame within 5 s (PS-027). N2: the hero section is named by its headline. N3: the district radio group is named once by a visible label. N4: the current-page dot is `aria-hidden`. N5: both links to `/` are named "NYC-MON home" with decorative marks. N6: focus moves to the logo when a resize hides the open menu. N7: the waitlist form validates on submit with linked, focused error text. Re-checked on the polish build: axe 0 violations on `/` and `/get`, keyboard probe of the menu, resize focus and form. Still unverified: the server's own `invalid` and `under13` answers, which need admin-vite running.
