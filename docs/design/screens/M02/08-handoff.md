# M02 Welcome: handoff

Implementation contract for `platform` and the kit. Inputs: `01-research.md` to `07-a11y.md`, `docs/DESIGN_SYSTEM.md`, `docs/design/DECISIONS.md` (P1, P3, D7, D8), canon Decisions #5, #9, #11, #13, `docs/COPY_DECK.md`, `docs/DEVICE_CHECKS.md`.

## Blockers before implementation

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | Kit daylit fixes from `07-a11y.md`: ghost labels resolve to `accent` (2.07:1 today); full-width button labels may wrap; `Button variant="cta"` reading `cta` / `on-cta` / `cta-pressed` | kit | Skip, Next, Sign in, Get started |
| B2 | `CardSlider progressPosition="below-content"` with story `OnboardingPanels` | kit | layout |
| B3 | `StatusRow` (NEW, specced in `M05/04-components.md`) | kit | offline first run |
| B4 | **Panel 2 egg captures** for #001 Metro Egg, #008 Corner Egg, #061 Prism Egg. Q11 (do the player's eggs use the v7 egg looks?) is `TODO(canon)`. Placeholder art is banned in `main` (§0A.2) | `3d-lookdev`, Mike | panel 2 only |
| B5 | `FadeIn` / cross-fade presets take `reducedMotion` | kit | page change |

Panels 1 and 3 can be built and merged behind B4: the carousel ships with three panels or not at all, so the route stays behind a flag until B4 clears.

Not blocking: Mike's choice of the panel 1 photo (`harlem-brownstone-stoops.webp` proposed; it exists in `packages/assets/photos/`). Variant B of panel 3 ships only after the hallway comprehension test (`COPY_DECK.md` open question 1).

## Route and intent

Route `/(onboarding)/welcome`. Shell: none (D1). Theme: OS appearance (D8).

| Priority | Intent |
|---|---|
| P1 | Get a new player to "Get started" (→ M04) and a returning one to "Sign in" (→ M03 sign-in intent), never skipping that split (P1) |
| P2 | Show the city, the three eggs and what a Caller is, one sentence each, at the Caller's pace |
| P3 | Skip always visible; lands on panel 3, not past it |
| P4 | Offline first run says no network is needed yet |

## Layout

Compact (phones), all three panels:

| Region | Spec |
|---|---|
| Top bar | Skip, top-right, 16 pt from the edge, below the safe top inset; hidden on panel 3 |
| Image | `NotchFrame` corner cut bottom-right, full width inside 16 pt gutters, 62% of the safe height at default text size |
| Caption band | `bg`, 16 pt gutter, 24 pt below the image; title then body, left-aligned |
| Status row | only offline; between the caption band and the progress |
| Progress + arrows | one row, 24 pt above the actions |
| Actions | pinned, 16 pt above the safe bottom inset; panels 1–2 Next; panel 3 Get started then Sign in, 12 pt apart |

Width classes and postures (`07-a11y.md` § Responsive):

| Class | Layout |
|---|---|
| Medium | single column, max 560 pt, centred, 24 pt gutter |
| Expanded / extra-large | image pane 55% left; caption, progress and actions right |
| Book posture | image in the leading pane, text and actions in the trailing pane |
| Tabletop | image above the hinge; caption and actions below |

The action group never straddles a hinge. Hinge rects from `@acme/ui/adaptive-panes` (port in progress); before it lands, a detected fold puts the single column in the leading pane.

## Components

| Element | Component | Props | testID |
|---|---|---|---|
| Page | `@acme/ui/primitives` `Main` | — | `m02-main` |
| Carousel | `CardSlider` | `label` = `m02.carousel.label`, `visibleCount={1}`, `showButtons`, `buttonPosition="bottom"`, `progressStyle="dots"`, `progressPosition="below-content"` (NEW), `autoPlay={false}`, `loop={false}`, `reducedMotion` | `m02-carousel` |
| Panel | `Section` labelled by its heading | — | `m02-panel-1` … `m02-panel-3` |
| Heading | `Heading` `level={1}` panel 1, `level={2}` panels 2–3; `size="title"` | — | `m02-p1-title` … |
| Body | `Text` `variant="body"` | — | `m02-p1-body` … |
| Image | `Figure` > `NotchFrame` > `Image` `fill` | `alt` per copy ID | `m02-p1-image` … |
| Bloodline captions | `Text` `variant="caption"` `tone="muted"` ×3 | hidden from AT (alt carries them) | `m02-p2-caption-f01`, `-f02`, `-f12` |
| Skip | `Button` `variant="ghost"` `size="md"` | `tone="royal"` (renders `accent` after B1), Android `hitSlop` 2 | `m02-skip` |
| Next | `Button` `variant="ghost"` `size="md"` `fullWidth` | | `m02-next` |
| Get started | `Button` `variant="cta"` `size="lg"` `fullWidth` | the only orange on the screen | `m02-cta-get-started` |
| Sign in | `Button` `variant="ghost"` `size="md"` | | `m02-cta-sign-in` |
| Offline | `StatusRow` | `items=[{ id: 'offline', label: m02.status.offline, tone: 'neutral' }]` | `m02-status-offline` |

