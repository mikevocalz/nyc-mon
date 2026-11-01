# G03 Game-control settings: handoff

The implementation contract for lane C (input and components), lane D (layout resolver), and the kit build (`packages/ui`). Inputs: `01-research.md` to `07-a11y.md`, `docs/DESIGN_SYSTEM.md`, `docs/design/DECISIONS.md` (D5, D8), `packages/ui/game-controls/contract.ts`, `packages/app/features/settings/`, `packages/app/features/editor/preferences.store.{shared,native}.ts` (the storage pattern this copies), `docs/COPY_DECK.md`, `docs/DEVICE_CHECKS.md`. Laws: `CONTRIBUTING.md` (R1–R5, Laws 2, 4, 5, 9, 10).

## Blockers before implementation

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | `ArcadeController` exists in `packages/ui/game-controls` with a `mode: 'play' \| 'preview'` prop and a story (R3) | lane C + lane B | `ControllerPreview` |
| B2 | `Slider.valueText` lands in the kit (§ Kit changes) | kit | every slider's spoken value |
| B3 | `ControllerLayoutResolver.validate(placement, metrics)` contract from lane D (§ Data) | lane D | `ClusterPlacementEditor` |
| B4 | The profile slice and its storage (§ Data) exist in `packages/app/features/game/controller-profile.store.{shared,native,web}.ts` | lane C | everything |

Not blocking implementation, blocking visual sign-off: `design-director` picks the compact-phone preview treatment (`06-critique.md` Blocker 2). Default: sticky 150 pt well.

## Route and intent

