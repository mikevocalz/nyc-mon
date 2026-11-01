# G01 Arcade controller overlay: components

All parts from `@acme/ui` (R3). Everything marked NEW is a directive §13 name with no file in `packages/ui` today (`packages/ui/game-controls/` holds only `contract.ts`); each needs a story before a gameplay route uses it. Props follow the contract's unions, never booleans for state.

| Element | Component / variant | Props | Status |
|---|---|---|---|
| Overlay root | `ArcadeController` | `profile: ControllerProfile`, `bindings: ControllerBindings`, `router: GameInputRouter`, `layout: LayoutProfile`, `pill: PillState`, `reducedMotion`, `mode: 'play' \| 'preview'` | NEW (Rive-backed; wraps the three parts) |
| Stick | `AnalogStick` | `mode: StickMode`, `placement: StickPlacement`, `tuning: StickTuning`, `onMove(x, y, phase)`, `disabled`, `reducedMotion` | NEW |
| D-pad reading | `DigitalDPad` | same surface as `AnalogStick` with `mode="dpad"`; publishes `Direction8` | NEW (one Rive artboard variant, one wrapper) |
| Six-button cluster | `ArcadeSixButtons` | `bindings`, `handedness`, `scale`, `states: Record<ButtonId, ButtonVisualState>`, `onDown(id)`, `onUp(id)` | NEW |
| One cap | `ArcadeActionButton` | `id: ButtonId`, `label`, `icon?`, `state: ButtonVisualState`, `onDown`, `onUp` | NEW |
| Pill | `StartStopPill` | `state: PillState`, `onStart`, `onPause`, `onResume`, `onStopHoldComplete`, `holdMs=STOP_HOLD_MS` (1000, `contract.ts`), `reducedMotion` | NEW |
| Placement | `AdaptiveControlLayout` | `profile: LayoutProfile`, `regions` from `@acme/ui/adaptive-panes/parts` (`useReservedRegions`, `foldLayoutsFromRegions`), `insets`, `railEdge`, `placement?` (saved positions) | NEW (extends `packages/app/features/game/hud-layout.ts`, which already cuts usable regions by every fold) |
| Pill housing | `CornerCutFrame` | `corner="all"`, `cut={8}`, `depth={4}` idle / `{0}` pressed, `variant="solid"`, `tone` = `cta` hex in `start`, `concrete-800` otherwise | exists |
| Paused scrim | `View` with `bg-scrim-scene` | over the world only, below the controller | token exists |
| "Hold to stop" line | `Text variant="caption"` | under the pill, only in `playing` and `paused` | exists |
| Safe areas | `SafeArea` | top and bottom; the tab layout owns navigation chrome | exists |
| Press feedback | `PressScale` | not used for caps (the Rive press is the feedback); used by the pill's non-Rive fallback | exists |
| Haptics | `haptics` (`packages/ui/haptics.ts`) | `tap()` on cap down, strength from `ControllerProfile.haptics`; `off` skips | exists; a strength parameter is NEW |

## New variants or components

- `ArcadeController` stories: `PhonePortrait`, `PhoneLandscape`, `FoldTabletop`, `FoldBook`, `Tablet`, `Web`, `LeftHanded`, `Scale08`, `Scale14`, `Opacity30`, `AllButtonStates`, `AllPillStates`, `ReducedMotion`, `Preview` (G03 uses it).
- `ArcadeActionButton` stories: one per `ButtonVisualState` (idle, pressed, held, released, disabled, cooldown), `WithIcon`, `LongLabel` (a 4-character label at 0.8 scale).
- `AnalogStick` stories: `Idle`, `Deflected` (x 0.7, y −0.7), `DeadZone`, `DPadMode`, `Floating`, `ReducedMotion`.
- `StartStopPill` stories: `Start`, `Playing`, `Paused`, `StopConfirm` at 0 / 50 / 100% hold, `Disabled`, `ReducedMotion`.
- `haptics` gains a strength argument mapped from `HapticStrength`; `off` is a no-op (`packages/ui/haptics.native.ts`).

## Token diffs

No new colour tokens. The controller composes existing primitives: `concrete-800`, `concrete-900`, `signage-black`, `silver-300`, `signage-white`, `concrete-700`, `royal-400`, `carolina-500`, `apple-500`, `cta`, `on-cta`, `scrim-scene`. Two pairs are not yet in `packages/theme/contrast.ts` and must be added with rows before the kit ships them (Law 10): `royal-400` on `concrete-900` (4.61, ui) and `royal-400` on `concrete-800` (3.52, ui); `07-a11y.md` lists every pair with its source.

A motion token is proposed, not added: `motion-press-depth` (full: 4 dp sink + 0.97 scale, 120 ms; reduced: colour only), because `motion-tap` has no depth field. Until the theme owner adds it, the Rive artboard carries the 4 dp as an artboard constant and `08-handoff.md` names it.