`CardSlider.progressPosition` contract (R5): `progressPosition?: 'with-buttons' | 'below-content'`, default `'with-buttons'` (today's behaviour). One literal union, no boolean.

## Tokens

| Use | Daylit | Night |
|---|---|---|
| Page | `bg` `concrete-50` | `night` |
| Title, body | `text` #000000 | #F8F8F8 |
| Captions, status | `text-muted` `concrete-600` | `silver` |
| Ghost labels, arrows, current tile, focus | `accent` / `focus` `royal-500` | `carolina-500` |
| Other tiles | `concrete-500` | `concrete-600` |
| CTA face / label / pressed | `cta` / `on-cta` / `cta-pressed` | same tokens, night values |
| Type | `type-title`, `type-body`, `type-caption`, `type-label` | |
| Space | 16 pt gutter (24 from medium), 24 pt section gaps, 12 pt action gap | |

No glow, no neon grid on daylit. Measured pairs: `07-a11y.md`.

## States

| State | What shows | Copy IDs |
|---|---|---|
| Panel 1 | block photo, title, body, Next | `m02.p1.title`, `m02.p1.body`, `m02.p1.image.alt`, `m02.next`, `m02.skip` |
| Panel 2 | three eggs on one ground line, captions, Next | `m02.p2.title`, `m02.p2.body`, `m02.p2.caption.f01` / `.f02` / `.f12`, `m02.p2.image.alt` |
| Panel 3 (A, default) | H-Lynk front view, Get started, Sign in | `m02.p3.title`, `m02.p3.body.a`, `m02.p3.image.alt`, `m02.p3.cta.primary` (+ `.a11y.hint`), `m02.p3.cta.secondary` (+ `.a11y.hint`) |
| Panel 3 (B, test build only) | same, body B | `m02.p3.body.b` |
| Offline first run | status row added | `m02.status.offline` |
| Reduced motion | cross-fade | no copy change |

Navigation: Get started → `/(auth)/age` (M04). Sign in → `/(auth)/sign-in?intent=sign-in` (M03). Skip → panel 3. Android back on panel 2–3 → previous panel; on panel 1 → leaves the app (no M01 to return to).

## Motion and reduced motion

| Motion | Full | Reduced |
|---|---|---|
| Page change | `motion-step` 200 ms, 24 pt slide | 120 ms cross-fade |
| Press | `motion-tap` scale 0.97 | colour change only |
| Arrival from M01 | M01's hand-off | M01's 200 ms cross-fade |

## Empty, error, offline

- No data loads on M02, so there is no loading or error state. Images are bundled assets.
- Offline: `StatusRow` item; every action still works (M04 needs no network; M03 shows its own offline error).
- Missing egg captures: the route stays flagged off (B4). It never renders an empty panel 2.

## Data

| Need | Source |
|---|---|
| Egg names, Dex numbers, Bloodline ids | `@acme/content` `eggs` (`eggName`, `dexId`, `bloodlineId`), slot order = starter order |
| Bloodline caption | copy IDs `m02.p2.caption.*`; a unit test asserts each equals `${bloodlineName} Bloodline` from `@acme/content` (Decision #11) |
| Block photo | `packages/assets/photos/harlem-brownstone-stoops.webp` (pending Mike) |
| Egg captures | `3d-lookdev` output (B4) |
| Network state | app connectivity adapter |
| Reduced motion | sim-core adapter |

No account, age or analytics data is read or written here.

## Accessibility contract

`07-a11y.md`: focus order, current panel only in the AT tree, focus to the new heading on page change, Skip focuses panel 3's heading, captions hidden from AT, one `h1`, carousel roles on web, arrows on web, XXL behaviour (image floors at 35%, caption band scrolls, actions pinned, panel 2 captions stack).

## Tests to write

| Kind | Test |
|---|---|
| Unit | Bloodline caption strings match `@acme/content` names; no "line" / "family" in any M02 string |
| Unit | Skip from panel 1 or 2 lands on panel 3; Get started routes to M04; Sign in routes to M03 with `intent=sign-in` |
| Unit (`packages/ui`) | ghost royal label resolves to `accent` on light and dark; `Button variant="cta"` uses `on-cta` |
| Unit (`packages/theme`) | `contrast.test.ts` contains every M02 pair in `07-a11y.md` |
| Story | `CardSlider/OnboardingPanels` (daylit, night, reduced motion, XXL); `StatusRow/Offline`; `Button/Cta` |
| Visual | captures of each panel, daylit and night, SE and Pro Max widths, default and XXL |
| a11y (web) | axe on the M02 route; keyboard: Tab order, Left/Right change panel, Skip |

## Device verification

Open; no device yet. Implementation proceeds with these pending. Full list: [`docs/DEVICE_CHECKS.md`](../../../DEVICE_CHECKS.md).

- [ ] VoiceOver and TalkBack: "Page n of 3" on change, focus to the heading, no hidden panel read (DEVICE_CHECKS "VoiceOver and TalkBack on M01–M07").
- [ ] Dynamic Type XXL on SE 3: actions stay on screen, captions wrap, nothing truncates.
- [ ] Native `CardSlider` (DEVICE_CHECKS "Native CardSlider"): swipe, buttons, reduced-motion cross-fade.
- [ ] Foldable book and tabletop: action group in one pane.
