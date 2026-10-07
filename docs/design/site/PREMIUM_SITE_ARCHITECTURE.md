# Premium site architecture: W01 home

How the redesigned home page is built: what renders where, who owns which file, how motion and canvases share the frame budget, and how it's tested. Decisions behind each rule are in `PREMIUM_SITE_DECISIONS.md` (PS-008 onward). Motion detail is in `PREMIUM_SITE_MOTION.md`.

## 1. Rendering map

Server HTML first: every heading, paragraph, link, image and starter fact is in the server-rendered document from `@acme/ui/html` (`packages/ui/html/index.tsx`). Client islands exist only for district interaction, motion, WebGPU, and real controls.

| Section | Server shell | Client island (why) | Canvas | ScrollTrigger | Images | Data | Reduced motion | Offscreen |
|---|---|---|---|---|---|---|---|---|
| NAV | `SiteChrome` wrapper | `NavBar` (menu state, `usePathname`) | none | none | wordmark | `site/nav.ts` | same | n/a |
| HERO | headline, support line, CTA, seal, photo | district selector + `CityBlocks` (store write, WebGPU) | `CityBlocks` via `GpuCanvas`, lazy (`SceneSection`) | entrance timeline, drift | `art('hero')`, LCP, preloaded, explicit size | `copy.ts`, `@acme/spatial/copy`, `useDistrictStore` | static composition, canvas draws one frame | `paused` from `SceneSection` stops the loop |
| SIGNAGE | whole section | none | none | none | none | `copy.ts`, district list | same | n/a |
| WORLD | whole section | none | none | one reveal, ≤2 parallax images ≥768px | `art('world.*')`, lazy, `sizes` per slot | `copy.ts`, districts | static | n/a |
| H-LYNK | copy, proof modules, static capture | `DeviceStage` (WebGPU, pointer) | `ThreeCanvas`, lazy at 600px, DPR ≤1.5 | product-stage timeline | `art('hlynk.static')` capture | `copy.ts`, canon Decision #16 | static capture only, no canvas | `paused={!isVisible}` |
| STARTERS | whole section | none | none | reveal | `art('starter.<id>')` | `@acme/content` starters + eggs | static | n/a |
| CARE | whole section | none | none | meters settle once | `art('care')` | `copy.ts` | final values | n/a |
| HATCH | whole section | none | none | one lighting moment | `art('hatch')` | `copy.ts` | static night | n/a |
| WAITLIST | form shell (`Form`, `Label`, `Input`, `Output`) | form state via `useActionState` (Phase 6) | none | none | none | `copy.ts`; server action → `POST /v1/waitlist` (PS-001) | same | n/a |
| FOOTER | `SiteFooter` | none | `RiverTide` | none | none | `site/nav.ts`, `homeCopy.ts` | static | `LazyScene` pause |

Hydration risk lives in two places: the district selector (its value comes from a persisted Zustand store, so the server renders the default `midtown` and the client may switch) and `useBrowserReducedMotion` in `MotionRoot`. Neither changes layout dimensions; both are covered by the CLS check in `site-qa:lhci`.

## 2. Ownership

| Layer | Owns | Rule |
|---|---|---|
| `apps/web/components/home` | section composition, `copy.ts`, `art.ts`, `motion.ts`, `MotionRoot.tsx` | Campaign-specific. Not generalized. |
| `packages/ui` | reusable primitives (`SegmentedControl`, `NavBar`, `CityBlocks`, `ThreeCanvas`, `SolidPanel`, `@acme/ui/html` …) | A primitive is promoted only when two sections share a behavioural contract (ADR). Bugs are fixed here, not patched in the app. |
| `packages/theme` | tokens: colour, type, space, `contentWidths`, motion (UI and page) | App code imports values; no literals. |
| `packages/assets` | brand marks, fonts, NYC photography | Local only, no hotlinking. |
| `packages/content` | starters, eggs, Bloodlines, Dex IDs | The only source of canon names. |
| `packages/spatial` | `useDistrictStore` (Zustand) | The one store for district selection. |

State: Zustand only. The district lives in `packages/spatial/districtStore.ts` `useDistrictStore`. The waitlist form uses React 19 `useActionState` (contract §12 exception). No `useState`/`useReducer` in `apps/web`.

## 3. Design-system usage matrix (marketing page)

| Port | Use | Where |
|---|---|---|
| `SolidPanel` | daylit-safe | local contrast behind copy that needs it |
| `CornerCutFrame`, `NotchFrame` | daylit-safe with glow and rim off | bento modules in WORLD and H-LYNK proof |
| `SignageBand`, `SignagePlate` | daylit-safe | SIGNAGE district board |
| `SegmentedControl` | interactive-only | hero district selector (radio-group semantics) |
| `@acme/ui` H-Lynk parts (`HLynkShell`, `ScannerLed`, `Trackpad`, `HLynkKey`) | interactive/decorative | H-LYNK proof modules |
| `ProgressBar` | interactive-only (meter semantics) | CARE, only if meters remain |
| `CityBlocks`, `SceneSection`, `ThreeCanvas`, `RiverTide`, `SkylineDivider` | decorative scenes | hero city, H-Lynk stage, footer, one day→night divider |
| neon glow helpers | night-only | HATCH light |
| `NeonChevron`, `BeamFrame`, `GridCard`, `CircuitButton`, `CardSlider` | avoid on this page | glow-as-border, SaaS card, slider (2.5.7) |

