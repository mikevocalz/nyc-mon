# site-qa

Browser checks for the marketing site. They run against a served build (`pnpm --filter web build && pnpm --filter web start -p 3100`, or any URL in `BASE`). Plain Node ESM, no build step. Results land in `tooling/site-qa/out/` (ignored by git).

| Script | What it does | Fails when |
|---|---|---|
| `pnpm site-qa:shots` | Screenshot matrix of `/`: every viewport in `config.json` (390, 430, 768, 884, 1024, 1280, 1440, 1728, 844×390) × `prefers-reduced-motion` {no-preference, reduce}. One viewport shot per section, full-page shots at 390 and 1440. Writes `out/shots/*.jpg` and `report.json` (horizontal overflow, console errors, sections whose reveal did not settle). | Only with `SITE_QA_STRICT=1`, on overflow or console errors. |
| `pnpm site-qa:axe` | axe-core with tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa at 390/768/1280 × both motion modes. Scans each section after scrolling it under the header and letting its reveal settle, then scans the whole document once. Prints a rule / impact / WCAG / section / target table; full output in `out/axe/axe.json`. | Any violation. |
| `pnpm site-qa:copy-lint` | Loads `/` and `/get` with JavaScript off and reads the server HTML: body text, `title`, meta description and OG/Twitter tags, and the `aria-label`, `alt`, `title`, `placeholder` attributes. Checks the contract §9 banned list (unlock, reimagine, seamless, next-generation, AI-powered, immersive experience, meet your new best friend, the future is here, elevate, supercharge, journey, with inflections). Inside the H-Lynk section (`config.json` `hlynkSelectors`) it also flags `device`/`devices` in text and attributes. | Any hit not in `copy-allowlist.json`, or no H-Lynk section found (exit 2). |
| `pnpm site-qa:motion` | RAF ownership and ScrollTrigger teardown. See below. | More than one non-canvas RAF owner in any window, more than one canvas loop drawing in any window, or the ScrollTrigger count not returning to its post-mount value after client nav away and back. |
| `pnpm site-qa:lhci` | Lighthouse 13.5.0, default mobile config (412×823, simulated slow 4G, RTT 150 ms, 4× CPU), 5 sequential runs. Prints each run, the median of every category and metric, the LCP element and its subparts, and the environment. Reports in `out/lhci/`. | Median below Perf 90, A11y 95, BP 95, SEO 95, or LCP ≥ 2500 ms, or CLS ≥ 0.05. |
| `pnpm site-qa:all` | shots, copy-lint, axe, motion in sequence. All four run even if one fails. Lighthouse is left out because it needs a quiet machine. | Any of the four failed. |

INP is not measured. Lighthouse navigation mode records no interactions. `apps/web/components/site/WebVitals.tsx` logs LCP, CLS and INP with attribution to the console in development once it is mounted.

## Environment

| Variable | Default | Effect |
|---|---|---|
| `BASE` | `http://localhost:3100` | Origin under test. |
| `SITE_QA_BROWSER` | per script | `system` = installed Chrome with the real GPU and WebGPU; `bundled` = Playwright's chromium headless shell (no WebGPU, SwiftShader WebGL). Every script defaults to `bundled`. On the dev Mac the installed Chrome's OpenXR runtime is the Meta XR Simulator, so `system` starts a Quest 3 simulator session; use it only on purpose. Falls back to bundled when no Chrome is found. |
| `CHROME_PATH` | auto | Chrome binary. Auto-detects `/Applications/Google Chrome.app` and `/usr/bin/google-chrome*`. |
| `SITE_QA_MOTION` | both | `no-preference` or `reduce` to run one motion mode. |
| `SITE_QA_VIEWPORTS` | all | Comma list of viewport names (shots) or widths (motion: `1280`, `390`). |
| `SITE_QA_ROUTE` | `/` | Route for shots, axe, lhci. |
| `SITE_QA_LH_RUNS` | 5 | Lighthouse run count. |
| `SITE_QA_COUNT_KEEPALIVE` | off | `1` counts ScrollTrigger's keep-alive loop as a RAF owner (see below). |
| `SITE_QA_STRICT` | off | `1` makes shots fail on overflow or console errors. |

Playwright's bundled browser must be installed once per machine: `pnpm exec playwright install chromium`.

## Sections

The scripts find sections in this order:

1. Every `[data-section]` element, in DOM order, named by the attribute value (`data-section="hlynk"`).
2. If the page has none, the `fallbackSections` list in `config.json`. Each entry has a name and selectors tried in order. An entry may set `textIncludes` to choose among matches (the marquee is found by its `✦` glyph).

Once the home sections carry `data-section`, the fallback list stops being used. `hlynkSelectors` in the same file controls which element copy-lint treats as the H-Lynk section.

