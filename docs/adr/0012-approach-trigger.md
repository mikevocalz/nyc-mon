# ADR 0012: Approach trigger

- **Status:** Proposed
- **Date:** 2026-10-08
- **Deciders:** Mike (creator) signs off; the spatial Contract agent implements (PR A)
- **Builds on:** ADR 0002 (determinism, Law 3), ADR 0010 (`approach` intent)
- **Code:** `packages/core/sim/approach.ts`, tests in `packages/core/test/approach.test.ts`

## Context

On a headset the Mon should react when the Caller comes close and looks at it. The phase-1 brief already has the idea on the phone: in M08 "Approach one: it reacts" and every starter needs an `approach` clip (§2.2, §3.2). In a room the trigger has to survive head jitter at the boundary, avoid firing every few seconds, and stay quiet when the Mon is asleep or the Caller is busy. It also has to run identically in tests, so it reads no clock (Law 3).

Canon gives no approach distance, angle or timing. Every number below is a design choice.

## Decision

`createApproachMachine(config, suppressions)` validates the config and returns `{ config, initialState, advance }`. `advance(state, frame)` is pure: the same state and frame always produce the same `{ state, events }`, and the input state is never mutated. State is plain data and survives a JSON round trip.

**Frame.** `{ nowMs, tier, viewer: { position, forward }, targets: [{ id, position }] }`, LOCAL_FLOOR space. Time is injected. A frame older than the last one is clamped to the last time seen, so time never runs backwards (the same rule `applyCareAction` uses). A frame with a non-finite `nowMs` or coordinate throws `RangeError` before touching state: a NaN time would otherwise be stored as `lastNowMs` and make every later comparison false. Throwing was chosen over silently skipping so a broken pose source shows up in logs; the caller's state is unchanged and the next good frame proceeds.

**Tier.** `'tabletop' | 'room'`, the scene scale the radii are tuned for. `screen` and `preview` have no viewer pose, so they never run the machine; `street` waits for Phase 2.

**Rules, per frame, in order**

1. **Suppression.** `suppressions` is an injected list of `{ id, isSuppressed(frame) }`. If any matches, an active trigger ends with `reason: 'suppressed'` and the first matching `suppressionId` in list order, and all dwell resets. Suppression wins over every other end reason.
2. **Exit and hysteresis.** An active trigger ends with `target-gone` when its target is missing, or `left-exit-radius` once the floor distance exceeds `exitM`. The exit radius is inclusive, and the forward cone is not rechecked while active, so turning the head does not end it. Ending starts the cooldown.
3. **Gates.** With no active trigger, nothing dwells while suppressed, during cooldown (`nowMs < cooldownUntilMs`), or once `triggeredCount` reaches `maxTriggersPerSession`.
4. **Enter and dwell.** A target dwells while its floor distance is within `enterM` (inclusive) and it is inside the forward cone (angle ≤ `fovHalfAngleDeg`, inclusive). Leaving either resets its dwell. Once it has dwelt `dwellMs` (inclusive; `0` fires on the first frame), the trigger starts.
5. **One active.** If several targets qualify on the same frame, the longest dwell wins, then the nearest, then the lowest id. While one is active no other target dwells.

Distance is measured on the floor plane (x, z), so the Caller's head height does not shrink the radius. The cone uses the full 3D direction, so looking down at a Mon on the floor counts. A zero `forward` sees nothing; a target exactly at the eye counts as seen.

**Construction asserts the invariants** and throws `RangeError` naming the field: `enterM > 0`; `exitM > enterM` on every tier (hysteresis); `fovHalfAngleDeg` in (0, 180]; `dwellMs ≥ 0`; `cooldownMs ≥ 0`; `maxTriggersPerSession` a non-negative integer.

**Events.** `approach-started { targetId, atMs }` and `approach-ended { targetId, atMs, reason, suppressionId }`. While a trigger is active, `deriveAnimationIntent` returns `approach` unless a cue or sleep outranks it (ADR 0010).

### Defaults (`DEFAULT_APPROACH_CONFIG`, design choices, not canon)

| Setting | Value | Why |
|---|---|---|
| tabletop enter / exit | 0.6 m / 0.8 m | arm's reach over a table; 20 cm of hysteresis |
| room enter / exit | 1.5 m / 2.0 m | a step or two from a floor-standing Baby; 50 cm of hysteresis |
| forward cone half-angle | 30° | the Mon is in the central field of view, not the periphery |
| dwell | 750 ms | long enough to ignore a glance across the room |
| cooldown | 20 s | the reaction stays special |
| cap per session | 12 | bounds repetition over a long session |

All six change in one constant; tuning them on a Quest 3 is expected.

## Options considered

### Option A: pure state machine with injected time and rules (chosen)

Deterministic and fully unit-tested at every boundary. Suppression rules come from the app (asleep, menu open, mid-action), so core does not learn about UI.

### Option B: Viro collision volumes around the Mon

Rejected. Collision events have no hysteresis, no dwell and no cooldown, and run only on the device, so none of the rules could be tested headless.

### Option C: a single radius without hysteresis

Rejected. A Caller standing near the boundary would start and end the trigger on head jitter.

## Consequences

- The renderer calls `advance` once per frame with the head pose from the Viro camera and the Mon's world position; it keeps `ApproachState` wherever it keeps per-session state.
- A session ends by dropping the state; the next starts from `initialState`.
- The machine handles several targets, so a Phase-2 scene with more than one Mon needs no change.

## Tests

`test/approach.test.ts`: construction (defaults valid, nine invalid configs, the inclusive limits), enter and dwell (exact boundary, one millisecond early, inclusive enter radius, just outside, floor-plane distance, dwell reset, zero dwell, per-tier radii), forward cone (on-axis, edge inclusive, past the edge, looking away, zero forward, target at the eye), exit and hysteresis (between radii, looking away while active, exactly on exit, just past exit, target gone, no re-trigger while active), cooldown (blocked until the boundary, full dwell needed after it, dwell during cooldown ignored), cap (stops at the cap, zero cap, new session), suppression (blocks dwell, ends an active trigger with its id, first-match order, wins over exit), one-active (longest dwell, distance tie-break, id tie-break, others ignored while active), frame validation (NaN and ±Infinity time, NaN viewer or target coordinate, state still usable after a rejected frame), determinism (equal output, no mutation, backwards time clamp, JSON round trip).