## 4. Bento contract

CSS Grid only, in the section's own markup. No package, no masonry JS, no measured layout. At most three clusters: WORLD, H-LYNK proof, optionally CARE. Each cluster: 12 columns from `md`, one dominant module (7–8 columns, may span two rows), up to three support modules, at least one visual proof, and DOM order equal to the mobile reading order so the grid collapses to a single column without reordering. Container queries only where a module's own width decides its layout. Never in hero, starters, hatch or the waitlist.

## 5. Art-map contract

`apps/web/components/home/art.ts` exports `art(slot)` over an exhaustive `ArtSlot` union (`hero`, `world.*`, `hlynk.static`, `starter.<StarterId>`, `care`, `hatch`). Every entry has `src`, `width`, `height`, `sizes`, and either a descriptive `alt` or `decorative: { reason }` with `alt: ''`. Optional: `focalPoint`, `blurDataURL`, `mobileSrc`, `caption`. Slots point at local `@acme/assets/photos` today. Final renders replace the slot's source without layout changes; their specs live in `PREMIUM_SITE_HANDOFF.md`. `art.test.ts` fails if a slot is missing, has a non-positive dimension, or lacks alt without a decorative reason.

## 6. Frame budget

- **One motion clock.** `gsap.ticker` drives Lenis (`MotionRoot.tsx`, `connectGsapLenis(..., { clock: 'kinetrell' })` with `autoRaf: false`). PS-009.
- **Canvases loop only while visible.** `CityBlocks` forwards `paused` to `GpuCanvas`; `DeviceStage` passes `paused={!isVisible}` to `ThreeCanvas`. `ThreeCanvas` stops three's internal `Animation` loop after `init()` and advances `nodeFrame` per draw, so a paused stage costs no frames. The two canvases sit a full section apart, so visibility gating means at most one runs. PS-010.
- No React state updates on RAF; transform and opacity only for authored motion.

## 7. Test plan

| Area | Type | Where | CI |
|---|---|---|---|
| Art map exhaustiveness, alt policy | unit (`node --test`) | `apps/web/components/home/art.test.ts` | yes |
| Motion marker parsing | unit | `motion-markers.test.ts` | yes |
| Theme tokens emitted to CSS | unit | `packages/theme` tests | yes |
| District selector keyboard model (`nextRadioIndex`) | unit | `packages/ui` | yes |
| Waitlist handler: every branch (valid, duplicate, invalid, under-13, honeypot, rate limit, server error) | unit, mocked Payload (vitest) | `packages/payload` | yes |
| Waitlist form states | component, mocked action | `apps/web` | yes |
| Screenshots × 9 viewports × motion | visual | `pnpm site-qa:shots` | local (needs a served build) |
| axe per section after reveal | a11y | `pnpm site-qa:axe` | local |
| Banned words, generic "device" | copy | `pnpm site-qa:copy-lint` | local |
| RAF owners ≤1, ScrollTrigger teardown | motion | `pnpm site-qa:motion` | local |
| Lighthouse ×5 median vs targets | perf | `pnpm site-qa:lhci` | local |

CI (`.github/workflows/ci.yml`) runs build, typecheck, lint and the unit tests. The browser checks need a served production build and a GPU-capable Chrome for representative canvas numbers, so they run locally before each phase closes; their output goes in `PREMIUM_SITE_QA.md`.

## 8. Performance and accessibility architecture

Perf: the hero LCP is a real image with explicit dimensions and a preload; canvases are never LCP; `DeviceStage` keeps lazy mount, static capture, offscreen pause, WebGL2 fallback and the 1.5 DPR cap; the logo ships as a small derived WebP instead of the 696 KB PNG; first-load JS is reduced by keeping section shells on the server.

A11y: one `h1` (hero), `h2` per section, `h3` inside sections. Landmarks: `header` (nav), `main` (focusable target of the skip link), `footer`. Focus is visible everywhere and clears the sticky nav via `scroll-padding-top`. The district selector is a radio group with arrow keys and roving tabindex, wraps at 320px, and needs no drag. Alt ownership is the art map. Bento focus order is DOM order. Primary and custom controls are at least 44px. Every motion and 3D moment has a static equivalent under reduced motion with all content visible.

## 9. Implementation sequence

Phase 2 foundation (this doc) → 3 hero, signage, world → 4 H-Lynk → 5 starters, care → 6 hatch, waitlist (backend and form), footer → 7 QA, before/after, PR.
