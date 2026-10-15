# M10 Incubation choice: components

Inventory checked against `packages/ui` on 2026-10-08. The brief names `IncubationRing` (§3.4, M10) as a Skia component; it does **not** exist in the kit (`grep -rl IncubationRing packages` finds nothing). No egg-case component exists.

| Element | Component / variant | Props | Status |
|---|---|---|---|
| Chrome | `HLynkShell` | `status` `{ led: 'off' }` → `{ led: 'incubating', label, progress: 0 }` on confirm; `trackpad`, `keys`, `testIDPrefix="m10"` | exists |
| Screen | `HLynkScreen` `aspect="3:4"` | `statusRow` | exists |
| Consent pending | `StatusRow` | M05 pending item | exists |
| Heading, body | `Heading level={1}`, `Text` | | exist |
| Ring with three stops | `IncubationRing` | see below | **missing primitive** (Skia, §3.4) |
| Egg in the ring | `Image` | egg still from `CREATURE_ART`, cropped to the egg | exists; needs an egg-only crop or a cut-out asset (lookdev) |
| Ready-at line | `Text` `type-body-strong` + `Timestamp` formatting | | `Timestamp` exists; confirm it formats a clock time without a date |
| Start | `Button variant="cta" size="lg" fullWidth` | `disabled`, `loading` | exists |
| Labelled trackpad twins | `TrackpadActions` | `onStepBack` / `onStepForward` (previous / next time), `onActivate` (start) | exists |
| Case closing | `EggCase` | see below | **missing primitive** |
| Error | `ErrorMessage` + `Button variant="outline"` | | exists |
| Notification sheet | M06 `formSheet` (`screens/M06/08-handoff.md`) | `minutes` | specified in M06; integration unblocked by this handoff (M06 B4) |

## Missing primitive: `IncubationRing`

Skia ring with N discrete stops, radio semantics and an optional live progress arc. M10 uses the stops; M11 reuses it read-only with `progress` for the countdown (§3.4: "15/30/60 with live countdown"). Skia draws state; it never owns it (§3.4). Each stop is backed by an accessible RN `Pressable` laid over its label, so the canvas never holds focus.

## Missing primitive: `EggCase`

The single-egg case from `V11 ¶65` as a kit drawing with three states: `open`, `closing`, `closed`, plus a `padLit` flag. M10 closes it; M11 shows it closed with the pad breathing in step with the LED; M12 opens it. One component, so the case is the same object on all three screens (§2.4: "appears exactly once").

## Variants

None on existing components.

## Token diffs

Proposed: `case-metal` (dark brushed metal face) and `case-edge`. Until lookdev picks the metal, `EggCase` uses `concrete-800` face and `concrete-400` edge in both schemes, measured in `07-a11y.md`. The pad uses `led-on` on `signage-black` (4.99:1, already measured); it never sits on `hlynk.body`.
