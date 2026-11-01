# G01 Arcade controller overlay: handoff

The implementation contract for lane B (Rive sources), lane C (input and components), lane D (adaptive layout) and lane E (session). Inputs: `01-research.md` to `07-a11y.md`, `docs/design/research/arcade-ergonomics.md`, `docs/DESIGN_SYSTEM.md`, `docs/design/DECISIONS.md` (D3, D5, D11), canon Decisions #4, #7, #16, `docs/COPY_DECK.md`, `docs/DEVICE_CHECKS.md`, `packages/ui/game-controls/contract.ts` (the shared input contract; unchanged by this lane). Laws: `CONTRIBUTING.md` (R1–R5, Laws 2, 4, 9, 10). Kit inventory: `docs/REPO_MAP.md` §5.

## Blockers before implementation

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | `ArcadeController`, `AnalogStick`, `DigitalDPad`, `ArcadeSixButtons`, `ArcadeActionButton`, `StartStopPill`, `AdaptiveControlLayout` exist in `packages/ui/game-controls/` with the stories in `04-components.md` (R3) | lanes B, C, D | everything |
| B2 | `packages/theme/contrast.ts` gains the three computed rows and the `royal-500` on `concrete-900` forbidden rule (`07-a11y.md` finding 1) | theme | the kit shipping the look (Law 10) |
| B3 | A `GameInputRouter` implementation with strict down/up pairing and `cancelAll` | lane C | every state below |
| B4 | `haptics` takes a `HapticStrength` (`packages/ui/haptics.native.ts`) | kit | press feedback |
| B5 | The Rive projects `packages/ui/rive/arcade-controls/{left-stick,right-six,start-stop}/` with the View Model paths in directive §8 and semantics authored per `07-a11y.md` | lane B | the Rive-backed components |

Not blocking implementation, blocking visual sign-off: an Editor polish pass on the cap and pad materials (push label `PR-A-controller-materials`) and the press-latency measurement (§14).

## Route and intent

No route of its own. The overlay mounts inside `GameScreen.tsx` as a sibling of the HUD, replacing `CameraControls` and the move pad when the session is in `playing` or `paused`; `GameStatusLayer` and `MapAttribution` stay. On web `GameScreen` never mounts (its header comment), so the overlay has no web route; the `web` profile serves Storybook and the shared layout contract.

| Priority | Intent |
|---|---|
| P1 | Move (stick) and act (six caps) at the same time, with two caps and the stick live together, with no stuck input ever |
| P2 | Start, pause, resume and hold-to-stop from one pill that reflects `pill/state` and never leads it |
| P3 | Read as graphite arcade hardware over both a daylit and a night city, lit only where held |
| P4 | Fit every `LayoutProfile` with nothing on a hinge and the camera's key region clear |

## Layout

Geometry at reference scale 1.0 is `arcade-ergonomics.md` §7 (six centres, Ø56, box 192 × 128) and §8 (stick Ø128 / well 112 / pad 56 / clamp 56; pill 120 × 44). `s = ControllerProfile.scale` multiplies the stick and the cluster; the pill does not scale (`07-a11y.md` Decision). Mirror for `handedness: 'left'`: `x' = 192 − x` inside the cluster box and the groups swap edges.

| Profile | Stick | Cluster | Pill | Notes |
|---|---|---|---|---|
| phone-portrait | centre 24 dp from the left safe edge + 64·s, bottom at the bottom safe inset + 24 dp; `s` default 1.0 | box anchored 24 dp from the right safe edge, bottom aligned with the stick's bottom | top-centre, 16 dp below the top safe inset | the centre third of the height is the camera's key region; no control enters it |
| phone-landscape | same anchors, bottom inset + 16 dp | same; A's centre on the stick's centre baseline | top-centre, 12 dp below the inset | 16 dp from every edge for system gestures; `s` default 1.0 |
| fold-outer | phone-portrait at the outer panel's width | | | |
| fold-book | wholly in the left usable region, same anchors | wholly in the right region | in the wider region, never across the hinge | regions from `usableRegions` (`hud-layout.ts`); `cancelAll('fold-change')` then remount |
| fold-tabletop | lower region, left anchor | lower region, right anchor | centred on the lower region's top edge, 12 dp in | the world owns the upper region; the session is untouched |
| tablet | grip corner, `s` default 1.2, position from `placement.stick` when set (G03) | grip corner, `s` 1.2, `placement.cluster` | top-centre of the window | positions revalidate against safe areas and folds on every metrics change |
| web | pointer; keyboard adapter; `s` 1.0 | | | Storybook only until a web Game screen exists |

