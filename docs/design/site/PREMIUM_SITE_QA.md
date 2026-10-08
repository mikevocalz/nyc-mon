# Premium site QA: W01 home

Per-phase blocks: critique, code review, perf, canon. Harness usage is in `tooling/site-qa/README.md`.

## Harness calibration

Run against the Phase 1 build (3f7ccfb) before any Phase 2 change. The harness reproduces the baseline within noise.


Target: the Phase 1 prod build served at http://localhost:3100 (unchanged; not restarted by this lane). Date 2026-10-07. Machine: Apple M3 Pro ×11, macOS (Darwin 27.0.0), Node 26.8.2. Other Phase 2 lanes were running on the same machine, so CPU load was not controlled (load average 2.6–6.0 at lhci start).

Browsers: Playwright chromium headless shell 153.0.8010.12 for shots, axe, copy-lint; system Chrome 154.0.8037.98 `--headless=new` for motion and lhci. Same split as Phase 1.

| Check | Phase 1 baseline (PREMIUM_SITE_BASELINE.md) | Harness result | Match? |
|---|---|---|---|
| lhci Performance (median of 5) | 76 | 74 (run A: 75) | Yes, within noise. Per-run 72–76 vs Phase 1's 73–77 range. |
| lhci LCP (median) | 5193 ms | 5799 ms (run A: 5433 ms) | Yes, within noise. Lantern lands on a few discrete values (5191, 5433, 5797/5799, one 7519 outlier); Phase 1 also had a 3.7 s outlier. Observed-trace subparts match: TTFB 7, load delay 3, load duration 4, render delay 65 ms (Phase 1: 9 / 3 / 3 / 66). |
| lhci A11y / BP / SEO | 100 / 100 / 100 | 100 / 100 / 100 | Yes |
| lhci CLS | 0 | 0 | Yes |
| lhci TBT (median) | 249 ms | 248 ms (run A: 242) | Yes |
| lhci FCP (median) | 996 ms | 989 ms | Yes |
| lhci LCP element | hero `img` midtown-chrysler-spire, fetchpriority high, eager | same element, same attributes | Yes |
| lhci verdict | fails Perf and LCP | exit 1: Perf 74 < 90, LCP 5799 ≥ 2500 | Yes |
| axe rules | 1 rule, color-contrast, every run | 1 rule, color-contrast, all 6 runs (390/768/1280 × both modes) | Yes |
| axe nodes | 1 node normal motion (Care `.text-orange-600`), 2 nodes reduced (+ DeviceStage figcaption) | 2 nodes in all 6 runs: `.text-orange-600` (care) and `figure[aria-label="H-Lynk device"] > figcaption` (hlynk) | Expected difference. Per-section scanning now catches the H-Lynk caption under normal motion, which closes the gap Phase 1 recorded ("whole-page scan misses opacity-0 content"). |
| copy-lint | Phase 1 copy lane: C1 eyebrow "The device" (`copy.ts:23`), C2 `aria-label="H-Lynk device"` (`DeviceStage.tsx:60`); no banned-list words | exit 1, 2 hits: hlynk text "The device", hlynk `@aria-label <figure>` "H-Lynk device"; 0 banned-list hits on `/` and `/get` | Yes |
| motion: non-canvas RAF loops while scrolling | 3 clocks: Lenis autoRaf, GSAP ticker, ScrollTrigger keep-alive | Lenis autoRaf + GSAP ticker counted as owners (2), ScrollTrigger keep-alive reported separately; 3 with `SITE_QA_COUNT_KEEPALIVE=1` | Yes. The harness does not count the keep-alive by default (see README: it runs whenever ScrollTrigger is registered and does no work). |
| motion: idle at top | 3 loops: keep-alive, Lenis, GpuCanvas | keep-alive, Lenis, GpuCanvas, plus the GSAP ticker still awake ~1–3 s after load (hero timeline) | Yes, with the ticker caught awake earlier in the window than Phase 1's 2.5 s wait. |
| motion: DeviceStage centred | 5 loops: + ThreeCanvas tick, + three `Animation` | keep-alive, Lenis, GpuCanvas, ThreeCanvas tick (2 canvases drawing), three `Animation` (canvas-idle) | Yes |
| motion: page bottom | keep-alive, Lenis, 2 GpuCanvas, three `Animation` | keep-alive, Lenis, GpuCanvas ×2, three `Animation` | Yes |
| motion: reduced motion | 1 loop (keep-alive) | keep-alive only, 0 owners, 0 canvas, every window | Yes |
| motion: max callbacks/frame | 8 scrolling, 6 DeviceStage | 8 scrolling, 6 DeviceStage, 6–7 bottom | Yes |
| ScrollTrigger count mount / away / back | 7/0/7 at 1280, 5/0/5 at 390, 0 reduced | 7/0/7 at 1280, 5/0/5 at 390, 0/0/0 reduced; back value reached after ~260 ms of polling | Yes |
| motion verdict | §10 "one RAF owner" fails today | exit 1: 2 owners (idle top, scrolling) and 2 drawing canvases (DeviceStage centred, bottom) at both widths, normal motion | Yes (expected to fail) |
| shots | 9 viewports × 2 modes, sections + full page 390/1440 | 18 runs, 149 files, overflow 0 px and 0 console errors everywhere | Not a Phase 1 metric; Phase 1 also reported 0 overflow. |

Raw output: `/Users/mikevocalz/nyc-mon/tooling/site-qa/out/{shots,axe,motion,lhci}/`.

## Phase 2

Foundation only; no section redesigned. Production build on `:3100`, M3 Pro, system Chrome.

| Check | Phase 1 | Phase 2 |
|---|---|---|
| `site-qa:motion` motion clocks | Lenis + GSAP ticker (fail) | GSAP ticker only (pass) |
| `site-qa:motion` live canvases, H-Lynk centred | 2 (fail) | 1 (pass): hero city pauses offscreen, divider is still, three's internal loop stopped |
| `site-qa:motion` ScrollTrigger mount/away/back | 7/0/7, 5/0/5 | 7/0/7, 5/0/5 |
| `site-qa:axe` (per section, 390/768/1280 × motion) | color-contrast, 2 nodes | 0 violations |
| `site-qa:copy-lint` | 2 hits ("The device", "H-Lynk device") | 0 |
| `site-qa:lhci` median Perf / LCP / CLS / TBT | 76 / 5193 ms / 0 / 249 ms | 76 / 5192 ms / 0 / 249 ms |
| Logo bytes (web) | 696,030 B PNG | 154,160 B WebP |

