# M11 Incubating: components

| Element | Component / variant | Props | Status |
|---|---|---|---|
| Shell | `HLynkShell` (`packages/ui/hlynk`) | `status`, `scheme`, `reducedMotion`, `trackpad`, `keys`, `statusRow`, `testIDPrefix="m11"` | exists |
| LED + chip | `HLynkStatus` `{ led: 'incubating', label, progress }` → `{ led: 'ready', label }` | | exists |
| Trackpad | `ShellTrackpadProps` | `label`, `onActivate`, `onCommit` + `commitLabel` (counting: warm), `accent` (`'hatch'` from ready) | exists; needs press-and-hold *duration* callbacks for warm (see below) |
| Labelled equivalents | `TrackpadActions` | "Warm the case" / "Open the case" | exists |
| Case | `CaptureCase` | see below | **NEW** |
| Ring | `IncubationRing` (Skia, §3.4) | see below | **NEW** (named in the brief, not in the repo) |
| Text plate | `View` on `signage-black` @ 88% | | kit token, no component |
| Notification rows | M06's `m11.status.notify_off*`, `m11.status.schedule_failed` | in `statusRow` | strings exist; row component per M06 handoff |
| Announcer | `Announcer` (`packages/ui/hlynk/Announcer.*`) | polite | exists |
| Haptics | `haptics` façade (`packages/ui/haptics.*`) | | exists; needs a `warm` verb (see below) |

## NEW `CaptureCase`

The single-egg case (`V11 ¶64`), drawn in 2D now; a glb replaces the drawing later behind the same props. Look is an art-direction choice (Q4 open), not canon.

```ts
export interface CaptureCaseProps {
  /** `closed` on M11; M12 drives `opening` → `open` from its phase clock. */
  lid: 'closed' | 'opening' | 'open';
  /** 0–1 lid angle while `opening`; a SharedValue so M12 can drive it on the UI thread. */
  lidProgress?: SharedValue<number>;
  /** 0–1 pad glow; a SharedValue fed by the shared breath clock. */
  padGlow: SharedValue<number>;
  /** Orange seam light along the lid edge: ready and the hatch (Decision #7). */
  seam: 'off' | 'lit';
  scheme: 'daylit' | 'night';
  reducedMotion: boolean;
  /** "Metro Egg in its case". The case is one image to assistive tech. */
  accessibilityLabel: string;
  testID?: string;
}
```

Drawing rules: square footprint, brushed metal (`concrete-300` → `concrete-500` vertical gradient, flat on reduced-transparency), hinge along the back edge, folding top handle, rounded-square pad (12 pt radius on a 40 pt square at SE scale) on the front face, right of centre. Never round, never split red/white, never a centre button. Stories: `Closed`, `ClosedWarm`, `ReadySeam`, `Opening`, `Open`, `Night`, `ReducedMotion`.

## NEW `IncubationRing`

```ts
export interface IncubationRingProps {
  startedAt: number;   // egg.createdAt
  endsAt: number;      // egg.incubationEndsAt
  /** Full: continuous on the UI thread. Reduced: one step per minute. */
  reducedMotion: boolean;
  sizePt?: 48 | 64;    // @default 64
  testID?: string;
}
```

Skia arc, 4 pt stroke: track `concrete-700`, fill `signage-white`, full ring `orange-500`. It draws state; it never owns it (§3.4): progress is `(now − startedAt) / (endsAt − startedAt)` computed from props and a frame clock, never stored. Decorative to assistive tech (the time text carries the meaning). Stories: `Start`, `Half`, `LastMinute`, `Full`, `Reduced`.

## Variant: trackpad hold with a duration

`TrackpadProps.onCommit` fires once after 600 ms. Warming needs "while held": `onHoldStart` / `onHoldEnd`, so the pad glows and the haptic pulses for as long as the thumb stays. Proposed addition to `Trackpad.types.ts`:

```ts
/** Press-and-hold that lasts as long as the press. Mutually exclusive with `onCommit`. */
onHoldStart?: () => void;
onHoldEnd?: () => void;
```

Accessibility action `activate` runs one breath (start, then end after 4000 ms) so a screen-reader user gets the same thing without holding.

## Variant: `haptics.warm`

The façade has `tap`, `success`, `warning`, `selection`. Add `warm: guard((p) => p.breath)` (`react-native-pulsar` 1.7.0 `Presets.breath`, verified in `node_modules/.../react-native-pulsar/src/Presets.ts`). Fired once per LED inhale while held, never faster than once per 4000 ms. It respects the app's haptics setting (M19) through the same guard.

## Shared breath clock

One `SharedValue<number>` (0–1 phase of the 4000 ms period) owned by the shell's LED and exported from `packages/ui/hlynk` as `useLedBreathPhase()`. The LED, the pad glow and the warm haptic read it, so they never drift apart. NEW hook; `led-rhythm.ts` already resolves the period from `motionTokens['motion-led-breath']`.

## Token diffs

None. Uses `orange-500` (hatch accent), `signage-black`, `signage-white`, `concrete-*`, `night`, existing motion tokens.
