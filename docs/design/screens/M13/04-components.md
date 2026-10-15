# M13 Home (Baby): components

Kit inventory checked in `packages/ui` on 2026-10-08. This file also holds the primitives M14–M18 share; those screens link here instead of repeating them.

## Existing kit used

| Element | Component | Source |
|---|---|---|
| Frame | `HLynkShell` (`screen`, `statusRow`, `trackpad`, `keys`, `status`, `scheme`, `reducedMotion`, `testIDPrefix`) | `packages/ui/hlynk/HLynkShell.types.ts` |
| Trackpad | via shell `trackpad`: `label`, `hint`, `onActivate`, `onPan` | `hlynk/Trackpad.types.ts` |
| Trackpad twin | `TrackpadActions` (labelled on-screen equivalents, WCAG 2.5.1) | `hlynk/TrackpadActions.tsx` |
| LED + chip | `HLynkStatus` `{ led: 'needsYou', label }` / `{ led: 'off' }`; chip text via `ledAccessibilityLabel` | `hlynk/copy.ts` |
| Status text | `StatusRow` items (`id`, `label`, `tone`) | `packages/ui/StatusRow.tsx` |
| Care bar buttons | `Button` `variant="outline"` `size="md"`, icon + visible label | `packages/ui/Button.tsx` |
| Active-Mon chooser (Decision #18) | `SegmentedControl` in a `BottomSheet` | `packages/ui/SegmentedControl.tsx`, `BottomSheet.tsx` |
| Placeholder art until models land | `Image` with `packages/assets/creatures` Baby art (`squeaklet`, `kittee-cee`, `yotito`) | `packages/assets/creatures/index.ts` |

## New primitives (shared by M13–M18)

### P1 `CareMeterRing` (NEW, Skia, `packages/ui/care/`)

Brief §3.4 names it; it does not exist. Skia draws state, never owns it.

```ts
/** One care meter as a ring with a word under it. No number is drawn. */
export interface CareMeterRingProps {
  need: 'energy' | 'fullness' | 'social';
  /** 0..1, from care advanced to now. */
  value: number;
  /** Visible caption, from copy (m13.ring.*). */
  label: string;
  /** True below the needs-you line: draws a notch at 12 o'clock and the word in `lowLabel`. */
  low: boolean;
  lowLabel: string;
  size?: 'sm' | 'md';
  reducedMotion: boolean;
  testID?: string;
}
```

`accessibilityRole="progressbar"` with `accessibilityValue={{ min: 0, max: 100, now }}`; spoken "Fullness, 22 percent, low". Skia comes through the repo's `react-native-skia` alias (`apps/mobile/package.json`); `@shopify/react-native-skia` is disabled in `apps/mobile/react-native.config.js` (`docs/SPATIAL.md`). Verify the alias API before writing (Law 2). Web: SVG fallback, same props.

`CareMeterRingGroup` lays three rings with captions, `accessibilityRole="summary"` on native group.

### P2 `selectCareNow(nowMs)` (NEW, `packages/app/features/mon/create-mon-store.ts`)

`selectActiveCare` returns stored care, which is stale between actions. Home needs care advanced to the wall clock without persisting:

```ts
/** Care advanced to `nowMs` by `advanceCare`, for display. Never written. Cached per (care record, minute). */
export function selectCareNow(nowMs: number): (s: MonStoreState) => CareState | undefined;
```

Implementation: `advanceCare({ mon, care }, nowMs).state.care` (`@acme/core/sim`). The screen ticks `nowMs` once a minute and on `AppState` `active`. The sim stays pure (Law 3); the clock read lives in the screen's hook.

### P3 `attention` and `refuse` intents (CHANGE to ADR 0010 contract)

`AnimationIntent` is `idle | approach | eat | sleep | play | evolve` (`packages/core/schemas/spatial.ts`). Brief §3.2 requires `attention` (tap the Mon) and `refuse` (M14 declined). Add both to `ANIMATION_INTENTS` and to `ActionCue.intent` (`sim/scene-input.ts`), and to `MonModelSlot.clips` (null until Mike's models). Owner: `sim-core`, with a `docs/spatial/CONTRACT.md` row each.

### P4 `useReducedMotion` adapter

§3.6: reduced motion gates at the sim-core adapter. Every component here takes `reducedMotion: boolean` from that adapter, never from the OS directly.

## Variants needed

| Component | Variant | Why |
|---|---|---|
| `Button` | `variant="hlynk-care"`: black face, `silver-300` glyph and label, 48 pt, sits on the scene | Outline buttons over a 3D scene need their own face to hold contrast against any background |
| `StatusRow` item | `tone="request"`: neutral text with a filled dot glyph | Danger tone is wrong for a request (product-decisions §4) |

## Token diffs

None new. Uses `structure`, `concrete-200`, `border`, `text`, `text-muted`, `surface-raised`, `hlynk.core.*`, `motion-enter`, `motion-led-blink-needs-you`. A scene scrim behind the name and rings uses `surface-raised` at 85% (`glow` family has no scrim token; propose `scrim-scene` = `surface-raised` / `#0A1230` at 0.85 to the theme owner with its measurement, Law 10).
