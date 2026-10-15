# M15 Rest: handoff

Inputs: `01`–`07` here, `../M13/04-components.md`, `packages/core/sim/care.ts`, `sim/tuning.ts`.

## Blockers

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | P2 `selectCareNow` | `platform` | ring, cost line, state |
| B2 | Renderer: forced night key while asleep; `sleep_in`/`sleep_loop`/`wake` clips (null → placeholder pose) | `render`, Mike (models) | scene |
| B3 | Q25 (scheduled sleep) answer may add a state; current design is manual-only | Mike | none now |

## Route

`/(home)/rest`. Entry: `m13-bar-rest` (label "Rest" or "Wake"), M13 trackpad tap when Energy is the ask or the Mon is asleep.

## Data: exact calls

```ts
const care = useMonStore(selectCareNow(nowMs));                // P2
const asleep = care.activity.kind === 'asleep';
const earlyWake = care.energy < DEFAULT_CARE_TUNING.earlyWakeEnergyBelow; // drives m15.wake.cost

// On entry when awake (from the Rest button): put to bed immediately; the screen is the bedroom.
const outcome = applyCare({ kind: 'rest' }, Date.now());      // 'fell-asleep' | declined 'already-asleep'

// Wake (hold commit, or button + confirm when earlyWake)
const outcome = applyCare({ kind: 'wake' }, Date.now());      // 'woke' { early } | declined 'already-awake'
```

- Handle `CareOutcome` exhaustively. `declined: already-asleep` / `already-awake` only happen on a race (another surface acted); show `m15.declined.already` and re-read state.
- Natural wake: on each `nowMs` tick, if `selectCareNow` flips to awake, play `wake` then route to `/(home)`.
- Energy refills by sim curve only; the screen never interpolates its own number.

## States

| State | Condition | UI | Next |
|---|---|---|---|
| awake→sleep | entered awake; `rest` returns `fell-asleep` | `m15.settling`, `sleep_in` | sleeping after clip |
| sleeping | asleep | `m15.sleeping`, `m15.sleeping.leave`, Wake button, cost line if `earlyWake` | wake |
| wake | `woke` outcome or natural wake | `wake` clip, announcement | route `/(home)` |

Back / Home key while sleeping returns to M13 with the Mon still asleep (M13 asleep state). Offline: unchanged.

## Layout

Compact: Energy ring `md` top-right; status block 16 pt above the bottom of the screen, `space.3` between lines; Wake button full width minus 32 pt. Medium+/Quest: status and button in the trailing pane.

## Test IDs

`m15-shell`, `m15-trackpad`, `m15-ring-energy`, `m15-status`, `m15-leave-note`, `m15-wake-cost`, `m15-wake`, `m15-wake-confirm`, `m15-wake-cancel`.

## Motion

| Element | Trigger | Token / clip | Reduced |
|---|---|---|---|
| Scheme | enter sleep / wake | `motion-scheme` 500 ms | `instant` |
| Mon | sleep / wake | `sleep_in`, `sleep_loop`, `wake` | static poses |
| Trackpad hold | press | 600 ms ring fill (Trackpad) | white flash |
| Confirm row | button press | `motion-enter` | fade 200 ms |

Haptics: hold commit success; nothing while sleeping.

## Acceptance

- The cost line is on screen before any early-wake commit.
- A tap anywhere on the scene never wakes the Mon.
- Leaving and returning hours later shows the sim's state, including a self-woken Mon, with no absence copy.