Perf and LCP are unchanged and still fail the targets. The LCP image is discovered and painted early (observed subparts: 8 ms TTFB, 64 ms render delay); the simulated 5.2 s comes from main-thread JS. Phase 3 moves the hero to server HTML, which is where that cost is.

### Critique

Not run: Phase 2 changes no composition. The selector now wraps instead of clipping; that is checked visually in Phase 3's screenshot pass.

### Code review

Run on this phase's diff after commit; findings land below.

### Perf

See table.

### Canon

`copy-lint` clean. "The device" eyebrow and the "H-Lynk device" figure label replaced per PS-004.

## Phase 3

Hero, signage and World redesigned. Production build on `:3100`, M3 Pro, system Chrome for motion and Lighthouse, Playwright chromium for shots and axe. Screenshots are under `tooling/site-qa/out/`: `phase3-before/` (the Phase 2 build) and `phase3-after/` (this build), named `<viewport>-<motion>-<section>.jpg`. The 9 viewports × 2 motion modes were all shot and inspected.

### Critique

**Before** (`phase3-before/1440-no-preference-hero.jpg`, `390-…-hero.jpg`, `844x390-…-hero.jpg`, `*-marquee.jpg`, `*-world.jpg`):
- Hero: a white card held five jobs (eyebrow, H1, body, CTA, starter names, district control) over a loud city scene, beside a framed photo with a sticker seal. At 390 the CTA sat below the fold. At 844×390 the first view showed only "EVERY BLOCK". The photo caption was 11px.
- Marquee: the H1 repeated six times right under itself, cut mid-word at 390, hidden from screen readers.
- World: a binary-contrast headline, four equal landmark photos with 01–04 numbers, and "its own weather" (no canon).

**After** (`phase3-after/…`):
- Hero, at 1440/1280/1728: the headline is two black signage plates set straight on the live city, staggered like route signs. It is the first read. The support line is on one concrete plate, followed by one orange CTA. The poster photograph with the seal stamped across its corner sits on the right. The header CTA is the same string in royal, so the hero CTA is the only orange action.
- Hero, at 1024: the caption first sat under the poster, and the seal covered it. Fixed by moving the caption to a plate pinned to the poster's top-right (`PlaceCaption`).
- Hero, first build:
  - The plate spans inherited the body face from the `Text` primitive, so the H1 rendered in Space Grotesk. Fixed with `font-display` on each plate.
  - At xl, "HAS A LEGEND." wrapped inside its plate at 5.5rem. Fixed by holding xl at `display-2xl` and giving copy 8 columns; the unused 5.5rem token was removed.
  - On phones, wrapped inline plates painted over the line above. Fixed with art-directed per-breakpoint breaks: four plates on phones, two from `md`.
- Hero, at 390/430: four plates, then support, CTA and the district control, all inside 844px (CTA bottom about 608px). The district control wraps to two rows, with "Mega City" alone on the second. That reads as deliberate but not elegant; the coordinator is changing `SegmentedControl`.
- Hero, at 844×390: a 7/5 grid, a 40px wordmark, and the short headline step. H1, support and CTA are all in the first view (CTA bottom about 375px). The seal is mostly below the fold here, which is acceptable at this height.
- Hero, at 768: the nav no longer collides with the wordmark (menu button below `lg`, PS-016).
- Signage: reads as a line map, with four stops on one route and each name large. Street annotations stay legible at 390. Nothing scrolls sideways. A first version's 4px disc ring made the line look broken on phones; it is now 2px.
- World: one dominant Harlem street photo, the story beside it, Wall Street under it, and captions as district plates. On phones it is photo, story, photo. At 768 the 5-column heading stacked four lines, so the heading steps up only from `lg`.
- Still missing: no creature appears anywhere. That is PS-007 (art pending), not something composition can fix.

**Five-second re-test** (self-test only, cold look at `phase3-after/1440-no-preference-hero.jpg` and `390-no-preference-hero.jpg`; no hallway participants yet):

| Question | Phase 1 | Phase 3 | Why |
|---|---|---|---|
| What is NYC-MON? | Inferable | Inferable, stronger | "Pick one of three eggs… look after your Mon" names the activity. No creature is visible yet |
| Why NYC? | Inferable | Obvious | Headline over a live street grid, a Midtown photo captioned with cross streets, then a district board directly below |
| What do I do with a Mon? | Missing | Inferable | Pick an egg, be there at the hatch, look after your Mon |
| What is H-Lynk? | Missing above the fold | Missing above the fold | Phase 4 |
| Why care now? | Missing | Missing | No status line in the hero. The waitlist section is Phase 6 |
| What's the one action? | Contested ("Log in" filled in the header; CTA below the fold at 390) | Obvious | One string, "Join the waitlist", in the header and hero, and above the fold at 390 and 844×390 |

### Code review

See the block below once the review lane returns.

### Perf

| Check | Phase 2 | Phase 3 |
|---|---|---|
| lhci median Perf / LCP / TBT / CLS (mobile, 5 runs) | 76 / 5192 ms / 249 ms / 0 | 76 / 5486 ms / 223 ms / 0 |
| lhci LCP element | hero `img` (Chrysler) | `p#mfx-hero-body` (support line; the photo is below the copy on phones) |
| lhci unused JS | 665 KiB | 565 KiB |
| lhci bootup | 1.3 s | 1.4 s |
| Home-route Viro/Rive chunk (`@acme/spatial` barrel) | 446,558 B on `/` | gone from `/` |
| GSAP chunk | 178,141 B | 173,531 B (magnets and hero drift removed) |
| `site-qa:motion` owners / live canvases | 1 / ≤1 | 1 / ≤1 |
| ScrollTrigger mount/away/back | 7/0/7, 5/0/5 | 6/0/6, 5/0/5 |
| axe | 0 | 0 |
| overflow / console errors (18 runs) | 0 / 0 | 0 / 0 |

