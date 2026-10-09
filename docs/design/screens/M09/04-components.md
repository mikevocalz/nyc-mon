# M09 Naming ceremony: components

Inventory checked against `packages/ui` on 2026-10-08.

| Element | Component / variant | Props | Status |
|---|---|---|---|
| Chrome | `HLynkShell` | `scheme="night"`, `status={{ led: 'off' }}`, `layout` forced `compact` while the keyboard is up, `trackpad`, `keys`, `testIDPrefix="m09"` | exists; `layout` prop exists |
| Screen | `HLynkScreen` | `aspect="3:4"` (keyboard down) / `fill` (keyboard up) | exists |
| Scroll | `KeyboardAwareScroll` (`packages/ui/keyboard-aware`) | | exists |
| Baby still | `Image` | `CREATURE_ART` baby entry for the active Mon's `speciesId` dex | exists |
| Baby reaction (2D) | `MonStillReaction` | see below | **missing primitive** |
| Scrim strip | `SolidPanel surface="page"` inside `NightScope`, or a `night` 88% view | | exists (pattern); the scrim opacity is a new value, measured in `07-a11y.md` |
| Caption, title | `Text` `type-caption`, `Heading level={1}` | | exist |
| Field | `TextField` | `label`, `hint`, `error`, `maxLength={16}`, `autoCorrect={false}`, `autoCapitalize="words"`, `clearButton` | exists; `clearButton` is the M07 variant (M07 B2) |
| Error | `ErrorMessage` | | exists |
| Plate | `SignagePlate` | `text`, `accessibilityLabel`, `maxSize="station"` | exists (`packages/ui/SignagePlate.tsx`) |
| Use this name | `Button variant="cta" size="lg" fullWidth` | disabled while empty or invalid | exists |
| Announce | `announcePolitely` | | exists |
| Haptics | `haptics.success` on confirm | | exists |

## Missing primitive: `MonStillReaction`

A wrapper that plays a small authored transform on a 2D creature still (tilt, lift) about a per-asset pivot, with a reduced-motion sibling of "none", and swaps itself for the model's clip when a render target exists. Needed because Mike's models come later and the brief's reaction ("species sound, head tilt") must work on the concept art now. M13's tap-for-`attention` will want the same thing on the stills.

```ts
export interface MonStillReactionProps {
  children: ReactNode;          // the still
  /** Pivot in the image's own 0–1 space; per-asset, authored by lookdev. @default { x: 0.5, y: 0.85 } */
  pivot?: { x: number; y: number };
  /** Bump to play once. A change while playing restarts from the current pose, never stacks. */
  playKey: number;
  reaction: 'tilt' | 'lift';
  reducedMotion: boolean;
}
```

## Variants

None new. `TextField` `clearButton` is the M07 variant.

## Token diffs

None new; the scrim uses `night` at 88% opacity (measured in `07-a11y.md` against the worst-case light pixel of each Baby still).
