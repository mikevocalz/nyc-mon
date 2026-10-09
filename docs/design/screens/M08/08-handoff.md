# M08 Meeting: handoff

Implementation contract for `platform`, `render` and the kit. Inputs: `01-research.md` to `07-a11y.md`; canon Decisions #1, #5, #9, #11, #14; design D3, D5, D7, D8, D11, P2, P3; `docs/design/hlynk/DIRECTION.md`; `docs/spatial/CONTRACT.md`; `packages/app/features/mon/mon.store.ts`.

## Blockers before implementation

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | `ChoiceTriptych` (missing primitive, contract below) with stories `Browsing`, `Focused`, `ReducedMotion`, `LargeText`, `NightPage` (R3) | kit | the three blocks |
| B2 | `selectPendingEgg` selector (missing, contract in § Data) so M08 can tell "no egg yet" from "egg already chosen" | `sim-core` / app | entry guard |
| B3 | `bootPath` sends `egg-choice` to `APP_HOME_PATH` today ("M08 is not built", `packages/app/features/onboarding/boot.ts`). Point it at `/(onboarding)/meet` in the same PR as the route (Nav never 404s) | `platform` | boot |
| B4 | `TrackpadActions` buttons at ≥ 44 pt (`07-a11y.md` finding 3) | kit | labelled actions |
| B5 | Night focus ring uses `royal-300` (`07-a11y.md` finding 2) | kit | focus on night |

Not blocking: Santoro art and line (`TODO(canon)`), egg models (Mike, later), culture and food rows (Q12, Q13, Q22, Q24), card number ruling (C4). The screen ships without them and adds them without layout change.

## Route and intent

Route `/(onboarding)/meet`. Shell: H-Lynk Core (DIRECTION.md "Where the chrome appears"). Scheme: the shell's clock rule (D8). Reached from M07 confirmed, or boot `resume-onboarding` / `egg-choice`. Next: M10 `/(onboarding)/incubate?bloodline={bloodlineId}`.

| Priority | Intent |
|---|---|
| P1 | Let the Caller compare three eggs and choose one, with no default and no pressure |
| P2 | Make the choice deliberate: a held trackpad or a confirm |
| P3 | Show only canon-settled facts: egg name, egg number, Bloodline |
| P4 | Never show the Baby before the hatch |

## Layout by breakpoint

| Breakpoint | Shell layout | Screen layout |
|---|---|---|
| Phone portrait (SE 375 × 667 to Pro Max 440 × 956) | measured `HLynkShell`, 3:4 screen (351 × 468 on SE) | 16 pt inner gutter. Title + caption block (about 88 pt). Triptych: three 4:5 tiles, 12 pt gaps, width `(screenW − 32 − 24) / 3` (≈ 98 pt on SE, 120 pt on Pro Max). Labels 8 pt under. `TrackpadActions` 16 pt under. Approaching: the focused tile fills the screen; the card docks to the bottom, 12 pt from the screen edges, max height 60% of the screen, scrolls inside |
| Tablet portrait (medium class, e.g. iPad 820 × 1180) | measured shell, centred, shell width capped at 560 pt; the page around it is `bg` | triptych tiles ≈ 160 pt wide; card max width 420 pt, centred at the bottom |
| Tablet landscape / split view / any height where the control row would get under 120 pt | `layout="compact"`: full-bleed screen, 24 pt head, 72 pt bar, pill trackpad | triptych centred, tiles capped at 220 pt wide; the card docks to the trailing third beside the focused block instead of over it |
| Quest 2D window, 1280 × 800 dp (landscape, `resolveSceneMode` row 3/4: `screen`) | `layout="compact"` | 24 dp gutter. Triptych tiles ≈ 300 × 375 dp, centred. Approaching: block fills the leading two-thirds; card in the trailing third (max 400 dp), vertically centred. All targets ≥ 48 dp (XAUR pointer accuracy with a ray) |

Phones are portrait only (DIRECTION.md). At accessibility text sizes the triptych becomes a three-row list (`07-a11y.md`).

## Components

