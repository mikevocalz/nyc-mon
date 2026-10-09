# M16 Social (play): components

Shared primitives: `../M13/04-components.md`.

| Element | Component | Notes |
|---|---|---|
| Frame | `HLynkShell`, trackpad `onStep` + `onActivate` | the game's controller |
| Twin controls | `TrackpadActions` (`onStepBack`, `onActivate`, `onStepForward` with labels) | WCAG 2.5.1 |
| Social ring | `CareMeterRing need="social"` | |
| Intro / result card | `SheetSurface placement="in-screen"` (M14 variant) | |
| Start / Play again | `Button variant="cta"` | one per screen (D5) |
| Done | `Button variant="ghost"` | |

## New

### `RoundDots` (NEW, `packages/ui/care/RoundDots.tsx`)

```ts
export interface RoundDotsProps {
  total: number;      // 6
  current: number;    // 1-based
  /** Spoken, e.g. "Round 3 of 6". */
  accessibilityLabel: string;
  reducedMotion: boolean;
}
```

Not the kit `ProgressBar`: discrete rounds, and it must not read as a score.

### `usePeekGame` (NEW, `packages/app/features/mon/play/`)

Game state is presentation state for 30 s, not business state; it may live in a local reducer. It produces only one business value, `quality`, handed to `applyCare` once at the end (Law 4 holds: care stays in the sim). Hiding order comes from `createRandom(seed)` in `@acme/core/sim` so tests are deterministic.

Token diffs: none.
