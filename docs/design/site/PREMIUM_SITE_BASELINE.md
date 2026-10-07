# Premium site baseline (home, `/`)

- Commit: `3f7ccfb3d2d0993ff2de72427e0406546603c843` (branch `feat/premium-home-redesign`). The working tree had uncommitted edits under `packages/spatial/*` and `.env.example`; none of them are on the home route.
- Build: `apps/web/.next`, `BUILD_ID` `wk-MKM-2i6tpAzmwuvkcS`, built 2026-10-07 14:11. Served by `next start` on `http://localhost:3100`. Next 16.3.8 (Turbopack).
- Date: 2026-10-07
- Machine: Apple M3 Pro, `hw.model` Mac15,6, `uname -m` arm64, macOS (Darwin 27.0.0).
- Node: v26.8.2. Root `package.json` declares `engines.node` `>=24.15.0 <26`, so this Node is outside the declared range. It only ran the measurement tools; the server build is as given.
- Lighthouse 13.5.0 (`npx -y lighthouse@13.5.0`), Chrome 154.0.8037.98 (system Chrome, `--headless=new`).
- Playwright from `apps/storybook`. Its bundled browser is chromium headless shell 153.0.8010.12. That browser has no WebGPU adapter and renders WebGL on SwiftShader (software), so the DeviceStage, FPS and RAF numbers below come from system Chrome 154 `--headless=new` driven by Playwright (`executablePath`). In that browser WebGL is `ANGLE Metal Renderer: Apple M3 Pro` and the page got a WebGPU adapter. Numbers from the headless shell are listed only where they change the reading.
- Library versions on the home route: gsap 3.15.0, lenis 1.3.26, three 0.186.1, kinetrell 0.1.0-alpha.1 (GitHub tarball).
- The `:3100` server was restarted by the coordinator at 14:42:15 (same build). All five Lighthouse runs (14:20–14:21) and the two full Playwright passes (finished 14:37 and 14:39) completed before that, with no runtime errors and no failed requests. The short Playwright checks (network log, offscreen loops, scroll owners) were rerun after the restart at 14:43–14:44 and reproduced the earlier numbers.
- Other Phase 1 lanes (screenshots, axe) may have been using the machine at the same time. I did not control for that. The Lighthouse `benchmarkIndex` stayed between 2611 and 2690 across the five runs.

Scripts and raw output (not in the repo): `/private/tmp/claude-501/-Users-mikevocalz/86d57c4b-87f4-45d6-a29b-1bea6fba3723/scratchpad/lanes/baseline/` (`lh-1..5.json`, `lh-summary.mjs`, `measure.mjs`, `measure-chrome.mjs`, `measure-chrome.json`, `measure-swiftshader.json`, `scrollowners.mjs`, `offscreen.mjs`, `net.mjs`, `bytes.mjs`).

---

## 1. Lighthouse, mobile

Method: `lighthouse http://localhost:3100/ --chrome-path=<system Chrome> --chrome-flags="--headless=new --no-first-run" --output=json`, five sequential runs, default config. That means form factor `mobile`, screen 412×823 at DPR 1.75, `throttlingMethod: simulate` (Lantern), RTT 150 ms, 1638.4 Kbps down, 4× CPU slowdown, emulated UA "moto g power (2022)".

| Run | Perf | A11y | BP | SEO | FCP ms | LCP ms | CLS | TBT ms | SI ms | TTI ms |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 75 | 100 | 100 | 100 | 996 | 5197 | 0 | 259 | 2859 | 11282 |
| 2 | 81 | 100 | 100 | 100 | 996 | 3729 | 0 | 348 | 2629 | 10985 |
| 3 | 76 | 100 | 100 | 100 | 990 | 5264 | 0 | 238 | 2613 | 11181 |
| 4 | 76 | 100 | 100 | 100 | 995 | 5193 | 0 | 243 | 2613 | 11106 |
| 5 | 76 | 100 | 100 | 100 | 998 | 5193 | 0 | 249 | 2608 | 11199 |
| **Median** | **76** | **100** | **100** | **100** | **996** | **5193** | **0** | **249** | **2613** | **11181** |

Against the §11 targets (Perf ≥ 90, A11y ≥ 95, BP ≥ 95, SEO ≥ 95, LCP < 2.5 s, CLS < 0.05, INP < 200 ms): Performance and LCP fail; Accessibility, Best Practices, SEO and CLS pass. Best Practices shows `valid-source-maps` as score 0 in all runs, but that audit carries no weight in the category, which still scores 100.

