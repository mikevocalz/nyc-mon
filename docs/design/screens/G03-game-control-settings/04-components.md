# G03 Game-control settings: components

All parts from `@acme/ui` (R3). Props were read from the kit source in `packages/ui` on 2026-10-15. NEW items need a story before the screen uses them.

| Element | Component / variant | Props | Status |
|---|---|---|---|
| Page | `SafeArea` edges top, `KeyboardAwareScroll`, `Container width="detail"` | as `packages/app/features/settings/screen.native.tsx` | exists |
| Title | `Heading` `level={1}` `size="title"` | "Game controls" | exists |
| Preview well | `ControllerPreview` | `profile: ControllerProfile`, `bindings: ControllerBindings`, `reducedMotion`, `layoutProfile`, `accessibilityLabel` (states the current values) | NEW |
| Reduced-motion line | `StatusRow` | `items: [{ id: 'reduced-motion', label, tone: 'neutral', action: { label: 'Change', onPress: openSystemSettings } }]` | exists |
| Clamp notice | `StatusRow` | `items: [{ id: 'clamped', label, tone: 'pending' }]` | exists |
| Sections | `FieldGroup` + `FieldGroup.Section` | `title` "Stick" / "Layout" / "Feel" / "Buttons"; `tone="royal"` | exists |
| Stick mode | `SegmentedControl<StickMode>` | `options` Analog / D-pad, `value`, `onChange`, `aria-label="Stick mode"` | exists |
| Stick placement | `SegmentedControl<StickPlacement>` | Fixed / Floating, `aria-label="Stick placement"` | exists |
| Dead zone | `Slider` | `value` 0…0.5 `step` 0.05, `label="Dead zone"`, displayed as percent | exists |
| Sensitivity | `Slider` | `value` 0.5…2 `step` 0.1, `label="Sensitivity"`, displayed as "1.0×" | exists |
| Hand | `SegmentedControl<Handedness>` | Left / Right, `aria-label="Hand"` | exists |
| Size | `Slider` | `value` 0.8…1.4 `step` 0.1, `label="Size"`, displayed as percent of 1.0 | exists |
| Opacity | `Slider` | `value` 0.3…1 `step` 0.05, `label="Opacity"`, percent | exists |
| Position (tablet, book, web) | `ClusterPlacementEditor` | `placement`, `onChange`, `bounds` (safe region rects from `useReservedRegions`), `nudgeDp=8`, `onReset` | NEW |
| Haptics | `SegmentedControl<HapticStrength>` | Off / Light / Medium / Strong, `segmentClassName="basis-[40%] sm:basis-auto"` (2×2 on phones), `aria-label="Haptics"` | exists |
| Show icons | `Switch` | `value`, `onChange`, `label="Show icons on buttons"` | exists |
| Bindings read-out | `KeyValueList` | `items` six rows, `columns={2}`; `value` is the binding label, `null` draws the TODO(canon) badge when a button has no binding | exists |
| Restore defaults | `Button` `variant="outline"` | `title="Restore defaults"` | exists |
| Restore confirm | `ResponsiveDialog` | `title`, `description`, `actions` two `Button`s (outline "Keep my settings", danger "Restore") | exists |
| Captions | `Text` `variant="caption"` `tone="muted"` | one line under each slider | exists |

## New components

### `ControllerPreview`

A read-only mount of G01's `ArcadeController` inside a `surface-sunken` well with a 2 px `border` keyline and a 16:9 aspect on phones (the landscape controller is the reference pose). Input is disabled at the router: it renders with `profile` and `bindings` but never calls `GameInputRouter`. It plays the Rive idle; pressing a cap in the preview shows the press animation and nothing else (so a Caller can feel the haptic strength they chose). `accessibilityRole="image"`, label built from the profile: "Controller preview. Right-handed, size 100 percent, opacity 90 percent, analog stick." It is one accessibility element; its inner buttons are hidden from the tree.

Decision: BUILD the preview as the real component, never a capture. Reason: the directive bans static artwork; a capture could not show opacity or scale.

### `ClusterPlacementEditor`

Only on `tablet`, `fold-book` and `web`. Two handles inside the preview, one on the stick housing and one on the six-button cluster. Three ways to move each: drag (pointer), four nudge `IconButton`s (8 dp per press, 32 dp with the shift modifier on web), and keyboard arrows when a handle has focus. A "Reset position" `Button variant="ghost"` per handle. Every change calls `ControllerLayoutResolver.validate(placement, metrics)`; an invalid result snaps the handle back and shows `g03.placement.invalid`. The validate call reruns on every metrics change (rotation, fold, split window) and corrects stored positions silently if the screen is not open, with the clamp notice shown the next time it opens.

## Services it reads and writes (directive §13)

| Service | Read | Write |
|---|---|---|
| `ControllerProfile` | every field | every field, one key at a time, Zod-validated on write |
| `ControllerBindings` | the six labels and icons for the read-out and the preview | nothing today |
| `ControllerLayoutResolver` | safe regions and hinge rects for the editor's bounds; the resolved `LayoutProfile` for the preview | the validated `placement` |

## Variants or changes needed in the kit

- `Slider`: needs an `accessibilityValue` text override (`valueText?: (value: number) => string`) so "Dead zone" reads "15 percent" and "Sensitivity" reads "1 times", not raw fractions. Proposed in `08-handoff.md`.
- `SegmentedControl`: no change; `segmentClassName` already gives the 2×2 haptics grid on phones.
- `StatusRow`: no change.
- `KeyValueList`: no change; `null` already draws the TODO(canon) badge for an unbound button.

## Token diffs

None. The page uses the semantic set in `03-direction.md`; the preview uses G01's hardware group. If G01's lane lands an `arcade` token group in `packages/theme/tokens.ts`, the preview reads it through `ArcadeController` and this screen names nothing of its own.
