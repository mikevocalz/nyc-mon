# M10 Incubation choice: handoff

Implementation contract for `platform`, `sim-core`, `render` and the kit. Inputs: `01-research.md` to `07-a11y.md`; `V11 ¶49`, `¶65`; canon #5, #7, #8, #9; design D5, D8, D11, P2; `screens/M06/08-handoff.md`; `screens/M08/08-handoff.md`; `packages/core/sim/hatch.ts`; `packages/app/features/mon/create-mon-store.ts`.

## Blockers before implementation

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | `IncubationRing` (missing primitive, Skia, §3.4) with stories `Unselected`, `Selected`, `Progress` (for M11), `ReducedMotion`, `LargeTextList` | kit / render | ring |
| B2 | `EggCase` (missing primitive) with stories `Open`, `Closing`, `Closed`, `PadLit`, `NightPage` | kit / render | confirm moment |
| B3 | `startIncubation` action on the Mon store (missing, contract in § Data) | app (`packages/app/features/mon`) | Start |
| B4 | Egg-creation write queue: `WriteQueueSchema.entries` holds `CareWrite` only (`packages/core/schemas/save.ts`). `POST /v1/eggs` needs a queued `CreateEggRequest` that replays on reconnect with the same `eggId` (§1.4 offline rule). Either widen the queue to a discriminated union or add `pendingEggPosts` | `sim-core` | offline creation, server reservation |
| B5 | `selectPendingEgg` (defined in `screens/M08/08-handoff.md` B2) | app | re-entry guard |
| B6 | Egg cut-out art for the ring centre (the block stills have backgrounds) | lookdev | ring centre (fallback: the still, circle-masked) |
| B7 | `EggRecord.nickname` and `CreateEggRequest.nickname` stay in the schema but M10 always writes `null` (Decision #5: naming after the hatch). Document it on the schema so nobody wires a name field to M10 | `sim-core` | data clarity |

Not blocking: Q4, Q27 (copy follows the ruling), the M06 sheet (already specified; M06 B4 closes with this file).

## Route and intent

Route `/(onboarding)/incubate?bloodline={F01|F02|F12}`. Shell: H-Lynk Core. Reached from M08 `chosen`. Next: M06 `formSheet` over M10 when notification permission is `undetermined` (P2), then M11 `/(home)` with `stage: "Egg"`; otherwise M11 directly.

| Priority | Intent |
|---|---|
| P1 | Pick 15, 30 or 60 minutes with no default and no pressure |
| P2 | Say honestly that the length changes nothing about the Mon in Phase 1 |
| P3 | Create exactly one egg, reserve its `monInstanceId`, start the timer, close the case |
| P4 | Hand off to the notification ask only after the case has closed |

## Layout by breakpoint

| Breakpoint | Shell | Screen |
|---|---|---|
| Phone portrait | measured shell, 3:4 screen | 16 pt gutter. Title (2 lines) + body (2–3 lines) ≈ 120 pt. Ring centred, diameter `min(screenW − 64, 260)` (≈ 260 on SE's 351 pt screen, so the ring + Ready-at + CTA = 260 + 32 + 56 fits the remaining ≈ 290 pt with the 16 pt bottom margin). Ready-at 12 pt under the ring. CTA pinned 16 pt above the screen's bottom edge |
| Tablet portrait | measured shell capped at 560 pt wide, centred | ring up to 300 pt |
| Tablet landscape, short windows | `layout="compact"` | two columns: title, body, Ready-at and CTA leading; ring trailing |
| Quest 2D window 1280 × 800 dp | `layout="compact"` | two columns as above; ring 360 dp; stops 64 dp targets (ray accuracy, XAUR); CTA 56 dp tall |
| Any, accessibility text sizes | — | ring replaced by three radio rows (`07-a11y.md`) |

## Components

| Element | Component | Props | testID |
|---|---|---|---|
| Chrome | `HLynkShell` | `status`: `{ led: 'off' }` → `{ led: 'incubating', label: m10.led.chip, progress: 0 }`; `reducedMotion`; `trackpad`; `keys`; `testIDPrefix="m10"` | `m10-shell` |
| Screen | `HLynkScreen` | `aspect="3:4"` / `fill` | `m10-screen` |
| Title | `Heading level={1}` | `m10.title` | `m10-title` |
| Body | `Text` muted | `m10.body` | `m10-body` |
| Ring | `IncubationRing` | below | `m10-ring`, stops `m10-option-15`, `m10-option-30`, `m10-option-60` |
| Egg | `Image` inside the ring | egg still from `CREATURE_ART` for the route's egg | `m10-egg` |
| Ready-at | `Text` `type-body-strong`, tabular | `m10.ready` / `.tomorrow` | `m10-ready` |
| Start | `Button variant="cta" size="lg" fullWidth` | `disabled` until chosen, `loading` while starting | `m10-start` |
| Labelled twins | `TrackpadActions` | `onStepBack` (`m10.action.prev`), `onStepForward` (`m10.action.next`) | `m10-actions` |
| Case | `EggCase` | `state`, `padLit`, `reducedMotion`, `children` = egg | `m10-case` |
| Error | `ErrorMessage` + outline `Button` | `m10.error.*` | `m10-error`, `m10-retry` |

### `IncubationRing` contract (missing primitive)

```ts
export interface IncubationRingStop<V extends number> {
  value: V;
  label: string;               // m10.option.*
  accessibilityLabel: string;  // m10.option.*.a11y
}

/** Skia ring with discrete stops (M10) and an optional elapsed arc (M11). Skia draws; it owns no state (§3.4). */
export interface IncubationRingProps<V extends number> {
  stops: readonly IncubationRingStop<V>[];
  /** null = nothing chosen. Controlled. */
  value: V | null;
  /** Omitted = display only (M11). */
  onChange?: (value: V) => void;
  /** 0–1 elapsed, drawn over the chosen stop's arc (M11 countdown). */
  progress?: number;
  accessibilityLabel: string;  // m10.ring.a11y.label
  centre?: ReactNode;          // the egg, or the closed case on M11
  sizePt: number;
  reducedMotion: boolean;
  testID?: string;
}
```

M10 passes `stops` built from `INCUBATION_MINUTES` (`@acme/core` schemas: `[15, 30, 60]`), typed `IncubationMinutes`.

### `EggCase` contract (missing primitive)

```ts
/** The single-egg case (V11 ¶65): square metal halves, internal hinge, top handle, rounded-square pad on the lid. */
export interface EggCaseProps {
  state: 'open' | 'closing' | 'closed' | 'opening';
  /** Pad glows red (led-on on a black inset). */
  padLit: boolean;
  /** Breath in step with the H-Lynk LED (M11). */
  padRhythm?: 'steady' | 'breath';
  onTransitionEnd?: (state: 'closed' | 'open') => void;
  reducedMotion: boolean;
  accessibilityLabel?: string;
  children?: ReactNode; // the egg, visible while open
}
```

### Trackpad and keys

| Input | choose / chosen | starting | confirmed |
|---|---|---|---|
| `trackpad.label` | `m10.ring.a11y.label` / `m10.trackpad.label` | same | `hlynk.led.a11y` chip |
| `onStep(-1/+1)` | shorter / longer; from none, +1 → 15 and −1 → 60 | disabled | disabled |
| `onActivate` | Start when a stop is chosen; with none chosen it starts nothing, picks nothing, and speaks `m10.cta.start.a11y.hint.disabled` | — | — |
| `keys.back` | → M08 with `bloodline` focused | disabled | disabled (the egg is in the case; back would mislead) |
| `keys.home` | disabled | disabled | → M11 |

Haptics: `selection` per step, `success` when the case closes.

## Tokens

| Use | Daylit | Night |
|---|---|---|
| Page / text | `bg`, `text`, `text-muted` | `night`, #F8F8F8, `silver` |
| Arc unselected / selected | concrete-500 / signage-black | concrete-500 / #F8F8F8 |
| Ring stroke | 12 pt; gaps 8 pt | same |
| Case face / edge | concrete-800 / concrete-400 (proposed `case-metal`, `case-edge`) | same |
| Case pad | `signage-black` inset with `led-on` glow | same |
| CTA | `cta` / `on-cta` | same |
| Focus | `royal-500` | `royal-300` |
| Type | `type-title`, `type-body`, `type-body-strong` (tabular), `type-label` | same |

## States

| State | Behaviour | Copy IDs |
|---|---|---|
| choose | no stop; Start disabled; no Ready-at | `m10.title`, `m10.body`, `m10.option.*`, `m10.ring.a11y.label`, `m10.cta.start`, `m10.cta.start.a11y.hint.disabled` |
| chosen (unconfirmed) | stop filled; Ready-at shown and refreshed on the minute | `m10.ready`, `m10.ready.tomorrow`, `m10.trackpad.label` |
| starting | `startIncubation` runs (sync MMKV write); Start `loading` | `m10.cta.starting.a11y` |
| confirmed | case closes; LED `incubating`; announce; then M06 sheet or M11 | `m10.case.a11y.closed`, `m10.confirmed.a11y.announce`, `m10.led.chip` |
| error | write threw; nothing created; retry calls the same action | `m10.error.*` |
| already-incubating | guard on mount and on focus: `selectPendingEgg` → `router.replace` M11; `selectActiveMon` → M13 | — |
| bad / missing param | `router.replace` M08 | — |
| offline | identical; server post waits in the queue (B4) | — |
| consent pending | status row; egg stays local until approval (ADR 0001) | `m05.badge.pending` |

## Motion and reduced motion

| Element | Trigger | Full | Duration / easing | Reduced |
|---|---|---|---|---|
| Arc fill | select | sweep along the arc | 200 ms `standard` | instant |
| Ready-at | first select | fade + 8 pt rise | `motion-enter` 300 ms | 200 ms fade |
| Case close | confirmed | bottom half rises behind the egg, lid swings on the hinge, pad lights at 90% | 700 ms `emphasized` | 200 ms cross-fade to closed, pad lit |
| LED | confirmed | breath | `motion-led-breath` 4 s | steady + tick row |
| Sheet / M11 | case `onTransitionEnd('closed')` | 400 ms hold, then sheet or push | — | immediately after the cross-fade |

The case animation is UI-thread (Reanimated shared values or a Skia `useClock`), and `onTransitionEnd` fires from the animation's end callback, not a JS timer, so the sheet never rises on a half-shut case.

## Data and Mon-store contract

| Need | Source (exact export) |
|---|---|
| The chosen egg | `eggs` from `@acme/content`, matched on the route's `bloodlineId` |
| Stops | `INCUBATION_MINUTES`, type `IncubationMinutes` (`@acme/core`) |
| Egg + id reservation | `createEggRecord`, `createHatchState`, `deriveMonInstanceId` (`packages/core/sim/hatch.ts`) |
| Re-entry guard | `useMonStore(selectActiveMon)` (exists); `useMonStore(selectPendingEgg)` (missing, M08 B2) |
| Write | **missing** `startIncubation` on `MonStoreState` (B3) |
| Notification | `getNotifyPermission`, `scheduleReadyNotification` (`packages/app/features/onboarding/notify-permission`), title/body `m23.notification.*`, `endsAtMs = egg.incubationEndsAt`; the M06 sheet owns the request |
| Scheme, reduced motion | `schemeForTime`, `useReducedMotion` |

Proposed addition to `MonStoreState` in `packages/app/features/mon/create-mon-store.ts`:

```ts
/**
 * Creates the Caller's egg for the chosen bloodline, reserves its
 * monInstanceId, starts the hatch state machine and persists the save.
 * Idempotent: when an unhatched egg already exists it returns that egg and
 * writes nothing (D17 proposed). Throws when the save has no Caller or
 * already has a Mon. Queues POST /v1/eggs with the same eggId (B4).
 */
startIncubation: (input: {
  bloodlineId: BloodlineId;
  minutes: IncubationMinutes;
  atMs: number;
}) => EggRecord;
```

Inside it: re-read through `io.read()` (as `applyCare` does), resolve `speciesId` and `hatchesIntoSpeciesId` from `eggs`, mint `eggId` client-side (UUID v4, fits `IdSchema`), call `createEggRecord({ …, callerId: save.caller.callerId, nickname: null, incubationMinutes: minutes, createdAt: atMs })`, append the egg and `createHatchState(egg)`, enqueue the create, `io.write`. The write listener updates every subscriber; M10 calls no manual hydrate.

## Tests to write

| Kind | Test |
|---|---|
| Unit (store) | `startIncubation` writes one egg + one `incubating` hatch state; `monInstanceId === deriveMonInstanceId(eggId)`; `incubationEndsAt = atMs + minutes × 60 000`; `nickname === null` |
| Unit (store) | second call returns the same egg, writes nothing; throws with no Caller or with a Mon |
| Unit (core) | queued egg create replays with the same `eggId` after a simulated reconnect (B4) |
| Unit (app) | no stop selected on mount; Start disabled; activate with no stop does not start |
| Unit (app) | Ready-at crosses midnight → `.tomorrow` |
| Unit (app) | M06 sheet opens only when permission is `undetermined`, and only after `onTransitionEnd('closed')` |
| Unit | no M10 string contains "capture", "hurry", "best", "recommended", "skip" |
| Story | `IncubationRing/*`, `EggCase/*` |
| Visual | choose, each stop, closing, closed; daylit, night; SE, Pro Max, iPad, 1280 × 800; XXL list |
| a11y (web) | radios by arrow keys; Start disabled hint spoken |

## Device verification

Open; no device yet.

- [ ] Kill the app during the case animation: relaunch lands on M11 with one egg (boot `incubating`).
- [ ] Airplane mode at Start: egg created, chip shows, server post replays later with the same `eggId`.
- [ ] VoiceOver / TalkBack: stops read as radios; adjustable trackpad steps time.