**INP: not measured.** Lighthouse navigation mode records no user interactions, so it cannot report INP (`interaction-to-next-paint` is absent from all five reports). TBT (median 249 ms) and Max Potential FID (379 ms, run 4) are the lab proxies. INP needs a timespan run with scripted interactions or field data.

**LCP element (identical in all five runs):** the hero art image, `MAIN > … > SECTION > … > FIGURE > DIV > DIV > DIV > IMG`, alt "The Chrysler Building's stainless steel crown of stacked arches and triang…", `src=/_next/static/media/midtown-chrysler-spire.1z9n0o79e73uh.webp` (37,220 bytes transferred), `fetchpriority="high"`, `loading="eager"`, `data-nimg="fill"`, rendered at 370×228 CSS px at top 164. Lighthouse's discovery checklist passes all three items (priority hinted, discoverable in the initial document, not lazy).

LCP breakdown, observed (unthrottled) trace, run 4: TTFB 9 ms, resource load delay 3 ms, resource load duration 3 ms, element render delay 66 ms. Observed LCP in the unthrottled trace was 79–92 ms across the runs. The 5.2 s figure is Lantern's simulated LCP: under 4× CPU and slow-4G it puts the paint behind the main-thread work, which is dominated by JS. That makes the LCP problem a JS cost problem; the image is already prioritised correctly.

Supporting diagnostics (run 4, the median-LCP run):

| Audit | Value |
|---|---|
| Total byte weight | 2,549 KiB |
| JS bootup time | 1.4 s (`2s8sm1ng5bcpd.js` 961 ms total / 883 ms scripting; `1z7ps_b2hysee.js` 340 ms; `10p4mdo_6i6_p.js` 222 ms) |
| Main-thread work | 2.2 s |
| Unused JS (est. savings) | 664 KiB |
| Long tasks | 6; the longest is 379 ms at 12.2 s in `2s8sm1ng5bcpd.js` |
| Max potential FID | 379 ms |
| Server response time | 10 ms |
| Largest single transfer | `nyc-mon-logo-640.2u64i37pk4-8e.png`, 696,331 bytes |

Run 2 is an outlier on LCP (3.7 s). It is kept in the table; the median is unaffected.

---

## 2. RAF owners on home

### Method

A Playwright `addInitScript` wraps `window.requestAnimationFrame` before any page script runs. Each callback function gets an id the first time it is scheduled, along with the first stack frame of the scheduling site (chunk file and column) and the first 90 characters of its source. Each executed callback is recorded under the frame timestamp it receives, so every frame has a set of callback ids. A "persistent loop" is an id that ran in at least 90% of the frames in the window. Windows were 2.5–3 s idle, or 5 s during a scripted wheel scroll (60 wheel events of 100 px, 60 ms apart). Loop identity rests on function identity: every loop here reschedules the same function each frame (verified from the chunk source below), so one id is one loop.

Two internals are not reachable from `window`. GSAP 3.15 installs its globals into a private `_installScope` object, so `window.gsap` and `gsap.core.globals()` do not exist on the page. Lenis exposes no instance list. To read them, the harness intercepted `/_next/static/chunks/1z7ps_b2hysee.js` with `page.route` and patched the response in the test browser only. It inserted `window.__ST=oY` before ScrollTrigger's `getAll` definition and pushed each Lenis instance onto `window.__lenisList` inside the Lenis constructor. Both anchor strings occur once in that chunk. No repo file was changed.

### Loops identified (chunk source checked for each)

