# PREMIUM_SITE_MOTION — W01 home page

The motion contract for the redesigned home page. Companion to
`PREMIUM_SITE_AUDIT.md`; implementation lives in
`apps/web/components/home/motion.ts` (choreography) and
`apps/web/components/home/MotionRoot.tsx` (provider/clock).

## 1. Architecture

```text
ReactLenis (root, autoRaf: false)            ← no Lenis RAF loop
  └─ GsapLenisBridge
       connectGsapLenis(lenis, {
         clock: 'kinetrell',                 ← adds lenis.raf to gsap.ticker
         refreshOnConnect: true,
       })                                    ← lenis 'scroll' → ScrollTrigger.update()
  └─ MotionFrame
       useHomeMotion()                       ← binds timelines + ScrollTriggers once
```

`gsap.ticker` is the only motion clock. Verified against the pinned Kinetrell (0.1.0-alpha.1 @ 344de515):

| Symbol | Source | Behaviour relied on |
|---|---|---|
| `ReactLenis` | `kinetrell/dist/web/lenis.mjs:47` (re-export of `lenis/react`) | `autoRaf: false` means Lenis starts no RAF loop |
| `useKinetrellLenis` | `lenis.mjs:43` | returns the root Lenis instance |
| `connectGsapLenis` | `kinetrell/dist/web/gsap-lenis.mjs:6` | `clock: 'kinetrell'` registers `lenis.raf(t*1000)` on `gsap.ticker` (`:16-20`) and subscribes `ScrollTrigger.update` to Lenis scroll; the teardown removes both |
| `createGsapTimeline` | `kinetrell/dist/web/gsap.mjs:32` | binds compiled motion documents |
| `attachScrollTrigger` | `gsap.mjs:57` | one ScrollTrigger per timeline, killed with it |
| `useBrowserReducedMotion` | `kinetrell/dist/web/react.mjs` | single reduced-motion source for the page |

The previous setup (`autoRaf: true` with `clock: 'external'`) left Lenis and GSAP each running a RAF loop; Phase 1 measured up to 8 RAF callbacks in one frame while scrolling (`PREMIUM_SITE_BASELINE.md` §2).

Canvases: `CityBlocks` (hero) and `DeviceStage` (H-Lynk) each loop only while on screen, and `ThreeCanvas` stops three's internal `Animation` loop after `init()` (PS-010). `site-qa:motion` asserts one motion clock and at most one live canvas loop.

Refresh: `connectGsapLenis` refreshes on connect; sections that change layout after mount (the H-Lynk stage swapping capture for canvas, late images) call `ScrollTrigger.refresh()` through the timeline that owns them. Teardown: `useGSAP` reverts every timeline and trigger on unmount; `site-qa:motion` checks the trigger count returns to its post-mount value after a route away and back.

Page motion values come from the `@acme/theme` page-motion tokens; no duration, ease or distance literal lives in `motion.ts`.

## 2. Targeting

`@acme/ui` resolves `className` to inline styles on web, so motion targets are
`id` attributes — they pass through to the DOM untouched:

| prefix | role | hidden pre-motion? |
|---|---|---|
| `mfx-<name>` | fade/resolve target | yes — `opacity:0` while `motion-armed` is set, **except `mfx-hero-*`** |
| `mpx-<name>` | transform-only target (parallax) | never |
| `trg-<name>` | ScrollTrigger anchor (section root) | n/a |

`motion-armed` is added to `<html>` inside the `useGSAP` layout effect —
before first paint, so there is no flash — and only when the full motion
path is active. The pre-hide CSS is additionally gated behind
`prefers-reduced-motion: no-preference` as a second safety net.

**LCP exception (measured, not guessed):** the hero holds the LCP element,
so `mfx-hero-*` markers are excluded from the pre-hide
(`globals.css`) and `w01.hero.enter` is transform-only (y/scale/rotate —
nothing in the hero ever goes transparent). If hydration binds late
(>1.8s), the entrance is skipped entirely and the static composition
stands. Below-fold `mfx-*` markers keep the hide: their entrances are
scroll-triggered, so they are not on the LCP path.

