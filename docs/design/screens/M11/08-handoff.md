# M11 Incubating: handoff

Implementation contract for `platform`, `render` and the kit. Inputs: `01-research.md` to `07-a11y.md`, `docs/design/hlynk/DIRECTION.md`, `docs/spatial/CONTRACT.md`, `packages/core/sim/hatch.ts`, `packages/core/sim/boot.ts`, `packages/app/features/onboarding/notify-permission.native.ts`, `packages/app/features/mon/create-mon-store.ts`. API names below were read from the tree on 2026-10-08; expo-notifications is 58.0.11 in `node_modules`.

## Blockers before implementation

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | `CaptureCase` (NEW) with stories; art direction approved by Mike; Q4 (case = cradle) answered or accepted as the working assumption | kit + Mike | the case |
| B2 | `IncubationRing` (NEW, Skia) with reduced sibling | kit / render | ring |
| B3 | Trackpad `onHoldStart` / `onHoldEnd`; `haptics.warm` (`Presets.breath`); `useLedBreathPhase()` shared clock | kit | warm |
| B4 | A selector for the pending egg. `selectStage` returns `undefined` before hatch, so "`stage: "Egg"`" can't be read from the Mon store. Add `selectPendingEgg(state): { egg: EggRecord; hatch: HatchState } \| undefined` to `create-mon-store.ts`, using the same rule as boot's private `unhatchedEggs` (earliest `incubationEndsAt`, ties by `eggId`). Export boot's helper from `@acme/core/sim` rather than copying it | sim-core + platform | the route |
| B5 | Notification response handling does not exist yet (`addNotificationResponseReceivedListener` / `useLastNotificationResponse` have no call site in `apps/` or `packages/`). Owned by M12's handoff; M11 needs only the foreground handler below | platform | foreground suppression |

## Route and intent

`/(home)/index` renders M11 when `selectActiveMon` is `undefined` **and** `selectPendingEgg` is defined; otherwise M13. Same layout, same `HLynkShell` instance (it lives in `/(home)/_layout.tsx`), so M11 → M12 → M13 never remounts the shell.

| Priority | Intent |
|---|---|
| P1 | Say when the egg will be ready, in minutes and a clock time, and that a notification is coming |
| P2 | Give one gentle thing to do: warm the case (no sim effect) |
| P3 | When ready, put "Open the case" under the thumb |
| P4 | Welcome a late return without blame |

## State derivation (pure, no writes)

```ts
const pending = useMonStore(selectPendingEgg);            // B4
const now = useMinuteClock();                              // aligned to the next minute boundary; also on AppState 'active'
const view = transitionHatch(pending.hatch, { type: 'tick', now }, pending.egg); // @acme/core/sim, read-only use
```

| `view.kind` | `now − egg.incubationEndsAt` at **screen entry** | M11 state |
|---|---|---|
| `incubating` | < 0 | counting |
| `ready` | < 60 000 ms, or the edge crossed while foregrounded | ready |
| `ready` | ≥ 60 000 ms | overdue |
| `presenting` | any | resume |
| `hatched` | any | not M11: the hatch writer appends the Mon in the same write, so M13 renders |

M11 never writes the save. `tick` is evaluated, not persisted: `isEggReady` in boot already derives readiness from the clock, and the only commit is M12's `open` (Law 6).

## Effects on entry

1. `getNotifyPermission()`; if `'granted'` and `now < egg.incubationEndsAt`: `scheduleReadyNotification({ eggId, endsAtMs: egg.incubationEndsAt, title: COPY['m23.notification.title'], body: COPY['m23.notification.body'] })`. Idempotent by identifier `egg-ready-${eggId}`; safe on every entry. A `false` result shows `m11.status.schedule_failed`.
2. Permission `'denied'` or `'undetermined'`: status row `m11.status.notify_off` with M06's actions.
3. While M11 is focused: `Notifications.setNotificationHandler` returns `{ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }` for notifications whose `data.eggId` is the pending egg, so the in-app ready state is not doubled by a banner. Restore the default handler on blur.

## Layout

