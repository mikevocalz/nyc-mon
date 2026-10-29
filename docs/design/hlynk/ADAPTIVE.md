# H-Lynk on wide and folded windows

Owner: the H-Lynk chrome lane. Written 2026-10-15 after the Surface Duo report "look at screen, that section isnt responsive" on M10, then revised twice the same day for the user's follow-ups: "there should be no scrollbar in the hlynk! content should fit!" and "have the hlynk on right with logo on left view - really think about the screens and the views for foldable layouts".

Status: built and covered by node tests (unit fixtures). Not yet checked on a Surface Duo; the device run is the orchestrator's.

## Sources

- `skills/mikevocalz-foldable-layouts/SKILL.md` (blob `870b797`, identical to the user's 2026-10-15 copy in Downloads). Sections applied: §2 (physical-right rail, branding lives in the persistent header), §3 (live geometry from the measured host, never a launch-time read), §4 (normalise fold coordinates into the host once, on both axes; every feature processed; zero-width separating folds split; flat creases do not), §5 (book: complementary content in separate regions; tabletop: preview above, controls below), §6 (stable identities, no geometry-derived keys), §8 (reduced motion holds the brand background still), §10 (acceptance scenarios, as node tests below).
- Apple, Designing for iPhone Duo: <https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo>. Rules used: don't reinvent the app when it resizes, let the existing layout expand; keep text and control sizes as consistent as possible across displays; keep functionality and state the same between displays.
- `docs/design/hlynk/DIRECTION.md` ("Anatomy on a phone", the 3:4 screen from canon V11 ¶63) and `docs/canon/DECISIONS.md` Decision #16.
- `CONTRIBUTING.md` "Logos come from the repo": the badge is `packages/assets/brand/nyc-mon-logo*` through `BrandLogo`, never redrawn or tinted.

## What was wrong

`measureShell` capped the body at 440 pt on every window wider than a phone and centred it. On a spanned Duo that put a phone-sized device across the hinge with empty night either side. On a single Duo panel (about 540 × 696 dp) the 440 pt body leaves 696 − 40 − 555 = 101 pt for the control row, under the 120 pt floor, so the shell went compact. M10 and M08 relied on scroll views inside the 3:4 screen, so content that did not fit could sit out of view.

## Decision H-1: the device is sized from the height (BUILD)

- Viewports up to 440 pt wide (every phone in portrait) lay out exactly as before. The existing iPhone SE 3, 16 Pro Max and Pixel 8 tests still pass unchanged.
- Wider viewports fit the body to the height with the 3:4 screen kept. The body grows while a 200 pt control row still fits, up to 600 pt wide (tablet portrait reaches 600). When 440 pt would not leave a standard row, the body shrinks to the width where a 136 pt row fits, down to 320 pt: a Duo panel gets a 414 pt body with its full control row instead of the compact strip.
- Below 320 pt the device goes compact, and compact now spans the whole viewport width. Up to 440 pt that is the same width as before; phone landscape (844 pt) gets an 844 pt screen instead of a 440 pt strip, because a short window has no height to spare.
- Keys stay 48 pt and the trackpad stays 112 pt at every body width (HIG: consistent control sizes). Only the screen and the row height change.

## Decision H-2: brand left, H-Lynk right (BUILD)

`planHLynkPlacement` in `packages/ui/hlynk/layout.ts`, pure, fed by `useHostPlacement` (the shell's measured host, its window origin, and `useReservedRegions` → `foldLayoutsFromRegions`, with y converted too).

| Window | Arrangement | Left / upper | Right / lower |
|---|---|---|---|
| Phone portrait, Duo cover, single Duo panel, any window under 600 pt | `single` | none | the device fills the host, as today |
| One window from 600 pt wide, device standard | `wide` | NYC-MON pane, at least 232 pt | device pane: height-fit body + 24 pt each side |
| One window from 600 pt wide, device would be compact (phone landscape, keyboard up) | `single` | none | compact device across the full width |
| Vertical separating or occluding fold (book, flat Duo span) | `book` | NYC-MON pane in the leftmost region | device wholly in the rightmost region |
| Horizontal fold (tabletop) | `tabletop` | NYC-MON pane above the fold | device below the fold |

- Placement is physical. The brand pane stays left and the device right in RTL, like the rail (skill §2). Each region restores the locale's direction for its own content.
- A rail drawn inside the shell's host on the physical right is cut off first (`railRightPt`), so the device sits between the hinge and the rail and never overlaps it.
- The brand pane (`HLynkBrandPane`) is the badge as supplied over the kit's backgrounds: GridFloor under a skyline at night, the page surface with a SkylineDivider by day. It carries no controls and no copy. Reduced motion holds the background still.
- Continuity (skill §6, HIG): the device region and the brand pane have fixed keys. Folding moves the device region and adds or drops the brand pane; the device, the step inside its screen and that step's store (chosen egg, chosen minutes, the case animation) are never remounted.
- `HLynkStage` side panes: STRIKE. The M13 Quest layout put panes either side of a centred shell; a third column would cross a Duo hinge or squeeze the device. `useHLynkStageWide()` now returns false, so M13–M16 draw their panels inside the screen on every window, as they already did below 840 pt. The props stay for call-site compatibility.

## Decision H-3: nothing in the H-Lynk screen scrolls (BUILD)

`fitHLynkContent` (`packages/ui/hlynk/content-fit.ts`, pure) and `HLynkFit` (the component screens wrap their content in).

1. Each step describes its content as blocks: title, body, strong line, button rows, fixed rows, and one flexible media block (the ring, the triptych, the case).
2. The media shrinks first, down to its floor: the M10 ring to 144 pt (three 48 pt stops), the M08 triptych to 96 pt.
3. Then the type and spacing step down one rung at a time, within the kit's tokens: step 0 is the authored ramp with 16 pt padding and 12 pt gaps; step 1 sets the title in `type-body-strong` and body in `type-label` with 12 / 8; step 2 sets body in `type-caption` (the kit's floor) with 8 / 4. The headset ramp has its own ladder from `xr-title` down to `xr-caption`.
4. `HLynkFit` measures the real content after layout and steps down again if the estimate was short.
5. If the last step still overflows, `fits` is false and development builds warn with the exact sizes. That is a layout finding to fix in the design, never a reason to add a scroll view.

M10 and M08 now use `HLynkFit`; their scroll views are gone, including the one inside the M08 egg card.

## Tests

`packages/ui/hlynk/adaptive.test.ts` runs every viewport through placement, `measureShell` and `fitHLynkContent` and asserts the M10 and M08 content height never exceeds the screen's content area (bezel and one status row removed): iPhone SE 3, 16 Pro Max and Pixel 8 portrait; phone landscape 844 × 369; a Duo panel 540 × 696; Duo spanned 1114 × 696 with a 34 pt occluding hinge; tablet landscape 1194 × 790; tablet portrait 834 × 1150; a short window 640 × 360. The same file covers the skill §10 scenarios that apply to this layout: vertical occluding hinge, zero-width separating fold, flat crease, tabletop, multiple features with an off-host feature and a nonzero host origin, RTL with a right rail, and unknown capability followed by a reported hinge. `packages/app/features/egg/window-layout.test.ts` pins the M10 and M08 block shapes and copy lengths that the ui test mirrors.

## Findings

- At 640 pt wide, M10 does not fit below 360 pt of window height even at step 2 (compact chrome takes 96 pt, the content area is about 180 pt). Covered by a test that expects `fits: false`. Split-screen phones in landscape can be this short.
- `(onboarding)` draws no navigation rail. Since 2026-10-27 `(home)` draws the `(tabs)` group's physical-right rail (`ShellRail`, `packages/app/features/navigation/ShellNav.tsx`) on native tablets, foldables and headsets, as a sibling of the stage host in `HomeLayout`. The host is measured narrower instead of being overlapped, so `railRightPt` is still 0 on every H-Lynk step.
- The ui test mirrors the app's block builders because `@acme/ui` exports no `./hlynk/layout` subpath for node tests in `packages/app`. Adding `"./hlynk/layout": "./hlynk/layout.ts"` and `"./hlynk/content-fit": "./hlynk/content-fit.ts"` to `packages/ui/package.json` would let the app test import the real solver.
- The fit's text heights are estimates (average glyph advance per em). `HLynkFit`'s measured pass corrects them on device; only a device run shows how often it needs to.

## Decision H-4: the pane pair goes through ArrangementPanes (BUILD, 2026-10-16)

After the Surface Duo report that the device sat off-centre and cropped in the right panel, `HLynkShell` renders its two panes through `packages/ui/arrangement` (foldable skill §9): the native react-native-arrangement-view backend on Android and iOS 27.1+, overlay arrangement, H-Lynk primary on the physical right; the H-2 planner above stays the fallback for web, SSR, XR and older iOS. The body is placed by `placeBodyInFrame`, which centres it on both axes from the pane's measured box, and the shell now consumes all four safe-area edges. Under the native backend a wide window with no fold shows the H-Lynk alone (brand pane DEFER there). Full write-up, root-cause reading and the per-screen plan: `docs/design/foldable-arrangements.md`. Tests: `packages/ui/hlynk/duo-centring.test.ts`, `packages/ui/arrangement/backend.test.ts`.
