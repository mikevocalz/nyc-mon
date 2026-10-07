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

### Critique

### Code review

### Perf

### Canon

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