| Site | What it is |
|---|---|
| `1z7ps_b2hysee.js:1:133010` `function t(){return sg&&requestAnimationFrame(t)}` | ScrollTrigger's module-level keep-alive loop, started when the plugin registers (`sg=1`). It runs on every route once the chunk has loaded, under reduced motion too. |
| `1z7ps_b2hysee.js:1:14881` (`new p`, `this.animate.advance(...)`) | Lenis 1.3.26 `autoRaf` loop (`this.options.autoRaf&&(this._rafId=requestAnimationFrame(this.raf))`). `MotionRoot` mounts `<ReactLenis root options={{ autoRaf: true }}>`. |
| `1z7ps_b2hysee.js:1:42048` `function t(e){var r,i,n,s,o=E()-A…` | GSAP ticker (`gsap.ticker` tick). It sleeps when idle and wakes during scroll and scrub. |
| `10p4mdo_6i6_p.js:1:164701` `()=>{E(),t=requestAnimationFrame(r)}` | `@acme/ui` `GpuCanvas` frame loop (the hero CityBlocks background in `HomeHero.tsx`; a second instance appears near the page bottom). |
| `3zq5xg__7325s.js:124:536840` `()=>{J(),t=requestAnimationFrame(i)}` | `ThreeCanvas` tick (`packages/ui/three/ThreeCanvas.tsx:236`), the DeviceStage loop. |
| `2t459hzzxtmjw.js:7:127235` `this._requestId=this._context.requestAnimationFrame(e)` | three.js 0.186 `WebGPURenderer` internal `Animation` loop, started by `renderer.init()`. It runs whether or not `setAnimationLoop` is set. |

`kinetrell/web/gsap-lenis` `connectGsapLenis` with `clock: 'external'` (`node_modules/kinetrell/dist/web/gsap-lenis.mjs`) subscribes `ScrollTrigger.update` to Lenis scroll events and does not add `lenis.raf` to `gsap.ticker`. With `autoRaf: true`, Lenis therefore runs its own loop, and the GSAP ticker runs its own loop whenever GSAP is awake. Those are separate clocks.

### Results (system Chrome, hardware GPU)

| State | 1280×800 persistent loops | 390×844 persistent loops | Max callbacks in one frame |
|---|---|---|---|
| Idle at top, normal motion | 3: ScrollTrigger keep-alive, Lenis, GpuCanvas | 3 (same) | 5 / 4 |
| Idle, DeviceStage centred | 5: + ThreeCanvas tick, + three `Animation` | 5 (same) | 6 / 6 |
| Wheel scroll from top, 5 s | Lenis, ScrollTrigger keep-alive, GpuCanvas in every frame; GSAP ticker in 260 of 272 frames; ThreeCanvas and three `Animation` once DeviceStage is near | same; GSAP ticker 237 of 275 | 8 / 8 |
| Page bottom, DeviceStage offscreen | ScrollTrigger keep-alive, Lenis, two GpuCanvas loops, three `Animation`. The ThreeCanvas tick has stopped. | not run | 6 |
| `/how-it-works` after client nav | 1: ScrollTrigger keep-alive | 1 | 2 |
| Reduced motion, any position | 1: ScrollTrigger keep-alive | 1 | 2 |

Reading:

- During scroll the home page runs **three independent frame clocks for motion and scroll**: Lenis `autoRaf`, the GSAP ticker, and ScrollTrigger's keep-alive. The §10 law ("one RAF owner") fails today. A dev assertion that counts tickers and fails on more than 1 would fail on this build.
- Canvas loops add to that. In the worst observed frame, 8 callbacks ran.
- Offscreen, `DeviceStage` pauses its own tick (`paused={!isVisible}` works). The three.js `WebGPURenderer` `Animation` loop keeps running for the rest of the page's life. It does no drawing, but it is a live RAF loop. This is the observed behaviour of three 0.186's `Animation` class with no animation loop set.
- 4 `<canvas>` elements are in the DOM at the page bottom.
- Confidence: high for the loop identities (stack site plus source text, matched against chunk source). The GpuCanvas-to-component mapping (hero CityBlocks and a second instance near the bottom) is medium: it rests on the `queued`/frame-loop source shape shared with `packages/ui/gpu/GpuCanvas.tsx` and on which sections were on screen. I did not trace which component owns the second instance.

---

## 3. `ScrollTrigger.getAll().length`

Method: the patched chunk exposes ScrollTrigger as `window.__ST` (see §2). Count read 2.5 s after `networkidle` on a fresh load. The harness then clicks the first visible `a[href="/how-it-works"]` (client navigation, same document; confirmed by the init-script globals surviving), waits 2 s and counts, then clicks the first visible `a[href="/"]`, waits 2.5 s and counts. Last step: `history.back()` to `/how-it-works` and `history.forward()` to `/`, then count again.

| Step | 1280 normal | 390 normal | 1280 reduced | 390 reduced |
|---|---|---|---|---|
| After mount | 7 | 5 | 0 | 0 |
| On `/how-it-works` (client nav) | 0 | 0 | 0 | 0 |
| Back on `/` via link | 7 | 5 | 0 | 0 |
| Back/forward via history | 7 | 5 | 0 | 0 |