The LCP subparts are 7 ms TTFB and 62 ms render delay. The simulated 5.5 s is Lantern's main-thread model, and the main thread on `/` is dominated by JS that ships on every route, not by the home sections. A static trace of the shared layout found three chains:
- `app/(site)/error.tsx` and `not-found.tsx` import `ErrorScreen` from the `@acme/app` barrel. That pulls in `features/editor`, which brings `react-native-enriched-html` (Tiptap/ProseMirror) and `react-native-gesture-handler`: 644 KB raw, 193 KB gz.
- `SiteFooter` → `RiverTide` → `SkiaWebGate` statically imports Skia's `LoadSkiaWeb` (CanvasKit loader).
- `SiteFooter` → `useAppForm` → `Switch` → `NeonSwitch` → `react-native-reanimated`.

The fixes are a deep import of `@acme/app/features/error/screen`, a lazy `LoadSkiaWeb` in `SkiaWebGate`, and lazy-loading the footer form. They touch files this phase doesn't own, so they're listed as open.

### Perf (shared-JS pass)

Environment: Next 16.3.8 (Turbopack) production build, `next start -p 3100`, Lighthouse via `pnpm site-qa:lhci` (mobile, simulated throttling, 150 ms RTT, 1.6 Mbps, 4x CPU, 5 runs, median), headless Chrome 154, benchmark index about 2650. First-load JS is every `/_next/static/chunks/*.js` referenced by the served HTML (gzip -9). Chains were traced from `next experimental-analyze -o` module graphs, not from guesses. Caveat: the home lane edited `components/home/*` (CareSection, StartersSection, device-scene, nextel-chirp removed) on the same tree between the "before" and "after" runs, so the Lighthouse deltas are not purely this pass. The chunk attribution below is.

| Measure (`/`) | Before | Barrels + 3 chains | Final |
|---|---|---|---|
| First-load JS raw / gzip | 3,587 / 1,079 KiB | 1,742 / 545 KiB | 1,386 / 445 KiB |
| `/get` first-load raw / gzip | 3,417 / 1,016 KiB | 1,553 / 474 KiB | 1,201 / 375 KiB |
| 404 first-load raw / gzip | 541 / 167 KiB | 541 / 166 KiB | 540 / 166 KiB |
| Script transfer (Lighthouse) | 1,054 KiB | 526 KiB | 528 KiB |
| Unused JS | 565 KiB | 135 KiB | 137 KiB |
| TBT | 231 ms | 102 ms | 80 ms (run 1: 792 ms) |
| LCP (simulated) | 5,802 ms | 5,502 ms | 4,738 ms |
| Perf | 74 | 79 | 81 |

Result: Perf 81 and LCP 4.7 s. The targets (Perf ≥ 90, LCP < 2.5 s) are not met.

What changed, all in the library where each chain starts:
- `packages/ui/package.json` and `packages/app/package.json` declare `sideEffects` (`./rn-globals-shim.ts` and `*.css` for ui, `*.css` for app). `optimizePackageImports` was not pruning either barrel under Turbopack: `SiteChrome` → `@acme/ui` index kept `DataTable` (TanStack Table), `form` (TanStack Form), `sonner`, `CityBlocks` and the rest on every route. This one change accounts for most of the 1,079 → 545 KiB drop.
- `error.tsx` / `not-found.tsx` deep-import `@acme/app/features/error/screen.tsx`, so neither boundary references the barrel that re-exports the schedule editor (Tiptap, ProseMirror, gesture handler, zod).
- `SkiaWebGate` imports `LoadSkiaWeb` on first use, so the CanvasKit glue loads only when a gated scene asks for Skia.
- `SiteFooter` loads its newsletter from a new `nav/SiteFooterNewsletter.tsx` through `React.lazy`. The site footer (`variant="columns"`) never renders it, so TanStack Form and `NeonSwitch` no longer ship.
- `gpu-store` imports `typegpu` after a WebGPU device exists. `GpuSetup` may now return a promise, and `QuadBackground` and `CityBlocks` load their `*.gpu.ts` scene modules through it. That keeps TypeGPU out of the footer's `RiverTide` path. Existing synchronous setups are unchanged.
- `Text` lazy-loads the `glitch` and `neonGlow` effects (the two Reanimated ones), with the plain styled text as the Suspense fallback. No page on the site uses either variant.

Verified causes still open, outside this pass's files:
- `components/home/CareSection.tsx` → `@acme/ui/progress` `ProgressBar` → `progress/motion.tsx` → `react-native-reanimated`. This is now the only Reanimated path on `/` (64 KiB transfer, 42 KiB of it unused). A web fork of `ProgressBar` using CSS transitions would drop it.
- HLynk's `DeviceStage` → `ThreeCanvas` pulls in a 100 KiB three + TypeGPU chunk at about 525 ms (after hydration). It is the likely source of the run-1 TBT outlier (792 ms).
- Lantern charges every request that starts before the observed LCP (78 ms unthrottled) to the simulated LCP. That includes two TTF fonts from `next/font/local` (40 + 63 KiB; WOFF2 would be roughly 40% smaller, in `app/fonts.ts`) and three hero images (108, 66 and 36 KiB webp).
- The floor is React DOM plus Next (bootup 539 ms on the framework chunk) and `react-native-web` (about 106 KiB compressed).

Gates on the final build: `site-qa:motion` pass, `site-qa:axe` no violations. `/`, `/get` and `/mons/hood-ratti` return 200 and render their h1 in Playwright with no console errors. `/nope-404` returns 404 with "Page not found" and "Back to Home". The error boundary compiles but was not exercised at runtime, because no route throws on demand. Typecheck passes for `@acme/ui`, `@acme/app`, `web` and `mobile`; `@acme/ui` tests pass 291/291.

### Canon