A section counts as settled when the computed `opacity` and `transform` of every `revealSelector` element (default `[id^="mfx-"], [id^="mpx-"]`) hold still for 300 ms and every one in the viewport is at opacity 1. After 1.5 s a stable element below opacity 1 is accepted, because scroll-scrubbed elements can rest there (`#mfx-hlynk-scan` sits at 0.98). Sections that never settle within 4 s are listed in the `unsettled` column and the shot or scan goes ahead.

## Motion check

An init script wraps `window.requestAnimationFrame` before page code runs. Every executed callback is recorded under its frame timestamp, keyed by the scheduling site (first stack frame outside the wrapper) plus the first 120 characters of its source. While a callback runs, the wrapper also watches WebGL draw/clear calls, `GPUQueue.submit` and `GPUCanvasContext.getCurrentTexture`. A callback that triggers any of them is a canvas loop.

A key that runs in at least 30% of a window's frames, with at least 10 consecutive frames, is a loop. `instances` is the median count of callbacks per frame from that key, so two `GpuCanvas` instances sharing one call site count as 2. Loops are sorted into:

- `owner`: a non-canvas clock (Lenis `autoRaf`, the GSAP ticker, anything unrecognised). The check allows at most 1.
- `canvas`: issued GPU work in the window. The check allows at most 1.
- `canvas-idle`: three.js `WebGPURenderer`'s internal `Animation` loop (`this._requestId=this._context.requestAnimationFrame`). It draws nothing. It is reported and not counted.
- `keepalive`: ScrollTrigger's `_rafBugFix` (`gsap/ScrollTrigger.js:61`), which `ScrollTrigger.register` starts and which runs for the life of the page whenever ScrollTrigger is loaded. It does no work. Counting it would fail every page that uses ScrollTrigger, so it is reported and not counted unless `SITE_QA_COUNT_KEEPALIVE=1`.

Windows, at 1280×800 and 390×844 in both motion modes: idle at the top (3 s), scrolling (60 wheel events of 100 px, 60 ms apart, 5 s), idle with `[data-testid="w01-device-stage"]` centred (3 s), idle at the page bottom (3 s). Before each jump the script waits for `scrollY` to hold still for 500 ms, because Lenis keeps animating toward its own target after wheel input and would overwrite an instant `scrollTo`.

ScrollTrigger teardown: after load the count is polled until it holds for 1 s (8 s max). The script then clicks the first visible `a[href="/how-it-works"]` (client navigation; the init-script state surviving confirms the same document), polls for 0, clicks the first visible `a[href="/"]`, and polls up to 8 s for the post-mount value.

### `window.__nycmonMotion` contract

The app should expose this hook in development builds. When present, the motion check reads ScrollTrigger counts from it and asserts on its owner list in addition to the measured loops.

```ts
interface NycmonMotionHook {
  /** ScrollTrigger.getAll().length at call time. */
  scrollTriggers(): number;
  /** Names of the clocks currently driving motion or scroll on requestAnimationFrame,
   *  e.g. ['lenis'] or ['gsap.ticker']. Canvas render loops are excluded. Must have length ≤ 1. */
  rafOwners(): string[];
  /** Optional: names of canvas render loops currently running, e.g. ['DeviceStage']. */
  canvasLoops?(): string[];
}
declare global { interface Window { __nycmonMotion?: NycmonMotionHook } }
```

Set it once from the motion root (the component that owns Lenis and the GSAP ticker), only when `process.env.NODE_ENV !== 'production'` or behind an explicit QA flag, and delete it on unmount. The harness needs it on the build under test, so a QA flag that also works in `next start` builds is the more useful choice.

Without the hook, the script falls back to the Phase 1 method. It intercepts `/_next/static/chunks/*.js` in the test browser only and patches the chunk that contains ScrollTrigger (`X.getAll=function(){return Y.filter(function(t){return"ScrollSmoother"`) to expose `window.__siteQaST`, and the Lenis constructor (`this.options.autoRaf&&(this._rafId=requestAnimationFrame(this.raf))}destroy()`) to push instances onto `window.__siteQaLenis`. Both anchors are minified gsap 3.15.0 / lenis 1.3.26 output. If a bundler change breaks them, the run fails with "ScrollTrigger count unreadable", and the fix is to expose the hook.

## Copy allowlist

`copy-allowlist.json` waives canon exceptions. An entry waives a hit when `term` matches, `route` and `scope` (`page` or `hlynk`) match if given, and the 40-character snippet around the hit contains `context`. Each entry needs a `reason` that names the canon source.

Entry shape (the list starts empty):

```json
{ "term": "<banned term or device>", "route": "/", "scope": "page", "context": "<exact phrase around the hit>", "reason": "<canon doc and section>" }
```

## CI

CI runs `pnpm --filter web test` (unit tests) and nothing from this directory. The browser checks need a served build and, for motion and Lighthouse, a real GPU and a quiet machine, so they run locally and their results are recorded in `docs/design/site/PREMIUM_SITE_QA.md`.
