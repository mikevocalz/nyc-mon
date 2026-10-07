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

### Critique

### Code review

### Perf

### Canon

## Phase 5

### Critique

### Code review

### Perf

### Canon

## Phase 6

### Critique

### Code review

### Perf

### Canon

## Phase 7

### Critique

### Code review

### Perf

### Canon