- `copy-lint`: 0 hits on `/` and `/get`.
- Strings changed:
  - H1 kept, now read from `HOME_COPY.tagline`, the single definition.
  - The support line is the decided Santoro line.
  - The eyebrow "A companion for the city" is gone, and so are the starter names in the hero.
  - World is now "New York is the world." The binary contrast and "its own weather" are removed (PS-006). The body reuses the canon line from W01/05-copy.
  - The footer and meta description now say "Mons live on New York's blocks, from Harlem to Downtown. Become a Caller and raise your own Mon." No creatures are called "NYC-MON", there's no "find them", and no headset.
  - The header CTA is `WAITLIST_CTA`, shared with the hero and hatch (PS-003).
- No pronoun is used for an individual Mon in new copy (PS-005).
- The district annotations are real cross streets of the bundled photographs. "Brooklyn Bridge, East River" for Mega City follows the photo map's `megacity` tag, not a canon statement about Mega City's location. Flag it if canon places Mega City elsewhere.

## Phase 4

H-LYNK redesigned. Audit findings answered: W2 (blue body), W5 (copy and bullets beside a demo, the shared split template), W6 ("The device" eyebrow, done in Phase 2 copy and kept), W7 (white box in the reduced-motion capture, grey plate while mounting), plus the §9 canon violations in the feature lines (Q42 tab labels, "twin-emitter", "calls them out"). Production build on `:3100`, M3 Pro. The Phase 5 agent builds into the same `.next` and serves `:3105`; `:3100` was restarted after each shared build. Shots: Playwright chromium; motion and mount: system Chrome 154 with WebGPU. After-shots and scripts are in `tooling/site-qa/out/phase4-after/` (ignored by git); Phase 1 shots are in `docs/design/site/baseline/`.

### Critique

**Before** (`baseline/1440-normal-hlynk.jpg`, `baseline/1440-reduced-hlynk.jpg`, `baseline/390-normal-hlynk.jpg`, and the same section on the Phase 3 build):
- The H-Lynk rendered blue while the copy said red (W2).
- The section was the page's generic split: eyebrow, title, a paragraph, three bulleted "features", a muted line, and a small dark plate on the right with the device at about a third of the width. At 390 the device came a full screen below the text.
- The feature bullets printed concept-sheet tab names (DEX, CREW, CARE, BAG, CITY) and invented "twin-emitter … calls them out". The 3D screen showed the sheet's HUD (stats, "CALL MON", a "WILD ENCOUNTER" duel) and the head printed "EngineX" (Q40).
- Under reduced motion the capture was a light square inside the night plate (W7).
- Motion: a scroll-scrubbed DOM tween rotated the plate while the canvas also animated, a continuous yaw swing, a pulsing beam with sparks, and a hidden push-to-talk chirp.

**After** (`phase4-after/<width>-<motion>-hlynk.jpg`):
- 1440 / 1280: the ink stage is the largest thing in the section (7 of 12 columns), the H-Lynk Core stands in it whole and red, matte, with the black head, the antenna and the red fan as the only coloured light. "H-LYNK CORE" at display size beside it, then "Your line to your Mon.", one paragraph, and the bond line. Under them, two proof rows: a crop of the scanner head and a crop of the control row, each with one sentence. The capture under reduced motion is the same pose, so both modes look identical once the intro ends.
- 1280 first pass: the stage box was capped at 34rem, so at 1280×800 the object ran below the fold. Now 28rem at `lg`, 32rem at `xl`.
- 390 / 430: object first, full width on ink, with the caption; then the name (two lines at 390, one at 430), then the proof rows stacked, crop beside text. No two-column grid.
- 768: single column, 24rem stage centred in a full-width ink plate; generous field either side.
- 844×390: the first pass put a 256px box and 48px plate padding on a 390px-tall screen, so the object was cut. Now an 11rem box with tighter section and plate padding; the whole H-Lynk fits under the header.
- Reduced motion, first pass: 1440 still showed the old blue capture. The PNG on disk was red; Next's image optimiser had cached the old one under the same URL. The capture is now `h-lynk-core-v2.png`, and HANDOFF says every new render gets a new name.
- Capture render, first pass: the black parts read grey (82,77,77) and the red clipped to (255,76,76). Root cause: node materials apply `envMapIntensity` only to `material.envMap`, so the scene-wide studio reflection hit every surface at full strength. The environment is now set per material; the body measures (198,51,51) and black parts 19–44.
- Still weak: the screen shows a starter's name with no creature art, so the "bond" is told, not shown; that waits on PS-007. The head crown's left end catches the key light as a pale step; it reads as moulding, not a defect.

**Five-second check** (self-test on `phase4-after/1440-no-preference-hlynk.jpg` and `390-…`, no hallway participants): "What is H-Lynk?" moves from "Missing" to "Obvious": a red handheld named H-Lynk Core, with a scanner on top and a screen showing your Mon.

### Code review

Self-review; no separate reviewer lane ran.
- `device-scene.ts` rewritten: 1,196 → 769 lines. No hex literals (grep); colours come from `hlynk`, `hud`, `led`, `palette`, `signage`. Removed the raycaster, the HUD hover/tab state, the sparks and the per-frame beam pulse, so `update` does no allocation and no raycast.
- Mount bug found and fixed during the work: the device group was hidden before `compileAsync` ran, so the first version compiled nothing. `compileAsync` collects only visible objects, synchronously before its first `await`; the group is now shown for that call and hidden after.
- `DeviceStage` state lives in a `useInstanceStore` (no `useState`). Scene callbacks reach it through memoised params, so the scene only calls them on transitions (ready once; rest on/off), never per frame.
- `testID` replaced a `data-capture` prop that RN-web dropped.
- `HLynkSection` reads the Baby name from `@acme/content` on the server; `copy.ts` stays free of `@acme/content` because a client island imports it.
- `art.ts` gained `hlynk.scanner` and `hlynk.controls`; `art.test.ts`'s slot list was updated to match.
- `nextel-chirp.ts` deleted. `react-native-audio-api` is still listed in `apps/web/package.json` and `next.config.ts`; nothing in `apps/web` imports it now. Removing it was left to the perf/config owner.
- Gates on the final build: `tsc` clean, eslint clean, 41/41 web tests, `site-qa:copy-lint` clean, `site-qa:axe` 0 violations, `site-qa:motion` pass, shots 0 overflow and 0 console errors at 390, 430, 768, 844×390, 1280, 1440 × both motion modes.

