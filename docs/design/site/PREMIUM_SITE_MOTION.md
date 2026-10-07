# PREMIUM_SITE_MOTION — W01 home page

The motion contract for the redesigned home page. Companion to
`PREMIUM_SITE_AUDIT.md`; implementation lives in
`apps/web/components/home/motion.ts` (choreography) and
`apps/web/components/home/MotionRoot.tsx` (provider/clock).

## 1. Architecture

```
ReactLenis (root, options.autoRaf)          ← owns the one RAF clock
  └─ GsapLenisBridge
       connectGsapLenis(lenis, {
         clock: 'external',                 ← ReactLenis owns raf; kinetrell adds no ticker
         refreshOnConnect: true,
       })                                   ← lenis 'scroll' → ScrollTrigger.update()
  └─ MotionFrame
       useHomeMotion()                      ← binds all timelines + ScrollTriggers once
```

- `Lenis` runs in root mode — it smooths **window** scroll. `syncTouch` stays
  off (Lenis default), so touch scrolling keeps native feel; no scroll-jacking
  on mobile.
- No second RAF loop anywhere. `lenis.raf()` is never called by us.
- All timelines are `defineMotion()` documents compiled by `compileMotion()`,
  bound by `createGsapTimeline()`, scrolled by `attachScrollTrigger()` — the
  Kinetrell GSAP adapters, not raw tween calls (the single sanctioned raw
  `gsap` usage is `quickTo` for the magnetic CTA, inside `motion.ts` only;
  eslint restricts `gsap` imports to that file).

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
| `w01.hero.enter` | played on load (1.15s), skipped if hydration binds >1.8s | transform-only settle: art (scale 1.045→1, y 24→0) → eyebrow → headline (y 34→0) → seal stamps (y+rotate −2°→0) → starters → CTA → district selector |
| `w01.hero.drift` | scrub, desktop only | hero art cluster drifts −9%, plate −4% on scroll-out — separation, not travel |
| `w01.world.enter` | played at `top 78%` | headline block resolves once |
| `w01.world.drift` | scrub `top bottom→bottom top` | the four frames drift −6/−13/−9/−16% — smaller frames travel further; vertical only |
| `w01.hlynk.reveal` | scrub `top 82%→center 55%` | device settles (y 56→0, rotationY 8°→0, scale .97→1), then the scan line sweeps, then the three feature lines resolve in order |
| `w01.starters.enter` | played at `top 78%` | header, then cards 0/1/2 at +140ms stagger |
| `w01.care.enter` | played at `top 80%` | copy, then the readout plate |
| `w01.hatch.reveal` | played at `top 72%` | night frame de-scales slowly (1.06→1, 1.3s) → copy → CTA — the quiet climax |
| magnetic | pointer-fine only | ≤6px pull toward cursor on the two waitlist CTAs, 250ms release |

Deliberately absent: pinning (allowed but not needed — the drift gives depth
without scroll-jacking), continuous rotation, parallax inside text columns,
per-element entrance inside every section.

## 4. Reduced motion

`useBrowserReducedMotion()` gates `MotionRoot`: under
`prefers-reduced-motion` the page renders without `ReactLenis`,
`motion-armed` is never set, no timeline or ScrollTrigger is created, and no
magnetic listeners attach. The result is the authored static composition —
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