The difference between 7 and 5 comes from `motion.ts`: `heroDrift` and `worldDrift` only attach at `(min-width: 768px)`. On this build the count returns to 0 on route away and to the same value on return, which meets the teardown requirement in §10.

Lenis: one instance is constructed per home mount (`window.__lenisList` grew 1 → 2 → 3 across mount, link return and history return), and the Lenis RAF loop is absent on `/how-it-works`. Under reduced motion one Lenis instance is still constructed on first load and torn down before the first measurement. No Lenis loop runs afterwards, and the `useBrowserReducedMotion` path renders without `ReactLenis`. My instance-level "destroyed" check read the `lenis` class on `<html>`, which every instance shares, so it cannot tell instances apart. I am not reporting per-instance destruction. Absence of the Lenis loop on other routes is the evidence for teardown.

Caveat: in the SwiftShader (headless shell) pass, the link-return count read 0 at the 2.5 s mark, while history return read 7/5. That pass had 5.0–5.3 s long tasks from DeviceStage on the software GPU, so motion had probably not re-armed when the count was read. I did not prove this. The Phase 2 harness should poll for the count instead of reading after a fixed wait.

---

## 4. DeviceStage mount cost and scroll FPS

Component: `apps/web/components/DeviceStage.tsx` → `ThreeCanvas` (`packages/ui/three/ThreeCanvas.tsx`) → `WebGPURenderer` (`packages/ui/three/surface.web.tsx`). The canvas mounts when the stage comes within 600 px of the viewport (`useInView({ nearMarginPx: 600 })`), so the canvas is created before the section is visible.