`AdaptiveControlLayout` extends `resolveGameHudLayout` (`packages/app/features/game/hud-layout.ts`): it reuses `usableRegions`, keeps the rail-edge rule (controls on the far edge from a navigation rail) and adds the three rects above. The Android scale floor is 0.86 (`07-a11y.md` finding 4).

## Components

All from `@acme/ui/game-controls` (R3). No raw `View` styling in `GameScreen.tsx` beyond the mount point.

| Element | Component | Props | testID |
|---|---|---|---|
| Root | `ArcadeController` | `profile`, `bindings`, `router`, `layout: LayoutProfile`, `regions`, `insets`, `railEdge`, `pill: PillState`, `reducedMotion`, `mode: 'play' \| 'preview'` | `g01-controller` |
| Stick | `AnalogStick` / `DigitalDPad` | `mode`, `placement`, `tuning`, `onMove`, `disabled`, `reducedMotion`, `a11yActions` | `g01-stick` |
| Cluster | `ArcadeSixButtons` | `bindings`, `handedness`, `scale`, `states`, `onDown`, `onUp` | `g01-cluster` |
| Cap | `ArcadeActionButton` | `id`, `label`, `icon?`, `state`, `onDown`, `onUp` | `g01-btn-x` … `g01-btn-c` |
| Pill | `StartStopPill` | `state`, `onStart`, `onPause`, `onResume`, `onStopHoldComplete`, `holdMs`, `reducedMotion` | `g01-pill` |
| Pill housing | `CornerCutFrame` | `corner="all"`, `cut={8}`, `depth={4 \| 0}`, `variant="solid"`, `tone` | inside `g01-pill` |
| Hint line | `Text variant="caption"` | `g01.pill.hint` | `g01-pill-hint` |
| Paused scrim | `View className="bg-scrim-scene"` | over the world only | `g01-scrim` |

### Public prop contracts (R5, Margelo `api-design`)

The contract file is the source of every union; these are the component surfaces built on it, written so the types encode the rules.

```ts
/** One cap. `state` is the Rive `buttons/<id>/state` value; the wrapper never derives it from `heldButtons`. */
export interface ArcadeActionButtonProps {
  id: ButtonId;
  binding: ActionBinding;            // label, icon, enabled
  state: ButtonVisualState;
  scale: number;                     // 0.8…1.4; the resolver has already clamped it
  reducedMotion: boolean;
  onDown(id: ButtonId, timestampMs: number): void;
  onUp(id: ButtonId, timestampMs: number): void;
}

/** The pill reflects the session. It never changes `state` itself. */
export type StartStopPillProps =
  | { state: 'start'; onStart(): void; reducedMotion: boolean }
  | { state: 'playing'; onPause(): void; onStopHoldComplete(): void; holdMs?: number; reducedMotion: boolean }
  | { state: 'paused'; onResume(): void; onStopHoldComplete(): void; holdMs?: number; reducedMotion: boolean }
  | { state: 'stopConfirm'; progress: number; onStopHoldComplete(): void; onStopReleased(): void; reducedMotion: boolean }
  | { state: 'disabled'; reducedMotion: boolean };

/** Stick output in the contract's units: normalized −1…1, +y up, with the digital reading alongside. */
export interface AnalogStickProps {
  mode: StickMode;
  placement: StickPlacement;
  tuning: StickTuning;
  scale: number;
  disabled: boolean;
  reducedMotion: boolean;
  onMove(reading: StickReading, phase: Phase, timestampMs: number): void;
  /** Non-drag path (WCAG 2.5.7): the same CameraCommand actions GameScreen exposes. */
  a11yActions: readonly { name: string; label: string; perform(): void }[];
}

/** Saved positions, tablet and expanded widths only; `null` = resolver default. Proposed addition to ControllerProfile (G03 08-handoff § Data). */
export interface ControllerPlacement {
  stick: { x: number; y: number } | null;
  cluster: { x: number; y: number } | null;
}
```

