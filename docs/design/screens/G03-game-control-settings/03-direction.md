# G03 Game-control settings: direction

Inputs: `01-research.md`, `02-references.md`, `docs/DESIGN_SYSTEM.md`, `docs/design/DECISIONS.md` (D5, D8), `packages/ui/game-controls/contract.ts`, `packages/app/features/settings/settings-content.tsx` (the settings page this joins), `G01-arcade-controller/03-direction.md` (the hardware look the preview shows). Route: sub-route of settings. Shell: none. States: default / edited / restored / invalid-clamped / placement-invalid.

## The one move

The controller sits at the top of the page, live, and every control below it changes it as you touch it. No save button, no apply, no "preview mode". The page is a workbench: the object on the bench, the dials under it.

Decision: BUILD the route as `settings/controls`, a sub-route under the existing drawer settings (`apps/mobile/app/(drawer)/settings.tsx`), reached from a "Game controls" row in `SettingsContent`. Reason: the settings page already groups Preferences, Appearance and Session in `Card`s; eight controls plus a preview would double its length, and the preview needs its own width budget.

## Layout

```
 ┌──────────────────────────────────┐
 │ ‹ Game controls                  │  Heading level 1, type-title
 │ ┌──────────────────────────────┐ │
 │ │  (●)            ⌜START⌝  (X)(Y)(Z)│  ControllerPreview: the real ArcadeController,
 │ │   stick                (A)(B)(C) │  input off, at the chosen scale / opacity / hand
 │ └──────────────────────────────┘ │  16:9 well, surface-sunken, 2 px border
 │ Reduced motion is on in system settings. Change › │  StatusRow (only when on)
 │                                  │
 │ Stick                            │  FieldGroup.Section
 │  Mode        [ Analog | D-pad ]  │  SegmentedControl
 │  Placement   [ Fixed | Floating ]│  SegmentedControl
 │  Dead zone   ──●──────  15%      │  Slider + caption
 │  Sensitivity ─────●───  1.0×     │  Slider + caption
 │                                  │
 │ Layout                           │
 │  Hand        [ Left | Right ]    │  SegmentedControl (mirrors the preview)
 │  Size        ───●─────  100%     │  Slider
 │  Opacity     ──────●──  90%      │  Slider
 │  Position    [ Reset position ]  │  tablet / expanded only: ClusterPlacementEditor
 │                                  │
 │ Feel                             │
 │  Haptics  [ Off | Light | Medium | Strong ] │  SegmentedControl, 2×2 on phones
 │  Show icons on buttons   (○ )    │  Switch
 │                                  │
 │ Buttons                          │
 │  X  Zoom in      A  Turn view left│  KeyValueList, read-only; G01 05-copy default map
 │  …                               │
 │                                  │
 │ [ Restore defaults ]             │  Button variant="outline", asks first
 └──────────────────────────────────┘
```

Order follows the directive's §13 list regrouped by what the hand feels first: the stick (the left thumb), the layout (where things are), the feel (haptics, icons), then what the buttons mean. Restore defaults is last and alone.

## States

| State | Trigger | What the Caller sees |
|---|---|---|
| default | profile equals `DEFAULT_CONTROLLER_PROFILE` | Every control at its default; no "Restore defaults" emphasis (it stays enabled: restoring a default is harmless) |
| edited | any control changed | The preview updates on the same frame; the value label updates; nothing else changes. No "unsaved" chip, because the change is already saved |
| restored | "Restore defaults" confirmed | All controls animate to defaults (`motion-step`); a polite announcement "Controls restored to defaults" |
| invalid-clamped | a stored value outside its range was clamped on read | A `StatusRow` line under the preview: "One setting was outside its range and was reset." It clears on the next edit |
| placement-invalid | a dragged or nudged cluster lands on a hinge or outside the safe area | The cluster snaps back to the last valid spot; the editor says "That spot is off the screen or on the fold." (`g03.placement.invalid`) |
| reduced motion on | OS setting | `StatusRow` line with a "Change" action that opens system settings; the preview shows the reduced-motion variants |

## Type

`type-title` for the screen name ("Game controls"), `type-label` for section titles via `FieldGroup.Section`, `type-body` for control labels, `type-caption` for the one-line meaning under each slider. Values beside sliders use `type-body-strong` with tabular figures. No `type-station` here; this is a settings page, not a moment.

Decision: STRIKE `cta` on this screen. No primary action exists; "Restore defaults" is an outline button. No orange on the page (D5). The preview carries G01's orange START pill, which is the hardware's own legend, not a page CTA.

## Motion and reduced motion

- Slider and segment changes: `motion-tap` (120 ms colour change in the reduced sibling).
- Restore defaults: controls move to their defaults with `motion-step` (reduced: 120 ms cross-fade, no slide).
- The preview is the real controller: it plays G01's idle and press variants; under reduced motion it plays G01's authored reduced siblings. The settings page adds no motion of its own to the preview.
- Mirroring on handedness change: the cluster and stick swap sides with `motion-step` (reduced: cross-fade).

## Decisions

- Decision: BUILD reduced motion as a read-only `StatusRow` with a "Change" action to system settings. Reason: the OS owns it; `useReducedMotion` reads it; a duplicate toggle lets the two disagree and the directive asks that components never read the OS themselves twice (§3.6 in M01's a11y).
- Decision: BUILD bindings as a read-only `KeyValueList` of the six buttons and their `CameraCommand` labels. Reason: no gameplay spec exists; remapping an action nobody has specified would be invented canon. The editor becomes a picker when `ControllerBindings` carries more than one permitted action per button.
- Decision: DEFER `ClusterPlacementEditor` on compact phones; BUILD it on `tablet`, `fold-book` and `web` profiles. Reason: §10 names user-adjustable position for tablets; on a phone there is no room to drag and the grip zones are fixed.
- Decision: STRIKE `ConfirmDestructive` for the restore confirm. Reason: it is type-to-confirm for staff records (its own JSDoc); a Caller restoring defaults needs two buttons, not a typed code. Use `ResponsiveDialog` with "Restore" and "Keep my settings".
- Decision: BUILD commit-on-change with no Save. Reason: Breathwrk and ElevenReader both show a Save button; every change here is reversible by moving the control back, and a save step would make the live preview lie until pressed.

## No-list

- No second profile store, no local `useState` for any field (Law 4): the Zustand slice is the draft and the record.
- No invented action names in the bindings list (Law 1, §2B).
- No in-app reduce-motion toggle.
- No drag-only interaction (SC 2.5.7).
- No orange button (D5, no CTA here).
- No rounded corners on panels or controls; the stick housing and the six caps in the preview are round because they are physically round.
- No "Advanced" fold-out. Eight controls fit one page.
