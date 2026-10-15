# M16 Social (play): handoff

Inputs: `01`–`07` here, `../M13/04-components.md`, `packages/core/sim/care.ts`, `sim/random.ts`.

## Blockers

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | Lead sign-off: Peek mechanic (S-1), quality formula (S-3) | lead | build |
| B2 | Room set dressing with three spots; hide/peek/`play` clips | `render`, Mike | playing state (placeholder art: fade in/out at spots) |
| B3 | `RoundDots`, `SheetSurface placement="in-screen"` | kit | UI |
| B4 | P2 `selectCareNow` | `platform` | intro gate |

## Route

`/(home)/social`. Entry: `m13-bar-play`, M13 trackpad tap when Social is the ask.

## Data: exact calls

```ts
const care = useMonStore(selectCareNow(nowMs));
const canPlay = care.activity.kind === 'awake' && care.energy >= DEFAULT_CARE_TUNING.playMinEnergy;

// one call at the end of a session (Done, Back after ≥1 round, or round 6)
const outcome = useMonStore.getState().applyCare({ kind: 'play', quality }, Date.now());
// 'played' | declined 'asleep' | 'too-tired' (race only; gate prevents it)
```

- Hiding sequence: `createRandom(seed)` from `@acme/core/sim`, seed = `hash128(monInstanceId + sessionStart)`; deterministic for tests.
- `quality` per `06-critique.md` S-3 (pending B1). Computed in `usePeekGame`, never stored.
- One `applyCare` per session, so one queued server write (`enqueueCareWrite`).
- Presence cue during result: `{ intent: 'play', untilMs }`.

## States

| State | Entry | UI | Exit |
|---|---|---|---|
| intro | route open | title, body, Start (CTA); or tired/asleep message + route | Start / trackpad tap → playing |
| playing | Start | spots, round dots, twin controls; no timer | 6 rounds → result; Back after ≥ 1 round → apply then M13; Back at 0 rounds → M13, nothing applied |
| result | sixth find | body line, Social ring fills, Play again (CTA), Done | Play again → intro gate re-check → playing; Done → M13 |

Error: `applyCare` throws only with no active Mon → M22. Offline: unchanged.

## Layout

Compact: Social ring `sm` top-right; three spots spread across the scene's lower third; round dots 16 pt above the twin row; twin row three `Button variant="outline"` 48 pt high, equal widths. Medium+/Quest: intro and result cards in the trailing pane at `content-form`; game in the shell.

## Test IDs

`m16-shell`, `m16-trackpad`, `m16-intro`, `m16-start`, `m16-tired`, `m16-tired-action`, `m16-spot-left`, `m16-spot-middle`, `m16-spot-right`, `m16-rounds`, `m16-twin-back`, `m16-twin-peek`, `m16-twin-forward`, `m16-result`, `m16-ring-social`, `m16-again`, `m16-done`.

## Motion

As `03-direction.md`. Haptics: flick selection tick; found success; peek-out light.

## Multiplayer seam (Phase 2, typed only)

`PlaySessionSchema` in `@acme/core/schemas/seams.ts`: `{ sessionId, monInstanceIds: Id[], participants: { callerId }[] (min 1), startedAt, rounds }`. Phase 1 writes nothing with it; it exists so a Phase-2 shared Peek reuses the round model.

## Acceptance

- A full session is playable with VoiceOver only, no gestures.
- No screen state shows a number other than "Round n of 6".
- Back at round 0 applies no care action.