| Element | Component | Props | testID |
|---|---|---|---|
| Chrome | `HLynkShell` | `tier="core"`, `scheme`, `status={{ led: 'off' }}`, `reducedMotion`, `trackpad` (below), `keys` (below), `testIDPrefix="m08"` | `m08-shell` (and the shell's part IDs) |
| Screen | `HLynkScreen` | `aspect="3:4"` (compact: `fill`), `statusRow` | `m08-screen` |
| Consent pending | `StatusRow` | M05 pending item, under-13 pending only | `status-consent-pending` |
| Title | `Heading level={1}` | `m08.title` | `m08-title` |
| Caption | `Text` `type-body` muted | `m08.santoro.caption` | `m08-caption` |
| Santoro line | none until canon | renders nothing while `m08.santoro.line` is empty | `m08-santoro-line` |
| Triptych | `ChoiceTriptych` | `items` from `eggs`, `focusedIndex`, `onFocusChange`, `reducedMotion`, `accessibilityLabel={m08.title}` | `m08-triptych`, tiles `m08-egg-F01`, `m08-egg-F02`, `m08-egg-F12` |
| Egg image | `Image` | `src`, `alt` from `CREATURE_ART` (egg entry with the matching `dexId`), `fill` | `m08-egg-image-F01` … |
| Card | `Card variant="notch" surface="page"` | `title={eggName}`, `titleLevel={2}` | `m08-card` |
| Number | `Text` `type-body-strong`, `tabular-nums` | `m08.card.number`, a11y `m08.card.number.a11y` | `m08-card-number` |
| Bloodline | `Text` `type-label` | `m08.card.bloodline` | `m08-card-bloodline` |
| Body | `Text` `type-body` | `m08.card.body` | `m08-card-body` |
| Labelled actions | `TrackpadActions` | browsing: `onActivate`/`activateLabel=m08.action.look`; approaching: `onStepBack` (`m08.action.prev`), `onActivate` (`m08.action.all`), `onStepForward` (`m08.action.next`) | `m08-actions` |
| Choose | `Button variant="cta" size="lg" fullWidth` | `m08.cta.choose` → confirming | `m08-choose` |
| Confirm | `Button variant="cta"`, `Button variant="outline"` | `m08.confirm.yes` → chosen; `m08.confirm.no` → approaching | `m08-confirm-yes`, `m08-confirm-no` |
| Error | `ErrorMessage` + `Button variant="outline"` | `m08.error.*` | `m08-error`, `m08-retry` |

### Trackpad and keys

| Shell input | browsing | approaching | confirming |
|---|---|---|---|
| `trackpad.label` | `m08.trackpad.label.browsing` | `m08.trackpad.label.focused` | `m08.confirm.title` |
| `onStep(±1)` | focus tile 1 (either direction) | previous / next egg, wraps | disabled |
| `onActivate` (tap) | focus tile 1 | — (the card's buttons own it) | Choose this egg |
| `onCommit` + `commitLabel` (hold 600 ms) | — | `m08.trackpad.commit.label` → chosen directly (D15 proposed) | — |
| `keys.back` | router back → M07 | → browsing | → approaching |
| `keys.forward` | focus tile 1 | next egg | disabled |
| `keys.home` | disabled (no egg, no Mon yet) | disabled | disabled |
| `keys.menu` | companion menu (DIRECTION.md) | same | same |

Haptics: `haptics.selection` on step, `haptics.tap` on activate, `haptics.success` on chosen.

### `ChoiceTriptych` contract (missing primitive)

```ts
/** One tile: a still or a render target, with its spoken name. */
export interface ChoiceTriptychItem {
  key: string;
  label: string;               // visible under the tile
  accessibilityLabel: string;  // e.g. m08.tile.a11y.label, filled
  media: ReactNode;            // Image today, a render target when models land
}

/**
 * 2–4 equal tiles with radio semantics and no default. Focusing a tile grows
 * it to fill the container; null focus is the browsing state.
 */
export interface ChoiceTriptychProps {
  items: readonly ChoiceTriptychItem[];
  /** null = nothing focused (browsing). Controlled: the screen and the trackpad both drive it. */
  focusedIndex: number | null;
  onFocusChange: (index: number | null) => void;
  /** Group name for assistive tech. */
  accessibilityLabel: string;
  /** Content shown over the focused tile (the card). */
  focusedOverlay?: ReactNode;
  /** Where the overlay docks: over the bottom (phone) or beside (compact, Quest). @default 'bottom' */
  overlayPlacement?: 'bottom' | 'trailing';
  reducedMotion: boolean;
  testID?: string;
}
```

Keyboard: `nextRadioIndex` / `rovingTabIndex` from `packages/ui/radio-group.ts`; Escape sets `focusedIndex` to `null`.

## Tokens

| Use | Daylit | Night |
|---|---|---|
| Screen background | `bg` concrete-50 | `night` |
| Title / labels | `text` | #F8F8F8 |
| Caption | `text-muted` | `silver` |
| Card face | `surface-raised` white | #0A1230 |
| Card Bloodline | concrete-700 | `silver` |
| CTA | `cta` / `on-cta` | same tokens |
| Focus ring | `royal-500` | `royal-300` |
| Space | gutter 16 pt (24 dp Quest), tile gap 12, card inset 12, label gap 8 | same |
| Type | `type-title`, `type-body`, `type-body-strong`, `type-label` | same |
| Motion | `motion-enter`, `motion-step`, `motion-tap` | reduced siblings |

Measured pairs: `07-a11y.md`.

## States

| State | Behaviour | Copy IDs |
|---|---|---|
| browsing | triptych, `focusedIndex: null`, LED off | `m08.title`, `m08.santoro.caption`, `m08.tile.*`, `m08.action.look`, `m08.trackpad.label.browsing`, `m08.trackpad.hint` |
| approaching | tile fills, wobble once, card up | `m08.card.*`, `m08.action.prev/all/next`, `m08.cta.choose`, `m08.trackpad.label.focused`, `m08.trackpad.commit.label` |
| confirming | card body swaps in place | `m08.confirm.*` |
| chosen | announce, `router.push` to M10 with `bloodline` param; nothing written | `m08.chosen.a11y.announce` |
| error | content failed `@acme/content` parsing at import; caught by the route error boundary | `m08.error.*` |
| offline | same as browsing | — |
| already chosen (re-entry) | `selectPendingEgg` returns an egg or `selectActiveMon` returns a Mon: `router.replace` to M11 or M13; M08 never renders a second choice | — |
| consent pending | status row item; everything else unchanged (ADR 0001: local play) | `m05.badge.pending`, `.a11y` |

Struck: `refused` (Decision #14). Renamed: `bonded` → `chosen` (`06-critique.md` C2).

## Motion and reduced motion

| Element | Trigger | Full | Duration / easing | Reduced |
|---|---|---|---|---|
| Tile → fill | focus | scale + translate from the tile frame | 300 ms `emphasized` | 200 ms cross-fade |
| Egg wobble | focus | two ±3° rotations about the egg's base | 600 ms, `standard` | none |
| Card | focus | fade + 8 pt rise | 300 ms `emphasized` | 200 ms fade |
| Step | flick / next | 24 pt slide, card content cross-fade | 200 ms `standard` | 120 ms cross-fade |
| Hold progress | hold | ring fills | 600 ms linear | same (progress, not decoration) |
| Chosen | commit | ring flash, push M10 | 120 ms + `motion-step` | colour change, cut |

Animations run on the UI thread (Reanimated shared values driven from the gesture; no JS-thread `setState` per frame). The wobble is a `withSequence` of two `withTiming` rotations; it cancels if focus moves before it ends.

## Data

| Need | Source (exact export) |
|---|---|
| The three eggs, slot order | `eggs` from `@acme/content` (`StarterEgg`: `bloodlineId`, `speciesId`, `dexId`, `eggName`, `hatchesIntoSpeciesId`) |
| Bloodline label | `bloodlines` from `@acme/content` → `bloodlineName` + " Bloodline" |
| Stills and alt | `CREATURE_ART` from `@acme/assets/creatures`, `kind === 'egg'`, matched on `dexId` |
| Entry guard: a Mon already exists | `useMonStore(selectActiveMon)` from `packages/app/features/mon/mon.store.ts` |
| Entry guard: an egg already exists | **missing** `selectPendingEgg` (B2) |
| Reduced motion | `useReducedMotion` from `@acme/ui` |
| Scheme | `schemeForTime` from `packages/app/features/onboarding/time-scheme.ts` |

M08 calls **no** Mon-store action. The choice lives only in the M10 route param until `startIncubation` writes the egg (M10 handoff).

Missing selector, proposed for `create-mon-store.ts` beside the existing ones:

```ts
/** The Caller's unhatched egg (no MonInstance minted for it yet), or undefined. Earliest `incubationEndsAt` first, as boot orders them. */
export function selectPendingEgg(state: MonStoreState): EggRecord | undefined;
```

It must use the same ordering as `unhatchedEggs` in `packages/core/sim/boot.ts`, ideally by exporting that function from core rather than copying it.

## Tests to write

| Kind | Test |
|---|---|
| Unit (app) | entry guard: Mon present → M13; pending egg → M11; neither → render |
| Unit (app) | no tile is focused on mount; first step focuses index 0 |
| Unit (app) | hold commit pushes M10 with `bloodline=F01/F02/F12`; button path needs confirm |
| Unit (app) | no M08 string contains "catch", "capture", "device", "family" or " line"; a reviewed check that no pronoun refers to the Mon ("if it keeps happening" refers to the error) |
| Unit (kit) | `ChoiceTriptych`: radio roles, roving tab index, Escape clears focus, reduced motion swaps the transition |
| Story | `ChoiceTriptych/*` |
| Visual | browsing, each egg approaching, confirming; daylit and night; SE, Pro Max, iPad, 1280 × 800 compact; XXL |
| a11y (web) | axe; arrows move tiles; Escape leaves approaching and confirming |

## Device verification

Open; no device yet.

- [ ] SE and Pixel 8: triptych tiles ≥ 44 pt, card scrolls at XXL.
- [ ] VoiceOver / TalkBack: trackpad steps eggs and commits by name; tiles read as radios.
- [ ] Quest 3 2D window: ray select and pinch-hold both choose.