| Class | Layout |
|---|---|
| iPhone SE 3 (375 × 667) | standard shell; screen 351 × 468; case 55% of screen width, ground line at 58% height; plate 96 pt tall |
| iPhone 16 Pro Max (440 × 956) | standard; screen 416 × 555; case 50% width; plate 104 pt |
| Pixel 8 (412 × 915) | standard; screen 388 × 517 |
| Medium ≥ 600 pt (iPad, unfolded) | shell capped at 440 pt (`HLYNK_GEOMETRY.maxWidthPt`), centred; page shows the scheme's page colour |
| Quest 2D window, 1280 × 800 dp landscape | `measureShell` gives standard: body 440 wide, screen 416 × 555, head 40, row 200 (capped from 205); centred with 420 dp of page each side. Nothing is placed in the side gutters: a centred panel keeps the case inside the comfortable horizontal field of view and the trackpad within one ray sweep |
| Landscape phone / split view | compact shell (full-bleed screen, 24 pt head, 72 pt bar, pill trackpad); case and plate keep their ratios |

## Components and test IDs

| Element | Component | testID |
|---|---|---|
| Shell | `HLynkShell testIDPrefix="m11"` | `m11-shell`, `m11-led`, `m11-trackpad`, `m11-key-home` … |
| Case | `CaptureCase` | `m11-case` |
| Ring | `IncubationRing` | `m11-ring` |
| Time line | `Text` | `m11-time` |
| Ready-at / overdue line | `Text` | `m11-time-detail` |
| First-visit caption | `Text` | `m11-caption` |
| Labelled trackpad equivalent | `TrackpadActions` | `m11-action-warm`, `m11-action-open` |
| Notifications-off row | M06 row | `m11-status-notify-off`, `m11-status-schedule-failed` |

## Interactions

| Input | counting | ready / overdue / resume |
|---|---|---|
| Trackpad hold | `onHoldStart`: pad glow follows `useLedBreathPhase()`; `haptics.warm()` on each inhale (≥ 4000 ms apart); announce once per 10 s. `onHoldEnd`: glow fades 200 ms | — |
| Trackpad tap / `activate` | one breath of warm | `router.push({ pathname: '/(home)/hatch', params: { from: 'm11' } })` (M12 starts the show at once; see M12 handoff) |
| Home key | disabled (this is home) | disabled |
| Back | router back (never destructive) | same |

The warm calls nothing in `@acme/core` and writes nothing. That is the contract ("haptic only, no sim effect"); a code reviewer should reject any `applyCare` or bond change wired to it.

## Motion

| Element | Trigger | Full | Reduced |
|---|---|---|---|
| LED | state | `motion-led-breath` 4000 ms 0.35→1 / `motion-led-blink-ready` | steady + `progress-ticks` / `filled-dot` |
| Ring | frame clock | linear, UI thread (Reanimated `useFrameCallback` → Skia value) | one step per minute |
| Pad glow | hold | `interpolate(breathPhase)` 0.25→1 | steady 1 while held |
| Ready seam | ready edge | `motion-enter` 300 ms emphasized | instant |
| Shell scheme | clock crossing | `motion-scheme` 500 ms | instant |

All of it runs on the UI thread from shared values; the JS thread re-renders only on the minute clock and state changes.

## Edge cases

- **Clock moved backwards** after the egg turned ready: readiness never reverts on screen; once M11 has shown ready in this session it stays ready (a `useRef` latch). Boot uses the same clock, so a cold start with a skewed clock may show counting; acceptable, and the server's hatch is the arbiter.
- **Two eggs** (merged account, DECISIONS #18): `selectPendingEgg` picks the earliest; a second egg is out of Phase 1's UI.
- **Consent pending (under-13)**: identical; notifications are local (§1.5).
- **Offline**: identical; M11 makes no network call.
- **Save unreadable**: never reaches M11 (boot routes to M22).

## Data

| Need | Source |
|---|---|
| Egg, hatch state | `useMonStore` + `selectPendingEgg` (B4) over `save.eggs`, `save.hatches` |
| Egg name | `@acme/content` by `egg.speciesId` (`dex-001` Metro Egg, `dex-008` Corner Egg, `dex-061` Prism Egg) |
| Readiness | `transitionHatch(hatch, { type: 'tick', now }, egg)` (read-only) |
| Notification | `getNotifyPermission`, `scheduleReadyNotification` |
| Scheme | `schemeForTime(now)` (`onboarding/time-scheme.ts`) |
| Reduced motion | sim-core adapter flag (§3.6) |

No analytics event fires on warm. Hatch-funnel analytics (if any) belong to M12 and must respect the under-13 rules in ADR 0001.