Route `settings/controls` (expo-router: `apps/mobile/app/(drawer)/settings/controls.tsx`; the existing `settings.tsx` becomes `settings/index.tsx` or keeps its file and gains a nested route, lane C's call). Entered from a "Game controls" row in `SettingsContent`. Shell: none (D8: settings follow the OS appearance).

| Priority | Intent |
|---|---|
| P1 | Edit every `ControllerProfile` field with the change applied to the live preview on the same frame and persisted at once |
| P2 | Mirror for the left hand in one tap |
| P3 | Keep any custom placement valid on every metrics change |
| P4 | Restore defaults with one confirm, nothing else touched |

## Layout

Phone portrait (compact width):

| Part | Spec |
|---|---|
| Safe areas | `SafeArea edges={['top']}` as the settings screen does; bottom padding `pb-48` so Restore clears the home indicator |
| Container | `Container width="detail"`, 16 pt gutters (`layout.gutterPt`) |
| Preview well | full content width, 150 pt tall, `surface-sunken`, 2 px `border`; sticky while the list scrolls (adaptive-panes `use-sticky-header`); the controller at 0.75 of its landscape layout, centred |
| Status lines | `StatusRow` directly under the well, 8 pt gap |
| Sections | `FieldGroup.Section` × 4, 24 pt between sections, 16 pt between controls, 4 pt between a control and its caption |
| Sliders | full width; value label `type-body-strong` right-aligned on the label row |
| Haptics | 2×2 grid (`segmentClassName="basis-[40%] sm:basis-auto"`) |
| Restore | full width, 48 pt tall, 32 pt above the bottom padding |

Per profile (`LayoutProfile` in contract.ts; Material 3 width classes in `widthClassMinDp`):

| Profile | Layout |
|---|---|
| phone-portrait | as above |
| phone-landscape | preview left (40%), controls right in a scroll; no sticky |
| fold-outer | as phone-portrait; preview 120 pt |
| fold-book | controls in the leading pane, preview in the trailing pane; the hinge never under a control; `ClusterPlacementEditor` on |
| fold-tabletop | preview in the upper region, controls scroll in the lower; the editor's bounds exclude the hinge rect |
| tablet | two columns at `expanded`: controls (max `content-form`) left, preview right at 1.0 scale; editor on; a split-window narrower than 600 dp falls back to phone-portrait |
| web | same as tablet at `lg`; keyboard paths in `07-a11y.md`; `<fieldset>` sections |

Hinge and reserved regions come from `@acme/ui/adaptive-panes` (`useReservedRegions`, `foldLayoutsFromRegions`), the same calls `GameScreen.tsx` makes.

## Components

All from `@acme/ui` (R3). No raw `View`/`div` styling in the route file.

| Element | Component | Props | testID |
|---|---|---|---|
| Page | `SafeArea`, `KeyboardAwareScroll`, `Container` | as above | `g03-page` |
| Title | `Heading` | `level={1}` `size="title"`, `g03.title` | `g03-title` |
| Intro | `Text` | `tone="muted"`, `g03.intro` | — |
| Preview | `ControllerPreview` | `profile`, `bindings`, `reducedMotion`, `layoutProfile`, `accessibilityLabel` | `g03-preview` |
| Reduced motion | `StatusRow` | `g03.reduced.*`, only when the OS reports it | `status-reduced-motion` |
| Clamp notice | `StatusRow` | `g03.clamped`, tone `pending` | `status-clamped` |
| Stick mode | `SegmentedControl<StickMode>` | `aria-label` `g03.stick.mode.a11y` | `g03-stick-mode` |
| Stick placement | `SegmentedControl<StickPlacement>` | | `g03-stick-placement` |
| Dead zone | `Slider` | `min=0 max=0.5 step=0.05`, `valueText` → `g03.stick.deadzone.value` | `g03-deadzone` |
| Sensitivity | `Slider` | `min=0.5 max=2 step=0.1`, `valueText` → "{factor} times" | `g03-sensitivity` |
| Hand | `SegmentedControl<Handedness>` | | `g03-hand` |
| Size | `Slider` | `min=0.8 max=1.4 step=0.1` | `g03-scale` |
| Opacity | `Slider` | `min=0.3 max=1 step=0.05` | `g03-opacity` |
| Position | `ClusterPlacementEditor` | `placement`, `bounds`, `onChange`, `onReset`, `nudgeDp={8}` | `g03-placement` |
| Haptics | `SegmentedControl<HapticStrength>` | four options; replaced by `Text` `g03.haptics.unsupported` when `haptics.supported === false` | `g03-haptics` |
| Show icons | `Switch` | rendered only when some binding has `icon` | `g03-show-icons` |
| Bindings | `KeyValueList` | six items, `columns={2}` | `g03-bindings` |
| Restore | `Button` | `variant="outline"`, `g03.restore` | `g03-restore` |
| Confirm | `ResponsiveDialog` | `title`, `description`, `actions` | `g03-restore-dialog` |

### Public prop contracts (R5, Margelo `api-design`)

- The screen never holds field state. It reads the profile slice and calls one setter per field: `setProfile(patch: Partial<ControllerProfile>)`, which runs `ControllerProfileSchema.parse({ ...current, ...patch })` and writes on success. A failed parse is a programming error (the controls clamp before calling), logged, never shown.
- Clamp ranges come from the contract's JSDoc and are encoded once in the Zod schema: `deadZone` 0…0.5, `sensitivity` 0.5…2, `scale` 0.8…1.4, `opacity` 0.3…1, `clampRadiusDp` 32…96 (proposed; the contract gives no range, lane C sets it). On read, `.catch`-free: a stored value outside range is clamped by `readProfile` and `clamped: true` is set on the slice once, which shows `g03.clamped`.
- `HapticStrength` stays the four-value union; the platform's support flag is a separate read (`haptics.supported`), never a fifth value.
- Handedness mirror is pure math in `ControllerLayoutResolver`: `x' = clusterWidth − x` for every centre in the six-button cluster and the stick, labels untouched. Tested in lane C's layout tests.
- `ControllerPreview` props are a discriminated `source`: `{ kind: 'profile'; profile; bindings }` today; `{ kind: 'story'; fixture }` for Storybook. Never a boolean `isPreview`.
- `ClusterPlacementEditor.onChange(next: ControllerPlacement)` is called only with a placement that `validate` accepted; invalid attempts call `onInvalid(reason: 'off-screen' | 'on-fold' | 'overlaps')`.
- Every exported prop type gets JSDoc that links the component that consumes it.

### Kit changes

- `SliderProps.valueText?: (value: number) => string` (`packages/ui/Slider.types.ts`): feeds `accessibilityValue.text` on native and `aria-valuetext` on web; also drawn as the visible value label when given. No change to existing callers.
- `ArcadeController` gains `mode: 'play' | 'preview'` (lane C owns the component).

## Tokens

| Use | Token |
|---|---|
| Page | `bg`, `surface` |
| Preview well | `surface-sunken`, edge `border` |
| Text, captions, values | `text`, `text-muted`, `text-body-strong` ramp step `type-body-strong` |
| Section strips | `FieldGroup.Section` tone `royal` |
| Controls | kit defaults with `tone="royal"` (accent voice on light, structure on dark) |
| Focus | `focus` with `ring-offset-bg` |
| Restore confirm | `danger` face via `Button variant="danger"` |
| Preview hardware | G01's group (caps `concrete-800`, wells `signage-black`, glyphs `silver-300`, keylines `royal-400`); owned by `G01-arcade-controller/08-handoff.md` |
| Space | 4 pt grid: 4 / 8 / 16 / 24 / 32 / 48 |
| Motion | `motion-tap`, `motion-step`, `motion-enter` and their `reduced` siblings from `motionTokens` |

No orange on this page (D5; no CTA). No hex anywhere outside `packages/theme/tokens.ts`.

## States

| State | Trigger | What renders | Copy IDs |
|---|---|---|---|
| default | profile equals `DEFAULT_CONTROLLER_PROFILE` | all controls at defaults | — |
| edited | any setter call | control and preview update; persisted | — |
| restored | dialog "Restore" | `setProfile(DEFAULT_CONTROLLER_PROFILE)`; placement reset; announcement | `g03.restore.done` |
| invalid-clamped | `readProfile` clamped a stored value | `StatusRow` under the preview until the next edit | `g03.clamped` |
| placement-invalid | `validate` rejects | handle snaps back; `StatusRow` tone `request`; announcement | `g03.placement.invalid` |
| reduced motion on | OS | `StatusRow` with "Change"; preview plays reduced siblings | `g03.reduced.*` |
| no haptics | `haptics.supported === false` | the Haptics group is one caption | `g03.haptics.unsupported` |
| no icons in bindings | no `binding.icon` | the Show icons switch is not rendered | — |
| no gameplay bindings | a `ButtonId` without a binding | `KeyValueList` draws the TODO(canon) badge (defect in a release build) | `g03.bindings.unbound` |

## Motion and reduced motion

| Event | Full | Reduced (authored) |
|---|---|---|
| Control change | `motion-tap` | colour only |
| Restore | `motion-step` to defaults | cross-fade 120 ms |
| Handedness swap in preview | `motion-step` slide | cross-fade |
| Snap-back | 200 ms slide | instant |
| Preview idle / press | G01's full tokens | G01's reduced tokens |

`reducedMotion` comes from `useReducedMotion` through the sim-core adapter only. Haptics on this page: the preview's caps play the chosen strength through `haptics` from `packages/ui/haptics.{native,web}.ts`; no other control vibrates.

## Empty, error, offline

- **Empty:** none; defaults are a complete profile.
- **Error:** a storage write failure logs and keeps the in-memory slice; the screen shows nothing (the next launch reads the last good value). A schema-version mismatch on read falls back to defaults with `clamped: true` so `g03.clamped` shows once.
- **Offline:** never relevant; nothing on this screen touches the network.

## Data

| Need | Source |
|---|---|
| Profile | NEW `controllerProfileStore` (Zustand vanilla store, `packages/app/features/game/controller-profile.store.shared.ts`), same shape as `editor/preferences.store.shared.ts`: `readProfile(storage)`, `createControllerProfileStore(storage, initial)`; native fork uses `createMMKV({ id: 'game' })`, web fork `localStorage` |
| Storage key | `controller-profile.v1` (JSON). The `.v1` suffix is the schema version; a future shape writes `.v2` and a migration reads `.v1` once, never in place |
| Schema | `ControllerProfileSchema` (Zod) in `packages/ui/game-controls/profile.schema.ts`, derived from `ControllerProfile`; `.default(DEFAULT_CONTROLLER_PROFILE)` per field so partial records read cleanly |
| Placement | `ControllerPlacement` (NEW in contract.ts, lane D): `{ stick: { x, y }; cluster: { x, y } }` in dp from the controller region's origin, or `null` for the resolver's default |
| Validation | `ControllerLayoutResolver.validate(placement, metrics): { ok: true } \| { ok: false; reason }` (lane D) |
| Bindings | `ControllerBindings<CameraCommand>` from the gameplay screen; read-only here |
| Reduced motion, haptics support | sim-core adapter |

```ts
/** Where the stick and cluster sit when a Caller moved them. Null means the resolver's default. */
export interface ControllerPlacement {
  readonly stick: { readonly x: number; readonly y: number } | null;
  readonly cluster: { readonly x: number; readonly y: number } | null;
}
```

Proposed contract.ts changes for the orchestrator's report: add `ControllerPlacement`; add `placement: ControllerPlacement` to `ControllerProfile` (default both `null`); add a documented range for `clampRadiusDp`.

## Accessibility contract

From `07-a11y.md`: `valueText` on every slider; `aria-label` on every segment group; web sections as `<fieldset>`/`<legend>`; the preview as one `image` element with `g03.preview.a11y`; nudge buttons and keyboard arrows on every handle; polite announcements for restore, clamp and invalid placement; focus returns to the Restore button after the dialog.

## Tests to write

| Kind | Test |
|---|---|
| Unit (`packages/ui/game-controls`, Vitest) | `ControllerProfileSchema` clamps each field to its range; partial records fill defaults; a `.v0` record maps to defaults with `clamped: true` |
| Unit | mirror math: `x' = clusterWidth − x` for all six centres and the stick; labels unchanged; applied twice is identity |
| Unit (lane D) | `validate` rejects a placement over a hinge rect, outside the safe region, or overlapping the other cluster; accepts the defaults on every `LayoutProfile` |
| Unit | revalidation on metrics change: a valid tablet placement that lands on a hinge after folding is reset and `clamped` is set |
| Story | `ControllerPreview`: `Default`, `LeftHanded`, `Scale08`, `Scale14`, `Opacity03`, `DPad`, `ReducedMotion`, `NoHaptics` |
| Story | `ClusterPlacementEditor`: `Tablet`, `Book` (hinge rect), `InvalidSnapBack`, `KeyboardNudge` |
| Story | `GameControlSettings`: `Default`, `Edited`, `Clamped`, `ReducedMotionOn`, `NoBindingsIcons`, `SEViewport`, `TabletTwoColumn` |
| a11y (web) | axe pass on every story; every slider exposes `aria-valuetext`; sections expose `legend` |
| Unit | `valueText` renders as the visible value and as `accessibilityValue.text` |

## Device verification

Open; no device is set up. Implementation proceeds with these pending. Full list: [`docs/DEVICE_CHECKS.md`](../../../DEVICE_CHECKS.md).

- [ ] VoiceOver and TalkBack read each slider's unit text, not the fraction.
- [ ] Switch Control moves a handle through nudge buttons on an iPad; no drag required.
- [ ] Dynamic Type XXL on iPhone SE 3: haptics 2×2 grid and value labels fit.
- [ ] Book posture: controls in the leading pane, preview in the trailing pane, nothing across the hinge; fold while the editor is open keeps the placement valid.
- [ ] Tabletop posture: the editor refuses the hinge rect.
- [ ] Preview press plays the chosen haptic strength on iPhone and Pixel; "Off" plays none.
- [ ] Restore defaults leaves the saved game untouched (resume fixture 2 in the directive's §14 after a restore).