### Perf

DeviceStage mount, system Chrome, 3 runs per width, same method as Phase 1 (`lanes/baseline/measure-chrome.mjs`; times from the 600px near-viewport intersection):

| | Before (Phase 3 build) | After |
|---|---|---|
| Capture removed | 0–2ms, as soon as the canvas element exists (empty plate until the first frame) | 351–402ms, after the first full frame (fade over 400ms) |
| Long tasks during mount, 1280 | 180–185 + 119–126ms (+53) | 50–64 ×2–3 |
| Long tasks during mount, 390 | 175–182 + 122–129ms (+53) | 51–72 ×2–3 |
| Worst frame gap while scrolling through, 1280 / 390 | 300–317ms / 283–317ms | 50–67ms / 50–67ms |
| Mean fps while scrolling | 55.8–56.4 | 58.4–59.1 |

The Phase 1 3.77s stall at 1280 did not reproduce on the Phase 3 build in 6 runs, so this phase cannot claim it fixed it; the cause it was blamed on (pipeline compile on the first frame) now runs through `compileAsync`, off the frame path.

Where the time went before (CPU profile, 1280): `render` 324ms, of which node building and pipeline creation 139ms, PMREM `fromScene` 53ms. Now: build in one task, PMREM in a second, `compileAsync` yields per object.

Loops: `site-qa:motion` passes; with the stage centred and idle, `canvasActive` is 0 at 1280 and 390, because the scene pauses once at rest. GPU submits per second after scrolling the stage in: 141, 120, 100, 0, 0, 0; during one second of hover 162; one second after the pointer leaves and the tilt settles, 0 (`phase4-after/rest.mjs`). One RAF owner (GSAP ticker) throughout; ScrollTrigger count returns to its mount value after client navigation away and back (6 → 0 → 6 desktop, 5 → 0 → 5 mobile).

Asset bytes: `h-lynk-core-v2.png` 231KB (was 314KB, served through `next/image`), two crops 95KB and 86KB. Lighthouse was not run this phase (shared machine, concurrent builds).

### Canon

