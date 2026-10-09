# M12 Hatch: handoff

Implementation contract for `platform`, `render`, `sim-core` and the kit. Inputs: `01-research.md` to `07-a11y.md`, `screens/M11/08-handoff.md`, `packages/core/sim/hatch.ts`, `packages/core/sim/care.ts`, `packages/core/sim/boot.ts`, `packages/app/features/mon/create-mon-store.ts`, `packages/app/features/onboarding/save-store.ts`, `packages/app/features/onboarding/notify-permission.native.ts`, `docs/spatial/CONTRACT.md`. expo-notifications 58.0.11 and react-native-pulsar 1.7.0 were read from `node_modules` on 2026-10-08.

## Blockers before implementation

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | **Hatch writer.** The Mon store has `applyCare` but nothing that applies a `HatchEvent` and persists it; CONTRACT.md calls it "the hatch writer later". Add `applyHatch(eggId: string, event: HatchEvent, atMs: number): HatchState` to `MonStoreState` (spec below) | sim-core + platform | everything |
| B2 | `selectPendingEgg` (M11 B4) | sim-core | entry |
| B3 | Notification response routing: `addNotificationResponseReceivedListener` + `useLastNotificationResponse` in the root layout, payload parsed with a new `ReadyNotificationDataSchema` (Law 5) | platform | M23 → M12 |
| B4 | `hatch` / `attention` in `ANIMATION_INTENTS` and `ModelClipMapSchema`, and `deriveFirstLook(monInstanceId): 'lean-in' \| 'hesitate'` (pure, seeded with the sim's `hash128`) | sim-core | first look |
| B5 | `CreatureStage` in `/(home)/_layout.tsx`; M09 moved to `/(home)/name` | platform + M09 lane | continuity |
| B6 | `HatchEgg`, `HatchBurst`, `CaptureCase` (`opening`/`open`), haptic verbs | kit / render | the show |
| B7 | Mike: first-look weights; Q30 (soft seam assumed); Q11 (egg skin per line assumed) | Mike | art, seed |

## The hatch writer (B1)

```ts
/**
 * Applies one HatchEvent to the egg's hatch state through `transitionHatch`
 * and persists the result in ONE `io.write`. On the edge into `hatched` the
 * same write appends the Mon to `save.mons` and its care to `save.care`, so no
 * reader ever sees a hatched egg without its Mon (boot's `companion` route).
 * Re-reads the save first, like `applyCare`. Returns the new HatchState.
 * Throws `HatchIntegrityError` unchanged.
 */
applyHatch: (eggId: string, event: HatchEvent, atMs: number) => HatchState;
```

Body, in order: `io.read()`; find `egg` in `save.eggs` and `hatch` in `save.hatches` (create with `createHatchState(egg)` if absent); `next = transitionHatch(hatch, event, egg)`; if `next === hatch` return without writing; else replace the hatch entry; if `next.kind === 'hatched'` and `save.mons` lacks `next.mon.monInstanceId`, append `next.mon` and `createInitialCareState(next.mon.monInstanceId, careStartMs)`; `io.write`. `setActiveMon(next.mon.monInstanceId)` after the write. The write listener updates the store; nothing re-hydrates by hand.

`careStartMs`: **open question for sim-core (design recommendation: `atMs` of the hatched edge, not `mon.hatchedAt`).** `hatchedAt` stays `incubationEndsAt` for determinism (`mintMonInstance`). If care also started at `incubationEndsAt`, a Caller returning six hours late meets a Baby whose meters decayed before it hatched, which contradicts M11's no-blame overdue state. Care is per-device and reconciled through the write queue anyway (`reconcileWithServer`), so starting it at the local hatched moment does not threaten Law 6.

## Route, entry and states

`/(home)/hatch`, optional search param `eggId` (from the notification). Entry:

```ts
const pending = useMonStore(selectPendingEgg);                      // or the egg named by ?eggId
const state = pending?.hatch;                                        // HatchState
```

| On entry | Action | Screen state |
|---|---|---|
| no egg, Mon exists (`selectActiveMon` defined) | none | **already-hatched**: announce `m12.a11y.already`, continuity to M13 (or M09 if `nickname === null`) |
| `?eggId` not in the save | `router.replace('/')` (M01 runs `restore`; the server's `resolveHatch` returns the existing Mon on device B) | — |
| `hatched` | none | **already-hatched** |
| `presenting` | none (`open` is a no-op on presenting) | **in progress**, resume at the start of `state.phase` |
| `incubating` and `now < incubationEndsAt` | none | **early**: `router.replace('/(home)')` |
| `ready` / `incubating` past end, arrived from the notification | none | **pre**; trackpad tap → `applyHatch(eggId, { type: 'open', now }, now)` |
| `ready` / past end, arrived from M11's tap (`?from=m11`) | `applyHatch(eggId, { type: 'open', now }, now)` before the first frame of `case-open` | **in progress** |

The `open` write commits the individual (`ready → presenting` mints via `mintMonInstance`) **before** any reveal frame. A kill at any later point resumes the same Mon.

## Phase loop

```ts
// UI thread drives the phase timeline; JS commits each phase end.
onPhaseEnd = () => scheduleOnRN(() => useMonStore.getState().applyHatch(eggId, { type: 'advance' }, Date.now()));
onSkip     = () => useMonStore.getState().applyHatch(eggId, { type: 'skip' }, Date.now());
```

- `advance` from `attention` yields `hatched`; on the hesitate path, `attention` ends only when the Caller resolves it (trackpad hold, or the "Stay close" button).
- Skip cancels running animations (`cancelAnimation` on every phase shared value), writes `skip`, and jumps to the complete pose (lean-in ending).
- `hatchProgress` is a `SharedValue<number>` driven by `withTiming(1, { duration: 2400 })` within `crack`, with crack stages read from it; it is never stored.
- `scheduleOnRN` is the worklets 0.13 call (verify name against installed `react-native-worklets` before use, Law 2).

## Server confirmation (never awaited)

After the `open` write, in the background: `POST /v1/eggs/:eggId/hatch` (`apps/admin-vite/src/routes/v1/eggs/$id/hatch.ts`), parse with `HatchEggResponseSchema`, then `applyHatch(eggId, { type: 'server-confirmed', mon }, now)`. Offline or failed: retry with backoff on next foreground; `serverConfirmed` stays `false` and the M21 badge shows queued state. A `HatchIntegrityError` (server Mon differs from the derived id) is a P0: route to M22 `/(system)/error`, log, never show the Caller a "hatch failed".

## Notification housekeeping

On the `hatched` edge: `Notifications.cancelScheduledNotificationAsync(\`egg-ready-${eggId}\`)` and `Notifications.dismissNotificationAsync(\`egg-ready-${eggId}\`)` (both exist in 58.0.11; the request identifier is the one `scheduleReadyNotification` sets). "One notification per egg, ever" then holds even if the Caller hatched from M11 before the banner fired.

## Notification deep link (B3)

```ts
export const ReadyNotificationDataSchema = z.object({ eggId: IdSchema, url: z.literal('/(home)/hatch') });
```

Root layout: on a response (`addNotificationResponseReceivedListener`) or the cold-start response (`useLastNotificationResponse`), `safeParse` `response.notification.request.content.data`; on success `router.push({ pathname: '/(home)/hatch', params: { eggId } })`; on failure ignore and log (Law 5). M01's boot must hold a pending deep link and apply it after `resolveBootRoute` lands on `egg-ready` / `incubating` / `companion`, rather than dropping it.

## Layout

Same shell geometry as M11 (`screens/M11/08-handoff.md` "Layout"): SE, Pro Max, Pixel 8 standard; medium ≥ 600 pt centred at 440 pt; **Quest 2D window 1280 × 800 dp**: standard shell 440 × 795, screen 416 × 555, centred, side gutters empty, burst capped at 0.4. Skip pill: top-right of the screen, 16 pt inset, 44 × 44 pt minimum target (48 dp on Quest). Plate: bottom of the screen, 16 pt inset. CTA: `TrackpadActions` row and the trackpad.

## Components and test IDs

| Element | Component | testID |
|---|---|---|
| Shell | `HLynkShell testIDPrefix="m12"` | `m12-shell`, `m12-led`, `m12-trackpad` |
| Case | `CaptureCase` | `m12-case` |
| Egg | `HatchEgg` | `m12-egg` |
| Burst | `HatchBurst` | `m12-burst` |
| Creature | `CreatureStage` (layout-level) | `home-creature-stage` |
| Skip | `Button variant="ghost"` on black pill | `m12-skip` |
| Hesitate button | `TrackpadActions` | `m12-action-stay-close` |
| Hesitate hint | `Text` | `m12-hint-stay-close` |
| Plate | `SignagePlate` | `m12-plate` |
| CTA | `TrackpadActions` | `m12-action-name`, `m12-action-home` |
| Pre action | `TrackpadActions` | `m12-action-open` |

E2E hooks: the screen container carries `testID` `m12-phase-<phase>` for the current phase on the screen container so Maestro/Detox can assert the sequence and the resume point.

## Motion

| Element | Trigger | Full | Reduced |
|---|---|---|---|
| Scheme → night | entry | `motion-scheme` 500 ms | instant |
| Phases | timeline | `03-direction.md` "Sequence" | `03-direction.md` "Reduced motion" |
| Skip appears | 2000 ms after `open` | `motion-enter` | fade 200 ms |
| Continuity out | CTA / already-hatched | `03-direction.md` "Continuity" | instant reframe, 200 ms fades |

All phase animation runs on the UI thread from shared values; JS work per phase is one `applyHatch` write.

## Haptic score

| Beat | Façade verb | Preset |
|---|---|---|
| lid release | `hatchLatch` | `latch` |
| scan line | `selection` | `System.selection` |
| each crack ×3 | `hatchCrack` | `snap` |
| burst peak | `hatchBloom` | `bloom` |
| emerge | `hatchEmerge` | `unfurl` |
| lean-in | `firstLook` | `heartbeat` |
| hesitate hold | `warm` | `breath` (once per 4000 ms, as on M11) |

Skip plays no haptic for skipped beats.

## Testing (adds to §8 "Hatch idempotency")

- Kill the process after each `applyHatch` write: relaunch shows M11 resume, then M12 resumes at that phase with the same `monInstanceId`.
- Skip at every phase: `save.mons` has exactly one Mon equal to `deriveMonInstanceId(eggId)`.
- Tap the notification twice: second entry is already-hatched; no second Mon, no replay.
- Device B: `restore` then notification tap: already-hatched.
- `deriveFirstLook` is stable for a given `monInstanceId` across 10k runs.

## Data summary

| Need | Source |
|---|---|
| Egg, hatch | `selectPendingEgg`, `save.hatches` |
| Transitions | `transitionHatch` via `applyHatch` (B1) |
| Mon after hatch | `selectActiveMon`, `selectStarterBloodlineId`, `selectSceneInput(scene, presence)` |
| Initial care | `createInitialCareState(monInstanceId, careStartMs)` |
| Server | `POST /v1/eggs/:id/hatch` → `HatchEggResponseSchema` |
| Names | `@acme/content` Baby form and Bloodline label by `speciesId` |
| 2D art | `creatureArt(...)` from `@acme/assets/creatures` |

## Open issues

- Deferred with the Phase 3 server-restore work (`boot.ts`, `restore`): the hatch stays local-first, and the mobile app makes no `/v1` call besides `/v1/guardian-consents`, so the background `POST /v1/eggs/:eggId/hatch` confirm (`handleHatchEgg`), the `server-confirmed` write and the `HatchIntegrityError` → M22 route are not wired yet (2026-10-08).