## 3. The small vocabulary

Per the brief: motion explains spatial relationships or a rare story beat.
No section-wide "fade everything up."

| moment | type | what it does |
|---|---|---|
| `w01.hero.enter` | played on load (~1.1s), skipped if hydration binds >1.8s | transform-only, one composed beat (Phase 3): poster photograph settles (scale 1.05→1, y 24→0) → headline plates and support line as one block (y 34→0) → seal stamps (y 16→0, rotate −2°→0) → CTA and district control (y 16→0). No per-line stagger |
| `w01.world.enter` | played at `top 78%` | the World story tile (`mfx-world-story`) resolves once |
| `w01.world.drift` | scrub `top bottom→bottom top`, ≥768px only | the two World photographs' image layers drift inside fixed frames at `parallax.mid` and `parallax.near`; the layer overhangs its frame by `parallax.max`, so no edge shows. Frames never move |
| `w01.hlynk.reveal` | scrub `top 82%→center 55%` | device settles (y 56→0, rotationY 8°→0, scale .97→1), then the scan line sweeps, then the three feature lines resolve in order |
| `w01.starters.enter` | played at `top 78%` | header, then cards 0/1/2 at +140ms stagger |
| `w01.care.enter` | played at `top 80%` | copy, then the readout plate |
| `w01.hatch.reveal` | played at `top 72%` | night frame de-scales slowly (1.06→1, 1.3s) → copy → CTA — the quiet climax |

Deliberately absent: pinning (allowed but not needed — the drift gives depth
without scroll-jacking), continuous rotation, parallax inside text columns,
per-element entrance inside every section.

## 4. Reduced motion

`useBrowserReducedMotion()` gates `MotionRoot`: under
`prefers-reduced-motion` the page renders without `ReactLenis`,
`motion-armed` is never set, no timeline or ScrollTrigger is created, and no
listeners attach. The result is the authored static composition —
all content readable, all controls reachable. `DeviceStage`/`SceneSection`
keep their own reduced-motion static-capture behavior on top of this.

## 5. Performance rules held

- Transform/opacity only; `yPercent` for drift so it can't fight layout.
- One binding pass on mount (`useGSAP` context, auto-reverts on unmount) —
  no per-frame React state, no scroll listeners besides Lenis' own.
- Scrub timelines are desktop-gated (`min-width: 768px`) — mobile gets the
  entrances only, and native-feeling touch scroll.
- Images: bundled WebP, `placeholder="blur"` + `blurDataURL`, `loading="lazy"`
  below the fold, `sizes` per breakpoint, `unoptimized` (already 1200px WebP).
  The hero art (the LCP candidate) is eager + `fetchPriority="high"` with an
  explicit `<link rel="preload">` — SolitoImage drops next/image's `priority`.
- `CityBlocks` is `next/dynamic` (ssr:false) — the GPU scene's code stays out
  of the entry chunk and only loads when `SceneSection` nears the viewport;
  `DeviceStage` keeps its own lazy scene import + static capture.
- `globals.css` mirrors react-native-web's four base atoms
  (`css-g5y9jx`, `css-146c3p1`, `css-1jxf684`, `css-9pa8cd`) — RNW injects
  them client-side only, so without the mirror the SSR'd nav stacked its
  links (378px → 114px on hydration): the site's only layout shift.

## 6. Verification

- `prefers-reduced-motion` profile: static composition verified in browser.
- `gaps`: `bindable()` skips any motion whose targets are absent and warns in
  dev — a section refactor can disable a beat, never crash the page.

## 7. Phase 3 changes

- Removed: `w01.hero.drift` (no nameable purpose once the hero stopped being a card over a scene) and the magnetic CTA pull (`armMagnets`, `pageMotion.magnet`). The hero now owns one timeline and no ScrollTrigger, so the post-mount trigger count is 6 at 1280 and 5 at 390 (was 7 and 5).
- The signage board has no motion.
- `site-qa:motion` after the change: one owner (GSAP ticker) and at most one drawing canvas in every window; ScrollTrigger mount/away/back 6/0/6 desktop, 5/0/5 mobile, 0/0/0 reduced.