Rules the types carry: a `stopConfirm` pill must have a `progress`; a `disabled` pill has no handlers; a `start` pill has no stop; `ButtonVisualState` is an input, never computed inside the cap. Every exported prop type gets JSDoc that names the Rive path it binds.

Proposed `contract.ts` changes (not made; reported to the orchestrator): add `'disabled'` to `PillState` (the directive's enum lacks a loading/disabled value and `04-components.md` needs one); add `ControllerPlacement` and `placement` to `ControllerProfile` (shared with G03); document a range for `clampRadiusDp`.

## Tokens

| Use | Token | Value |
|---|---|---|
| Cap face | `concrete-800` | #303337 |
| Housing plate | `concrete-900` | #1C1E21 |
| Wells (cap, stick, pill) | `signage-black` | #000000 |
| Glyph idle / pressed / disabled | `silver-300` / `signage-white` / `concrete-700` | #DFE0E1 / #FFFFFF / #484C51 |
| Structure keyline | `royal-400` | #4082FA (NEW registry rows) |
| Held ring, focus ring, deflection rings | `carolina-500` | #4BA8F0 (NEW registry row on black) |
| Stop hold ring | `apple-500` | #F80000 on black (registry) |
| START face / legend / pressed | `cta` / `on-cta` / `cta-pressed` | #FC7C00 / #000000 / #FD9D40 |
| START daylit boundary | `orange-950` keyline | #3C1E00 (registry rule reused from `Button`) |
| Paused scrim | `scrim-scene` | #FFFFFFD9 light / #0A1230D9 dark |
| Type | `type-label` (cap letters, 17 pt × s), `type-tag` (pill legend), `type-caption` (hint) | `tokens.ts` `typeRamp` |
| Space | 4 dp grid; cap Ø56; pitch 64; row pitch 62; stagger 8; pill 120 × 44; cuts 8 | `arcade-ergonomics.md` |
| Motion | `motion-tap`, `motion-enter`; proposed `motion-press-depth` (4 dp sink) | `motionTokens` |

The controller does not read the scheme. `scrim-scene` is the one scheme-following token, because it sits on the world, not on the hardware.

## States

| Part | State | Rive path / value | Visual | Copy IDs |
|---|---|---|---|---|
| Cap | idle | `buttons/<id>/state = idle` | graphite cap, `silver-300` glyph, dark ring | `g01.btn.<id>.label` |
| Cap | pressed | `pressed` | 4 dp sink, white glyph, rim up one step | — |
| Cap | held | `held` | sink held, `carolina-500` ring on | `g01.btn.state.held` |
| Cap | released | `released` (one frame, then idle) | spring back | — |
| Cap | disabled | `disabled` | `concrete-700` glyph, no ring, no sink on touch | `g01.btn.state.disabled` |
| Cap | cooldown | `cooldown` | `concrete-700` sweep; "wait" chip | `g01.btn.state.cooldown` |
| Stick | idle | `stick/engaged = false`, x = y = 0 | pad centred, no rings | `g01.stick.value` "Centre" |
| Stick | engaged | `engaged = true`, `x`, `y` | pad follows, rings by radius, tick lit by `direction` | `g01.stick.value` |
| Stick | dpad | `stick/mode = dpad` | eight indicators, lit one follows `Direction8` | `g01.stick.mode.dpad` |
| Pill | start | `pill/state = start` | `cta` face, START | `g01.pill.start` |
| Pill | playing | `playing` | graphite, PAUSE, hint line | `g01.pill.pause`, `g01.pill.hint` |
| Pill | paused | `paused` | graphite, RESUME, world under `scrim-scene` | `g01.pill.resume`, `g01.a11y.paused` |
| Pill | stopConfirm | `stopConfirm` | HOLD TO STOP, `apple-500` ring filling | `g01.pill.stop_confirm` |
| Pill | disabled (proposed) | `disabled` | graphite, no legend, `concrete-700` keyline | `g01.pill.disabled.hint` |
| All | cancelled | router `cancelAll(reason)` | every cap idle, pad home, pill unchanged | `g01.cancel.*` |
| All | reduced motion | `a11y/reducedMotion = true` | `07-a11y.md` map | unchanged |

The session owns every transition (§2C): `StartStopPill` calls `onPause` and the session sets `pill/state = paused`; the pill never flips its own legend. Stopping a Rive animation is not stopping the simulation.

## Interaction contract

| Input | Router call | Rule |
|---|---|---|
| Cap touch-down | `buttonDown(id, 'touch', t)` | fires on down (2.5.2 exception, documented); visual feedback on the gesture thread before the round trip |
| Cap touch-up or leave | `buttonUp(id, 'touch', t)` | strict pairing; a leave counts as up |
| Second cap while one is held | `buttonDown` for the second | independent; two-button chords are two events |
| Stick drag | `move(x, y, phase, 'touch', t)` at gesture rate | dead zone and clamp from `tuning`; +y up; diagonals normalized so the magnitude never exceeds 1 |
| Stick release / cancel | `move(0, 0, 'end' \| 'cancel', …)` | neutralizes; the pad springs home |
| Pill tap in `start` | `resumeRequest` or start (lane E decides which call starts) | — |
| Pill tap in `playing` / `paused` | `pauseRequest` / `resumeRequest` | — |
| Pill hold ≥ 1000 ms (`STOP_HOLD_MS`) | `stopRequest` on completion; release before completion sends nothing | announcement `g01.a11y.stop_released` on early release |
| Backgrounding, focus loss, fold, layout change, screen transition, controller disconnect | `cancelAll(reason)` | one polite line per `05-copy.md` |
| Keyboard / gamepad | same calls with `source` set | lane C adapters; the overlay may hide when a non-touch source is active and gameplay continues (§10) |
| Accessibility activate on a cap | `buttonDown` then `buttonUp` after 80 ms, `source: 'accessibility'` | focus alone never fires |
| Accessibility "Stop" action | confirm alert, then `stopRequest` | no timed hold for AT users |

## Motion and reduced motion

The full table is `07-a11y.md` § Reduced motion map; the durations and curves are `03-direction.md` § Motion. Rive carries the cap, stick and pill animations; Reanimated carries the scrim and the mount; nothing animates per frame through React. `motion-press-depth` is proposed to `tokens.ts`; until it lands the 4 dp is an artboard constant named `pressDepthDp` in `rive.yaml`.

## Empty, error, offline

- **Empty:** none; the overlay has no content state. When `bindings` has fewer than six enabled actions the unbound caps render `disabled` with no label (never hidden, so the arc stays whole).
- **Error:** the overlay never shows an error. A session that cannot start keeps the pill `disabled` and `GameStatusLayer` says why (`game-status.ts` states).
- **Offline:** no effect; the controller never touches the network.
- **Controller disconnected (gamepad):** `cancelAll('source-disconnected')`, the touch overlay reappears, `g01.cancel.source`.

## Data

| Need | Source |
|---|---|
| Profile | `ControllerProfile` from the settings slice (G03 `08-handoff.md` § Data, key `controller-profile.v1`, Zod-validated); `DEFAULT_CONTROLLER_PROFILE` until a save exists |
| Bindings | `ControllerBindings<CameraCommand>` from the gameplay screen; the default map is `05-copy.md` § Six buttons |
| Session state | `PillState` from the game session store (lane E); the existing `gameScreenStore` in `game-session.ts` is the pattern (module scope, survives tab changes and folds) |
| Layout | `LayoutProfile` from `ControllerLayoutResolver` (lane D), fed by `useReservedRegions`, `foldLayoutsFromRegions`, insets and `useAdaptiveNavigationPlacement` as `GameScreen.tsx` already does |
| Reduced motion | `useReducedMotion` from `@acme/ui` (never read by the components) |
| Haptics | `haptics` with `profile.haptics` |

No network, no analytics, no new storage key beyond G03's profile.

## Accessibility contract

From `07-a11y.md`: focus order pill → stick → X Y Z A B C → world; names are the spoken actions, letters hidden; the stick is `adjustable` with a compass value and the camera actions as the non-drag path; focus never fires; "Stop" is an explicit custom action with a confirm; announcements only for pill state changes and `cancelAll`; decorative plates and rings hidden; Rive semantics authored and proven by `--semantics` runs, wrapper-owned tree until then; pill fixed at 120 × 44 (144 × 48 Android); Android scale floor 0.86.

## Tests to write

| Kind | Test |
|---|---|
| Unit (`@acme/ui/game-controls`, node test as `camera-input.test.ts` does) | the six centres at scale 1.0 equal `arcade-ergonomics.md` §7; mirror is an involution; every cap ≥ 44 at scale 0.8 and ≥ 48 on Android at the clamped floor; pill never scales |
| Unit | radial dead zone and diagonal normalization (`StickTuning`); `Direction8` from x, y; `cancelAll` returns every visual state to idle |
| Unit | pill reducer: tap in `playing` requests pause, in `paused` requests resume; a hold under 1000 ms requests nothing; a hold of 1000 ms requests stop once |
| Unit (`packages/theme`) | `contrast.test.ts` contains the new rows and the `royal-500` on `concrete-900` forbidden rule |
| Rive (`scripts/rive/`, directive §8) | `--verify`, `--once`, `--screenshot` per state with `--data buttons/a/state=held --data stick/x=0.7 --data stick/y=-0.7`, `--pointer down@…` on each cap centre at 844 × 390 and 320 × 700, `--data-dump` of `stick/*`, `buttons/*/state`, `pill/state`, `--semantics` per state, `--bench=600` |
| Story | the lists in `04-components.md`; capture baselines in `apps/mobile/__captures__` for `AllButtonStates`, `AllPillStates`, `PhoneLandscape`, `FoldTabletop`, `LeftHanded`, `ReducedMotion` |
| Integration (lane C) | two caps held while the stick moves; rapid tapping leaves `heldButtons` empty; fold while A is held ends with no stuck cap; no input accepted outside the three hit regions; no input during the lobby |
| a11y (web story) | axe pass; the focus order above; `aria-pressed` on held caps |

## Device verification

Open; no device is set up and nothing in this lane was run on one. Full list: `docs/DEVICE_CHECKS.md`.

- [ ] iPhone portrait and landscape: all six caps and the stick reachable with two thumbs at scale 1.0 (§14 rows 1–2).
- [ ] Pixel 8: multitouch chords; Android 48 dp floor at the clamped scale.
- [ ] Pixel Fold / Galaxy Z Fold: outer, book and tabletop per the layout table; fold while held; no control on the hinge.
- [ ] iPad portrait, landscape, split: placement editor positions honoured and revalidated on resize.
- [ ] VoiceOver and TalkBack: the focus order, the "Stop" confirm, no action on focus.
- [ ] Reduced motion on: no sink, no spring, stick reading visible.
- [ ] Press-to-sink latency measured at 60 and 120 Hz; distributions recorded, not claims.
- [ ] Real-gamma contrast of `royal-400` on graphite over a daylit city.