- Body red from `hlynk.core.body` (PS-002, Decision #16).
- Every physical fact in the copy and the proof rows is in Decision #16: black scanner head across the top edge, red emitters, a red fan of light upward, stub antenna top-left, tall screen in a dark bezel, home / menu / square red-ringed trackpad / back / forward, side keys and the left action key.
- Removed: the Q42 tab labels and "CALL MON", the invented stats and level, the "WILD ENCOUNTER" duel, the front "EngineX" print (Q40), and the front "H-Lynk Core" print (Decision #16 puts the tier name on the backplate). "The beam calls them out" is gone (no recruiting in Phase 1).
- The screen shows "H-Lynk Core", the slot-1 starter's Baby name from `@acme/content` (Squeaklet) and "Your Mon"; baby forms only.
- No pronoun for a Mon (PS-005). The bond line gives the bond to the Caller and the Mon (Decision #8). No visible "device" (`copy-lint` clean).

## Phase 5

STARTERS and CARE redesigned. Gate check: Phase 4 files were mid-edit during this phase (the shared tree failed `tsc` in `HLynkSection.tsx` for a while), so Phases 3–4 were not re-run through the full harness here. Audit findings answered: "starters text-heavy, no large art" (partly refuted; W3: street photos read as the Mon) and "care is three equal cards" (refuted as worded; W10: dashboard readout). Production build served on a private port (`:3105`) because other agents restarted `:3100` mid-run; system Chrome for motion, Playwright chromium for shots and axe. Private section shots (whole-section element shots and viewport shots) at 390, 430, 768, 844×390, 1280, 1440 × both motion modes: 24 per section, all looked at; 0 overflow, 0 page errors.

### Critique

**Before** (`out/shots/1440-no-preference-starters.jpg`, `*-care.jpg`, Phase 4 build):
- Starters: three framed 3:4 photos (Harlem stoops, Times Square, the bridge deck at night) with a Badge, the Baby name and two grey lines under each, plus a hover lift and zoom on cards that link nowhere. Under "Three eggs" the photos read as the eggs or the Mons. The night bridge photo broke the daylight rule. "Whoever's inside is their own person" used a pronoun for a Mon (PS-005).
- Care: a night "H-Lynk care readout" panel with three identical rows: verb, one line, a big segmented skyline and a printed percentage (70% / 45% / 85%). The page's loudest thing was the numbers. "How care works" / "The loop" / "Three meters, three things you do" read as a spec; "Your Mon tells you what it needs" used "it"; the closing line was the binary contrast "A relationship, not a streak."

**After** (private shots):
- Starters, 1280/1440: three posters in one row with equal weight, so the count reads at a glance. The art plate dominates each poster; a signage plate names the place ("Harlem, 125th St, Harlem"); under it the Dex plate, "Hatches from the Corner Egg", the Baby name large, and the Bloodline on a ruled line. Daylight photos only. The body names all three eggs from content. Personhood is stated about Mons in general ("Mons are people in this city. They think, they choose and they can say no.").
- Starters, 768 and 844×390: posters lie on their side (art the left half), stacked. First build put the art at 2/5 and stepped the name up to `display-lg`, which broke "SQUEAKLET" mid-word; art is now half and the name stays `display-md` until `xl`.
- Starters, 390/430: clean column, art first, 1:1 crops. The section is long (about 2,100px at 390), which is the cost of three large posters.
- Care, all widths: the verbs Feed / Rest / Play at display size carry the section. Each row says what your Mon does, then what you do, then shows a small 10-lot meter. No printed percentages; filled lots are solid and empty lots hollow. The closing line says the rule plainly. Daylight surface; night stays with the hatch.
- Care, 768 and 844×390: verb column was 5 of 12 and squeezed the text; now 4/5/3 at `md`, 5/4/3 from `lg`.
- Still missing: no creature, the same as World (PS-007). The starter photos are honest places, but a character introduction without the character is the weakest part of the page until renders land. The personhood line leaves "no." alone on its last line at 1280–1440 and 768.

**Hallway test should probe:** (1) After five seconds on STARTERS: how many eggs, and can they name one Bloodline? (Pass: "three" and one Bloodline name.) (2) Do they think the photos show the Mon? (Pass: they say "a street" or "where it lives".) (3) Do they expect to pick an egg on this page or in the app? (4) CARE: does it feel like a chore list or like looking after someone? Ask them to describe it in one word, and listen for "chores", "tracking", "streak". (5) Do they think the meters show their own Mon? (Pass: they noticed "example".) (6) Does "Your Mon asks. You answer." read as warm or as a command?

### Code review

Self-review (no separate reviewer lane ran): `starterCards()` now matches each egg to its Bloodline by `bloodlineId` instead of array index. `StarterId` stays the content slot union, and `art.ts` still `satisfies Record<ArtSlot, ArtEntry>`, so a fourth starter fails the build until it has art. No string literal from `@acme/content` appears in JSX. `CareMeter` replaces the kit `ProgressBar`: a static `role="meter"` div; `METER_FILL` `satisfies Record<CareItem['color'], string>`. The hover lift/zoom on non-interactive cards was removed. `apps/web` lint, `tsc` and 31 tests pass.

### Perf

`CareSection` imported `@acme/ui/progress` → `progress/motion.tsx` → Reanimated (coordinator finding). It now imports no client code. After the change the network log of `/` (1280, load plus scroll to the bottom) still shows two chunks containing Reanimated: `0fbbah967qzd6.js` (243,743 bytes, also referenced by `/get`, `/profile`, `/notifications`) and `3ui1-19ccjwos.js` (264,551 bytes, also contains CanvasKit). Neither comes from STARTERS or CARE; they look layout-level or from the Skia gate, which belong to the perf lane. Starter art `sizes` now match the layout (`(min-width: 64rem) 26rem, (min-width: 48rem) 50vw, 100vw`). Lighthouse was not run this phase (the machine was busy with other agents' builds).

### Canon

Checked against `packages/content` and the served HTML: Squeaklet / No. 002 / Hood Ratti Bloodline / Metro Egg; Kittee Cee / No. 009 / Bodega Baddiee Cee Bloodline / Corner Egg; Yotito / No. 062 / Yote Bloodline / Prism Egg. No Small, Mid or Max form name appears on `/` (scanned for all 12). Dr. Santoro presents the eggs (Decision #5); "at the hatch your Mon makes a choice too" (Decision #14). No pronoun for an individual Mon in STARTERS or CARE (PS-005). Care cues come from v7 (food requests, sleepy contentment, the approach / step-back cue) and v11 ¶51 (Energy, Fullness, Social). "Nothing is lost while you are away" rests on v7's "A low bar never causes permanent death, loss of a paid item or creature deletion" (`M7 L14633`) and Law 8. Out of scope but found: HATCH copy says "Then the Mon makes its choice. Its first look at you is how it says yes." (`copy.ts` `hatch.body2`), which breaks PS-005; that is Phase 6's block.

## Phase 6

HATCH, WAITLIST and FOOTER. Audit findings answered: W1 ("waitlist confirms signup and stores nothing", conversion risk 1), W5 ("hatch is text-led, no climax"), conversion risks 3 and 5 (no status line on home; no age posture), A11Y F10 (footer links 20px). Gate check: Phase 4 was still editing H-Lynk files during this phase, so Phases 3–5 were not re-run through the full harness here beyond what the page-wide checks below cover. Another agent rebuilt and served the shared `apps/web/.next` on `:3100` mid-phase, so this phase built a copy of `apps/web` (rsync to `.p6/web`, same depth, same `node_modules` links, removed afterwards) and served it on `:3106` (mock admin at `127.0.0.1:4806`) and `:3107` (`ADMIN_API_URL` empty). The shared `.next` was never touched.

Results on that build: `site-qa:copy-lint` clean (`/`, `/get`); `site-qa:axe` 0 violations (390/768/1280 × both motion modes, 9 sections); axe on the submitted invalid, error, under13, joined and rate_limited states 0 violations; `site-qa:motion` pass (owners ≤ 1, canvas loops 0 at the page bottom, ScrollTrigger returns to its count after nav). Section shots of hatch, waitlist and footer at 390, 430, 768, 844×390, 1280, 1440 × both modes: 36 shots, all looked at, 0 overflow, 0 page errors, every `mfx-hatch-*` at opacity 1 after settling. `apps/web` tsc, eslint and 41 tests pass; `packages/ui` tsc passes and lint has 0 errors. Lighthouse not run (machine shared with other agents' builds). Evidence: `shots/phase6/`.

Form states, Playwright against the mock (`/` and `/get`, 390 and 1280):

| State | Result | Focus after | `<output>` / field error |
|---|---|---|---|
| pending | "Joining…", button disabled, form `aria-busy=true` | — | — |
| joined | form replaced by "You're on the list." | the h3 | body as the h3's description |
| invalid | email kept, box kept, `aria-invalid=true` | email field | "Check the email address. …" via `aria-describedby` |
| under13 (mock 422, and an unticked box with `required` removed) | email cleared, box cleared | submit | "Nothing was saved. …" |
| rate_limited | email kept | submit | "Too many tries … an hour …" |
| error (mock 500, and `ADMIN_API_URL` unset on `:3107`) | email kept | submit | "We couldn't reach the waitlist just now. …"; server logged `ADMIN_API_URL is not set` |
| JS off | joined and invalid render from the server after a plain POST | — | — |

The mock received `{email, ageConfirmed, district: "midtown", source: "home" | "get", website: ""}`, matching `lib/waitlist.ts`.

### Critique

**Before** (Phase 5 build): HATCH was a 6/5 split, copy left and a framed bridge photo right, with its own `Join the waitlist` button. It used the same split as H-Lynk and Care (W5), so the page had no high point. `body2` said "its choice … how it says yes" (PS-005). `/get` showed "Sign-ups open soon"; the page had no working sign-up. The footer ran the river canvas under a form-free page end.

**After:**
- HATCH, 1280/1440: the largest section headline on the page over a full-width 21:9 window of the bridge at night; the window is the only full-width image on the page and the warm bridge lights are its only colour besides the orange line. Story and closing line underneath. Reads as the climax. At 390 the headline wraps to three lines ("Pick a time." / "The egg" / "waits.") without clipping; the 4:5 crop centres One World Trade over the bridge tower. 844×390: whole headline and the window top fit in the first view.
- WAITLIST: back on concrete, a plain split (headline left, form right from `md`; stacked on phones). Clearly quieter than HATCH: no image, no colour except the orange button. The form is four things: Email, Age, the button, one privacy line. 390/430: button full width, input 56px, nothing clipped; at 844×390 the headline sets on four lines next to the form, still no scroll inside the form.
- FOOTER: the static Harlem skyline over the keyline. It closes the page without movement.
- Weak spots: the hatch photo is still a city postcard; the climax is carried by type and scale until the egg art lands (PS-007). "Be there when it opens." at 768 breaks as "Be there when / it opens."

**Full-page rhythm** (1440 full page, reduced motion): hero (night city + poster) · signage board (night strip) · WORLD (daylight bento) · divider · H-LYNK (night, product split) · STARTERS (daylight triptych) · divider · CARE (daylight rows) · HATCH (night, single column) · WAITLIST (daylight split) · footer (night). No two adjacent sections share a card grid. Two breaks that belong to other phases: (1) H-LYNK is a night band too, so HATCH is not "the one night section"; it is the second, and the page's day/night alternation is hero-night, H-Lynk-night, hatch-night. The audit reserves night for the hatch (§10); report to the Phase 4 owner. (2) STARTERS → divider → CARE are both daylight with headlines in the same size and style; CARE's verb rows keep them apart, but the `DistrictDivider` strip between them is the only change of surface.

**Hallway test should probe** (added to `HALLWAY_TESTS.md` as D8–D10): what happens at the hatch (pass: pick a time, one notification, the Mon chooses too; log "timer", "countdown", "reject"); whether anything stopped them before joining, especially the age checkbox; what they expect after joining (pass: one email when it's out).

### Code review

Self-review with a security focus (no separate reviewer lane ran):
- No new trust: the client sends the same five fields; validation, honeypot, rate limit and the forward secret stay server-side in PS-001's handler and `lib/waitlist.ts`. `ADMIN_API_URL` and `WAITLIST_FORWARD_SECRET` are only read in the server module; nothing new is `NEXT_PUBLIC_`.
- The honeypot is off-screen with `aria-hidden`, `tabindex=-1`, `autocomplete=off`. A filled honeypot gets `joined`, so a bot learns nothing.
- The district field is client-controlled; `toWaitlistDistrict` drops anything outside the four districts. `source` is free text from a hidden field; the handler caps it (zod), and it's analytics only.
- `waitlistMessage` is an exhaustive switch over `WaitlistStatus`; the test file lists statuses through a `Record<WaitlistStatus, true>` so a new status fails the typecheck.
- No `useState` / `useReducer`; one `useEffect` moves focus per result. `/ui/html` web fork types widened (form attributes only, no behaviour change).
- `SiteFooter` now lazy-loads `RiverTide`; the `river-tide` path is unchanged apart from the Suspense boundary (fallback `null` inside `LazyScene`'s fixed-height box, so no shift).
- Not done: no component-level tests (the repo has no React test setup and this phase didn't add one); no e2e file was added to the repo; the Playwright state run lives in the scratchpad. A VoiceOver/NVDA pass is still owed.

### Perf

`/` loses the RiverTide canvas and its code from the footer path. The new client code is one small island (`WaitlistForm`: React hooks, `CornerCutFrame`, the html primitives and the district store, all already on the page through the hero). The hatch image stays `loading="lazy"`, `unoptimized` (1200×800 WebP, the only bundled night frame), shown at up to 1216×521 on desktop, a slight upscale, acceptable for a stand-in. Lighthouse was not run.

### Canon

15 / 30 / 60 minutes and one notification (V11 ¶49); the Mon chooses at the hatch and may need a moment, never rejects (Decision #14); no pronoun for a Mon on HATCH, WAITLIST or footer copy (PS-005; the old `body2` is gone); dark only in the hatch band in this phase's sections (Decision #4); no under-13 email kept, even in page state (ADR 0001, `actions.ts`). The footer description ("Mons live on New York's blocks…") was already fixed in Phase 3.

## Phase 7

Production build of 8d41ad9 on `:3100`, M3 Pro, system Chrome 154, Lighthouse 13.5.0 (simulated moto g power, 4x CPU). Machine load average ~16 during the Lighthouse runs.

### Before and after (vs PREMIUM_SITE_BASELINE.md, 3f7ccfb)

| Check | Baseline | Final |
|---|---|---|
| Lighthouse Perf (median of 5) | 76 | 90 |
| Lighthouse A11y / BP / SEO | 100 / 100 / 100 | 100 / 100 / 100 |
| LCP (simulated) | 5193 ms | 3540 ms |
| LCP element | hero Chrysler `<img>` | hero support paragraph `#mfx-hero-body` (paints ~74 ms unthrottled) |
| CLS | 0 | 0 |
| TBT | 249 ms | 84 ms |
| First-load JS on `/` (gzip) | 1,079 KiB at e40833d | 445 KiB at 65c2dd2; motion has since moved after paint |
| Motion clocks | Lenis + GSAP + ScrollTrigger (3–5 loops) | GSAP ticker only; ≤1 live canvas; 0 idle canvas loops |
| ScrollTrigger mount / away / back | 7/0/7 | 6/0/6 desktop, 5/0/5 mobile |
| axe (per section, 390/768/1280 × motion) | color-contrast, 2 nodes | 0 violations on `/` and `/get` |
| copy-lint | 2 hits | 0 |
| Back to `/` without WebGPU | not checked | 12/12 (`site-qa:backnav`) |
| Overflow / console errors, 9 viewports × 2 motion | 0 / 0 | 0 / 0 |
| Logo / wordmark bytes (web) | 696 KB PNG / 77 KB PNG | 154 KB WebP / 53 KB WebP |

LCP misses the 2.5 s target in simulation. The LCP paragraph paints within ~80 ms unthrottled; Lantern charges every request that starts before it (inline-CSS document, framework chunks, fonts, the hero photo), and the remaining floor is React DOM, Next and react-native-web. INP is not measurable in navigation mode.

### Critique

Scored campaign critique (review lane, e9012d5, before polish): first impression 8, NYC specificity 9, creature/relationship desire 5, H-Lynk desirability 7, starter desirability 5, emotional pacing 7, hierarchy 7, originality 7, typography 7, art direction 6, conversion 8, mobile 7. Polish (below) addressed typography widows, reveal timing, CTA colour, repeated eyebrows, the hero caption and the phone picker layout. Creature desire, starter desire and pacing stay below 8 until the Mon, egg and hatch art lands (PS-007): every image on the page is still NYC photography.

### Code review

Full diff `main..e9012d5`: approve, no CRITICAL or HIGH. Fixed: migration media columns now `IF NOT EXISTS` and untouched on rollback; one-time production error when `WAITLIST_FORWARD_SECRET` is unset; three `nodeFrame` rename warning; world drift through `gsap.matchMedia`. Deploy-checklist items: both apps behind Vercel's edge (the per-IP limit trusts the first `X-Forwarded-For` hop) and an optional global hourly ceiling.

A Back-navigation crash without WebGPU (P0 from the critique lane) was two use-after-free bugs: react-native-skia 3.0.2's web `SkiaView` kept a deleted picture (patched, `patches/react-native-skia@3.0.2.patch`) and `SkiaQuadCanvas` freed memoised vertices. Fixed in 45e6570.

### Perf

See the table. Self-hosted note: after the Lighthouse and screenshot load, `next start`'s image optimizer stopped answering one request (`downtown-nyse` at w=828) until restart; `sharp` itself encoded it in 56 ms. On Vercel the optimizer is a separate service.

### Canon

copy-lint clean. The canon lane's fixes landed in db113bc (no pronoun for an individual Mon on any route, no "Phase 1" in public copy, no species-note placeholder, no invented Mega City place, full name for Dr. Alessandra Santoro). Open for Mike: `/mons` shows Small, Mid and Max forms; `/story` timeline ("decades from now" vs "decades ago"); the "Hood means free-living" line; `/spatial` debug card and headset claim; legal "Last updated: 2026".

### Phase 7 polish

Build: working tree on `feat/premium-home-redesign` (db113bc + uncommitted polish), `NEXT_DIST_DIR=.next-b`, served on :3110. Shots in `tooling/site-qa/out/shots/<width>-<motion>-<section>.jpg`.

| Item | Before (critique / a11y lane) | After (:3110) |
|---|---|---|
| Widows | "ANSWER." alone (care), "no." alone (starters quote), "walk." alone (hero), "DR. / SANTORO'S" split | `main h1–h3 { text-wrap: balance }`, `main p { text-wrap: pretty }`; NBSP after "Dr." in `copy.ts`. Care title sets "YOUR MON ASKS. / YOU ANSWER." (`1440-no-preference-care.jpg`); starters title keeps "DR. SANTORO'S TABLE." on one line (`1280-no-preference-starters.jpg`); hero ends "you walk." (`1440-no-preference-hero.jpg`). The starters quote at 1280 now ends "say no.", two words, not one |
| Reveal timing | proof rows at 1100/1400 ms, triggers `top 70–80%` | every scroll beat starts ≤300 ms, all triggers `top 90%`. At 1440, 700 ms after scrolling each section to the top, H-Lynk proof rows and all three starters are at opacity 1.00 |
| Header CTA | royal face | orange CTA face with `on-cta` text via new `NavBar ctaTone` (default royal for other callers); stale "Log in" comment replaced |
| Eyebrows | 5 on the page, 3 repeating the headline | removed on H-Lynk, Care, Waitlist; kept on Starters and Hatch. Heading levels unchanged |
| Hero caption | "Midtown, …" with the Midtown disc next to the picker | "Chrysler Building, Lexington Ave at 42nd St", no disc (PS-026) |
| District radios <sm | 3 + 1 wrap | 2×2, each 159×44 at 390 (`390-no-preference-hero.jpg`); one row of four at ≥sm |
| Header skyline | on every width | hidden below `md` and at `short:`; header 94px at 390, 72px at 844×390, 114px at 1280 (`844x390-no-preference-hero.jpg`) |
| Footer at 1440 | content x=24 vs page x=112 | **not changed**: `SiteFooter` hard-codes `max-w-screen-2xl px-4 md:px-6` with no container prop. Needs a kit change |
| N1 hero loop | animates indefinitely | settles by ~5 s; a district pick replays ~1.5 s then holds (PS-027) |
| N2 hero region | unnamed region, dead `cityLabels` | `<section aria-labelledby="mfx-hero-title">` named "Every block has a legend."; `cityLabels` removed |
| N3 radiogroup | named only via fieldset/legend | no fieldset; `aria-labelledby="w01-district-label"` → "Pick a district" |
| N4 menu dot | "Home●" | dot `aria-hidden`; link name "Home" |
| N5 logo links | header "NYC-MON" › img › img, footer "NYC-MON home" | both "NYC-MON home", marks decorative (0 role=img inside) |
| N6 resize past lg | focus fell to BODY | focus goes to the logo link "NYC-MON home" |
| N7 waitlist errors | browser bubbles only | `noValidate`; empty → "Enter your email address.", `foo@` → "Check the email address…", no age → "Check the box to confirm you're 13 or older.", each `aria-invalid` + `aria-describedby`, focus on the first bad field. A valid submit clears them and reaches the server (no backend here: the `error` status line renders) |

Gates on :3110: web `typecheck` 0, eslint on source 0 (the package `lint` script also walks other agents' `.next-a`/`.next-perf` bundles and fails there), `test` 41/41, `site-qa:copy-lint` clean, `site-qa:axe` 0 violations on `/` (6 runs) and `/get`, `site-qa:motion` pass, `site-qa:shots` at 390/430/768/844x390/1280/1440 in both motion modes, 0 errors.