Method: the same init script wraps `HTMLCanvasElement.prototype.getContext` (records the context type requested by the `data-three-surface` canvas), wraps `WebGL2RenderingContext` draw calls and `GPUQueue.prototype.submit` (first call after the context exists = first canvas frame), and registers a buffered `PerformanceObserver({type:'longtask'})`. Two IntersectionObservers on `[data-testid="w01-device-stage"]` record "near" (600 px root margin, matching the component's trigger) and "enter" (threshold 0, real viewport). A MutationObserver records canvas insertion. Scroll script: jump to two viewports above the stage, start a recording RAF loop, then send `mouse.wheel(0,100)` every 40 ms for three viewport heights, then wait 1.5 s. FPS is frames over the recorded span. Frame intervals give p50, p95, max and counts over 33 ms and 50 ms.

### Renderer path actually used

| Browser | Context created | GPU |
|---|---|---|
| System Chrome 154 `--headless=new` | `webgpu` | WebGPU adapter present; WebGL would be ANGLE Metal, Apple M3 Pro |
| Playwright headless shell 153 | `webgl2` (fallback) | no WebGPU adapter; ANGLE on SwiftShader (software) |

### Mount cost (system Chrome, WebGPU)

Times are `performance.now()` ms from navigation start. The scroll start time depends on the script, so the deltas are what matter.

| Viewport | Near (600 px) | Canvas inserted | Context | First frame | Near → first frame | Enter viewport | Long tasks near → first frame + 1 s |
|---|---|---|---|---|---|---|---|
| 1280×800 | 7924 | 7924 | 8417 | 8419 | **495 ms** | 12540 | 266 ms, 148 ms |
| 390×844 | 7834 | 7836 | 8287 | 8290 | **456 ms** | 8635 | 211 ms, 160 ms |

The first frame lands before the stage enters the viewport at both widths. "Section entering viewport → first frame" is therefore negative: −4.1 s at 1280 and −345 ms at 390. The 1280 gap between near and enter is long because the scripted scroll stalled (see the FPS table).

Software GPU (headless shell, WebGL2 on SwiftShader), for contrast: near → first frame 173 ms (1280) and 135 ms (390), followed by a single long task of **5,341 ms** (1280) and **5,021 ms** (390) right after the first frame. At 1280, a run of 70–100 ms long tasks continued for about 3 s after the stage entered. Those numbers describe a machine without GPU acceleration, which is the worst case for low-end or blocklisted GPUs.

### Scroll FPS through the DeviceStage section

| Run | Frames | Span ms | FPS | p50 ms | p95 ms | Max ms | > 33 ms | > 50 ms |
|---|---|---|---|---|---|---|---|---|
| Chrome/WebGPU 1280 normal | 190 | 8316 | 22.7 | 16.7 | 16.8 | 3766.5 | 6 | 5 |
| Chrome/WebGPU 390 normal | 217 | 4066 | 53.1 | 16.7 | 16.8 | 366.7 | 3 | 2 |
| Chrome/WebGPU 1280 reduced | 163 | 2717 | 59.6 | 16.7 | 16.8 | 33.4 | 1 | 0 |
| Chrome/WebGPU 390 reduced | 171 | 2850 | 59.7 | 16.7 | 16.7 | 33.4 | 0 | 0 |
| SwiftShader 1280 normal | 136 | 11583 | 11.7 | 33.3 | 83.4 | 5533.1 | 58 | 38 |
| SwiftShader 390 normal | 193 | 9883 | 19.4 | 16.7 | 50.0 | 5216.4 | 37 | 8 |

Reading: with hardware WebGPU, steady-state frames are at 60 Hz (p95 16.8 ms). Mean FPS in the normal-motion runs is pulled down by one stall per run: 3.77 s at 1280 and 367 ms at 390. The stalls fall in the mount window, and only 266 + 148 ms (1280) and 211 + 160 ms (390) of main-thread long tasks were recorded there. Most of the 1280 stall is therefore not main-thread JS. WebGPU pipeline or shader compilation in the GPU process is the likely cause, but this harness did not trace the GPU process, so the cause is unconfirmed. A second scroll pass on an already-mounted stage recorded no frame over 50 ms at either width. Under reduced motion the static capture stays, no canvas or context is created, and scrolling holds 60 FPS.

Caveats: headless Chrome on an M3 Pro is not a phone. Wheel scrolling goes through Lenis smoothing, while touch scrolling stays native in the Lenis root config, so a touch device would follow a different input path. One run per cell.

---

## 5. Home route JS/CSS bytes

### From the build output

Method: `.next/build-manifest.json` `rootMainFiles` plus `.next/server/app/(site)/page_client-reference-manifest.js` `entryJSFiles["[project]/apps/web/app/(site)/page"]` and `entryCSSFiles`. Sizes are read from disk under `.next/static`. gzip is Node `zlib.gzipSync` at the default level; brotli is `zlib.brotliCompressSync` at the default level.

| Group | Files | Raw | gzip | brotli |
|---|---|---|---|---|
| Root main files (framework, runtime) | 6 | 441,313 | 131,448 | 112,428 |
| `(site)/page` entry chunks (layout + page) | 15 | 2,451,617 | 755,235 | 633,022 |
| **Home JS, manifest total** | 21 | **2,892,930** | **886,683** | **745,450** |
| CSS (`3k9apk8ru_80c.css` 115,477 + `2tdr-qp5bkzcu.css` 7,079) | 2 | 122,556 | 19,501 | 15,272 |
| Polyfill (`0cz1d0mv5g_q7.js`, `nomodule`, not loaded by Chrome) | 1 | 112,594 | 39,473 | 35,158 |

Both CSS files are marked `inlined: true` in the manifest and ship as `<style>` blocks in the HTML; no CSS file is requested over the network. The prerendered `index.html` is 406,851 bytes raw and 60,486 gzip, mostly that inlined CSS plus the RSC payload.

The largest page chunks are `3zq5xg__7325s.js` (679,193 raw / 223,231 gzip), `36ylip7ki6rck.js` (446,558 / 126,813), `135857yfgsgn-.js` (332,995 / 90,985), `2bieo-slvq4h_.js` (249,616 / 67,699) and `2s8sm1ng5bcpd.js` (root, 204,845 / 64,792).

### What the browser actually loads (network log)

Method: Playwright response log on system Chrome at 390×844. Phase "initial" runs to `networkidle` + 2 s; phase "scroll" covers 120 wheel steps of 150 px to the page bottom. The server sends `content-encoding: gzip`, and the wire column is Playwright `responseBodySize`.

| Phase | JS files | Raw | gzip (disk) | Wire |
|---|---|---|---|---|
| Initial load | 27 | 4,005,391 | 1,193,859 | 1,195,110 |
| Added during scroll | 6 | 1,204,494 | 325,216 | 325,676 |

The initial load includes all 21 manifest files plus 6 more, totalling 1,112,461 raw / 307,176 gzip. Five of those six are listed in the same client reference manifest under the `(site)/error`, `(site)/not-found` and builtin `not-found` boundaries: `16fd4cz10tb_4.js` 644,480, `12xvo_1rrk3uz.js` 408,798, `1x9iftoya-yaj.js` 22,109, `19c4ibno0z64i.js` 22,098, `2rsn5oaq9kveh.js` 14,711. The sixth, `3k2m9jqq1h_qn.js`, is 265 bytes. Error and not-found boundary chunks are fetched on a normal home load.

The scroll phase adds three.js: `2t459hzzxtmjw.js` 1,070,406 raw / 289,904 gzip, plus five smaller chunks (`1-uqqjh8wzckx.js` 79,763, `2ecjh2dezj3jk.js` 25,181, `0e4g5i3cxlwl_.js` 24,434, `11quvfwu_nn3b.js` 4,265, `0ps4vlibva57a.js` 445). DeviceStage's lazy boundary keeps three.js out of the initial load as designed.

---

## Accessibility (axe)

axe-core 4.11.0 (from the repo's pnpm store), run by Playwright against the same `:3100` build. Manual WCAG 2.2 findings are in `PREMIUM_SITE_AUDIT.md` §14.

Tags: wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa. Each run scrolled the full page in 400px steps so lazy sections mounted, then went back to the top before the scan. Viewport height was 900.

| Width | Motion | Violating rules | Violation nodes | Incomplete (needs review) |
|---|---|---|---|---|
| 390 | normal | 1 | 1 | color-contrast ×11 |
| 390 | reduced | 1 | 2 | color-contrast ×11 |
| 768 | normal | 1 | 1 | color-contrast ×10 |
| 768 | reduced | 1 | 2 | color-contrast ×10 |
| 1280 | normal | 1 | 1 | color-contrast ×6 |
| 1280 | reduced | 1 | 2 | color-contrast ×6 |

| Rule id | Impact | WCAG | Where | Nodes | Example target | Measured |
|---|---|---|---|---|---|---|
| color-contrast | serious | 1.4.3 | all 6 runs | 1 | `.text-orange-600` (Care closing line) | #d96b00 on #f3f4f4 = 3.14:1, 18px/20px, weight 400 |
| color-contrast | serious | 1.4.3 | reduced-motion runs only | 1 | `figure[aria-label="H-Lynk device"] > figcaption` | #61656a on #00041c = 3.45:1, 14px, weight 400 |

Incomplete nodes: axe could not resolve a background for the World photo captions (`#mpx-world-a > .bottom-3.bg-ink-900/85 > .text-ink-100…`, and the same for b/c/d), the hero figcaption over the city canvas (`.text-ink-200`, `.text-ink-400`), and one glyph-only node. Manual estimates for these are below. All of them pass.

Harness gap: under normal motion the H-Lynk block (`#mfx-hlynk-*`) sits at opacity 0 until it scrolls into view, and the scan runs from the top of the page, so axe skips it. That is why the DeviceStage caption failure shows up only in the reduced-motion runs. The failure is real in both modes. The harness should scan each section after scrolling it into view and letting the reveal settle, or should also scan in reduced-motion mode.

## Screenshot matrix

154 JPEGs (18 MB) in `docs/design/site/baseline/`, committed because the repo already tracks `docs/design/site/shots/`. Section viewport shots are named `<width>-<motion>-<section>.jpg` for widths 390, 430, 768, 884, 1024, 1280, 1440, 1728 and 844x390 landscape, motion normal and reduced, sections hero, marquee, world, hlynk, starters, care, hatch, footer. Full pages exist at 390 and 1440 in both modes, plus `get-{390,1440}-{initial,invalid,confirmed}.jpg` for the waitlist page.

Caveat: headless Chromium had no WebGPU adapter ("No available adapters." on every load), so canvases in these shots are the fallback paths. Under normal motion, scroll-reveal content sits at opacity 0 until its trigger fires, so the normal-motion full-page shots show the H-Lynk section as an empty band; the reduced-motion shots show it.

No horizontal overflow at any viewport. No console errors on `/` or `/get`. WebGL warnings: 4× "GPU stall due to ReadPixels" at 390, 4× "Running out of reserved outsideRenderPass queueSerial" at 768.

---

## Not measured

- INP: Lighthouse navigation mode cannot measure it (see §1).
- GPU-process time for the WebGPU mount stall: not traced.
- Real-device numbers: everything here is desktop headless Chrome on an M3 Pro, with Lighthouse simulating a mid-range phone.
